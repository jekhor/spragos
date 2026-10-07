import { parseTopic, localized } from "./parser.js";
import { buildRound, countItems, isCorrect, poolFor, listLemmas, applySelection, statsKey, hintsAlways } from "./round.js";
import { enableDragAndDrop } from "./dnd.js";
import * as store from "./stats.js";
import { renderMarkdown, markdownTitle, stripTitle } from "./markdown.js";
import * as i18n from "./i18n.js";
import { getLang, LANGS } from "./i18n.js";

const DEFAULT_SETTINGS = {
  topics: [], // файлы тем и ключи подтем ("файл#заголовок"); файл темы с подтемами — все её подтемы
  gaps: 12,
  kind: "all",
  bank: "answers",
  hints: true,
  mode: "drag", // "drag" — перетаскивание из банка, "type" — ввод с клавиатуры
  lemma: "", // тренировать формы одного слова (лемма-подсказка в нормализованном виде) или "" — все слова
  lang: "", // язык интерфейса, выбранный пользователем; "" — по настройкам браузера
  expanded: [], // темы, у которых в настройках развёрнут список подтем
};

const $ = (sel) => document.querySelector(sel);

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

const state = {
  topics: [],
  refs: new Map(), // путь .md относительно data/ → { path, title, src, translations: { be: { title, src } } }
  loadErrors: [],
  settings: store.loadSettings(DEFAULT_SETTINGS),
  round: null,
};

// ---------- Загрузка базы ----------

async function loadTopics() {
  // Список файлов: локально его отдаёт serve.py (/api/files), на статическом хостинге —
  // data/index.json, который создаёт build.py.
  // cache: "no-cache" — браузер всегда сверяется с сервером (GitHub Pages отдаёт max-age=600,
  // и без этого правки базы были бы видны только через 10 минут); неизменённые файлы приходят как 304.
  let files = null;
  for (const url of ["api/files", "data/index.json"]) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (res.ok) {
        files = await res.json();
        break;
      }
    } catch {
      /* пробуем следующий источник */
    }
  }
  if (!Array.isArray(files)) {
    state.loadErrors.push({
      file: "",
      line: 0,
      message: "Не удалось получить список файлов. Запустите тренажёр командой «python3 serve.py».",
    });
    return;
  }
  const fetchText = async (file) => {
    try {
      const res = await fetch("data/" + file.split("/").map(encodeURIComponent).join("/"), { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      state.loadErrors.push({ file, line: 0, message: "не удалось загрузить: " + e.message });
      return null;
    }
  };
  const [topics, refs] = await Promise.all([
    Promise.all(files.filter((f) => f.endsWith(".txt")).map(async (f) => {
      const src = await fetchText(f);
      return src == null ? null : parseTopic(src, f);
    })),
    Promise.all(files.filter((f) => f.endsWith(".md")).map(async (f) => {
      const src = await fetchText(f);
      return src == null ? null : { path: f, title: markdownTitle(src, f), src };
    })),
  ]);
  // имя.be.md — перевод справки имя.md
  const translations = [];
  for (const r of refs) {
    if (!r) continue;
    const m = r.path.match(/^(.*)\.([a-z]{2,3})\.md$/);
    if (m && LANGS[m[2]]) translations.push({ ...r, base: m[1] + ".md", lang: m[2] });
    else state.refs.set(r.path, { ...r, translations: {} });
  }
  for (const tr of translations) {
    const base = state.refs.get(tr.base);
    if (base) base.translations[tr.lang] = { title: tr.title, src: tr.src };
    else state.loadErrors.push({ file: tr.path, line: 0, message: `нет исходной справки ${tr.base} для перевода` });
  }
  for (const t of topics) {
    if (!t) continue;
    state.loadErrors.push(...t.errors);
    t.refPaths = resolveRefs(t);
    if (t.items.length) state.topics.push(t);
  }
}

// Справка на текущем языке (или исходная, если перевода нет).
function refText(ref) {
  return ref.translations[getLang()] || ref;
}

// Название темы на текущем языке.
function topicTitle(topic) {
  return localized(topic, "title", getLang());
}

// Справки темы: @reference (пути относительно data/, через запятую) или файл .md с тем же именем.
function resolveRefs(topic) {
  if (topic.references.length) {
    return topic.references.filter((path) => {
      if (state.refs.has(path)) return true;
      state.loadErrors.push({ file: topic.file, line: 0, message: `справка «${path}» не найдена в data/` });
      return false;
    });
  }
  const same = topic.file.replace(/\.txt$/, ".md");
  return state.refs.has(same) ? [same] : [];
}

// ---------- Экраны ----------

// Экран кодируется в адресе: «/» — главная, «#setup», «#round», «#refs», «#stats».
// Так работают кнопка «назад» и перезагрузка страницы.
function screenFromHash() {
  const h = location.hash.slice(1);
  if (["setup", "refs", "stats"].includes(h)) return h;
  if (h === "round") return state.round ? "round" : "setup"; // раунд после перезагрузки не восстановить
  return "home";
}

function show(name, { push = true } = {}) {
  if (name === "setup") renderTopicList();
  const hash = name === "home" ? "" : "#" + name;
  if (location.hash !== hash) {
    const url = hash || location.pathname + location.search;
    if (push) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
  }
  for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== "screen-" + name;
  for (const b of document.querySelectorAll(".nav-btn")) {
    b.classList.toggle("active", b.dataset.nav === name || (name === "round" && b.dataset.nav === "setup"));
  }
  if (name === "stats") renderStats();
  if (name === "refs") renderRefList();
  // На телефоне раунд занимает ровно экран и прокручивается только список заданий (см. style.css)
  document.body.classList.toggle("in-round", name === "round");
  window.scrollTo(0, 0);
}

// ---------- Настройки ----------

function renderLoadErrors() {
  const box = $("#load-errors");
  box.replaceChildren();
  if (!state.loadErrors.length) return;
  box.append(
    h("details", { class: "panel warn" },
      h("summary", {}, i18n.t("setup.loadErrors", { n: state.loadErrors.length })),
      h("ul", {},
        state.loadErrors.map((e) =>
          h("li", {},
            e.file ? h("code", {}, e.line ? `${e.file}:${e.line}` : e.file) : null,
            e.file ? " — " : null,
            e.message)))));
}

function renderTopicList() {
  const list = $("#topic-list");
  list.replaceChildren();
  if (!state.topics.length) {
    list.append(h("p", { class: "muted" }, i18n.t("setup.noTopics")));
    return;
  }
  const stats = store.loadStats();
  const groups = new Map();
  for (const t of state.topics) {
    const g = t.group || "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  const badge = (keys) => {
    const sum = keys.reduce((a, k) => {
      const st = stats.topics[k];
      return st ? { gaps: a.gaps + st.gaps, correct: a.correct + st.correct } : a;
    }, { gaps: 0, correct: 0 });
    return sum.gaps ? h("span", { class: "badge" }, pct(sum.correct, sum.gaps) + "%") : null;
  };
  const counts = (c) => {
    const parts = [];
    if (c.sentence) parts.push(i18n.t("setup.sentences", { n: c.sentence }));
    if (c.text) parts.push(i18n.t("setup.texts", { n: c.text }));
    return h("span", {}, parts.join(", "));
  };
  const lang = getLang();
  for (const [group, topics] of groups) {
    if (group) list.append(h("h3", { class: "group" }, localized(topics[0], "group", lang)));
    for (const t of topics) {
      const subs = t.subtopics;
      list.append(
        h("label", { class: "topic" },
          h("input", { type: "checkbox", dataset: { topic: t.file }, onchange: (e) => toggleTopic(t, e.target.checked) }),
          h("span", { class: "topic-body" },
            h("span", { class: "topic-title" }, topicTitle(t)),
            t.description ? h("span", { class: "topic-desc" }, localized(t, "description", lang)) : null,
            subs.length
              ? h("button", {
                  type: "button",
                  class: "link sub-toggle",
                  dataset: { toggle: t.file },
                  "aria-expanded": String(isExpanded(t)),
                  onclick: (e) => {
                    e.preventDefault(); // кнопка внутри <label>: не переключать флажок темы
                    toggleExpanded(t);
                  },
                })
              : null),
          h("span", { class: "topic-meta" },
            counts(countItems(t)),
            t.refPaths.length
              ? h("button", {
                  type: "button",
                  class: "link ref-link",
                  title: i18n.t("setup.refTitle"),
                  onclick: (e) => {
                    e.preventDefault();
                    openRefs(t.refPaths);
                  },
                }, i18n.t("setup.ref"))
              : null,
            badge([t.file, ...subs.map((st) => st.key)])))); // файл — статистика до разбиения на подтемы
      if (subs.length) {
        list.append(
          h("div", { class: "subtopics", dataset: { subsOf: t.file }, hidden: !isExpanded(t) },
            subs.map((st) =>
              h("label", { class: "topic sub" },
                h("input", { type: "checkbox", dataset: { sub: st.key }, onchange: (e) => toggleSubtopic(t, st, e.target.checked) }),
                h("span", { class: "topic-body" },
                  h("span", { class: "topic-title" }, localized(st, "title", lang)),
                  st.description ? h("span", { class: "topic-desc" }, localized(st, "description", lang)) : null),
                h("span", { class: "topic-meta" }, counts(countItems(t, st.key)), badge([st.key]))))));
      }
    }
  }
  syncTopicChecks();
}

// Список подтем темы свёрнут, пока пользователь его не развернёт (состояние запоминается).
function isExpanded(t) {
  return (state.settings.expanded || []).includes(t.file);
}

function toggleExpanded(t) {
  const set = new Set(state.settings.expanded || []);
  if (set.has(t.file)) set.delete(t.file);
  else set.add(t.file);
  state.settings.expanded = [...set];
  store.saveSettings(state.settings);
  const open = set.has(t.file);
  document.querySelector(`#topic-list [data-subs-of="${CSS.escape(t.file)}"]`).hidden = !open;
  document.querySelector(`#topic-list [data-toggle="${CSS.escape(t.file)}"]`).setAttribute("aria-expanded", String(open));
}

// Отметки в списке тем по state.settings.topics; тема, выбранная частично, — «неопределённая».
function syncTopicChecks() {
  const sel = new Set(state.settings.topics);
  for (const t of state.topics) {
    const box = document.querySelector(`#topic-list input[data-topic="${CSS.escape(t.file)}"]`);
    if (!box) continue;
    const subsOn = t.subtopics.filter((st) => sel.has(t.file) || sel.has(st.key));
    for (const st of t.subtopics) {
      const sb = document.querySelector(`#topic-list input[data-sub="${CSS.escape(st.key)}"]`);
      if (sb) sb.checked = subsOn.includes(st);
    }
    box.checked = sel.has(t.file);
    box.indeterminate = !sel.has(t.file) && subsOn.length > 0;
    const toggle = document.querySelector(`#topic-list [data-toggle="${CSS.escape(t.file)}"]`);
    if (toggle) {
      const n = t.subtopics.length;
      toggle.textContent = box.indeterminate
        ? i18n.t("setup.subtopicsPartial", { k: subsOn.length, n })
        : i18n.t("setup.subtopics", { n });
    }
  }
}

function setSelection(keys) {
  state.settings.topics = keys;
  syncTopicChecks();
  saveSettings();
}

function toggleTopic(t, on) {
  const own = new Set([t.file, ...t.subtopics.map((st) => st.key)]);
  setSelection([...state.settings.topics.filter((k) => !own.has(k)), ...(on ? [t.file] : [])]);
}

// Если отмечены все подтемы, хранится файл темы — тогда в выбор попадут и подтемы, добавленные позже.
function toggleSubtopic(t, st, on) {
  const sel = new Set(state.settings.topics);
  const chosen = new Set(t.subtopics.filter((x) => sel.has(t.file) || sel.has(x.key)).map((x) => x.key));
  if (on) chosen.add(st.key);
  else chosen.delete(st.key);
  const own = new Set([t.file, ...t.subtopics.map((x) => x.key)]);
  const rest = state.settings.topics.filter((k) => !own.has(k));
  setSelection(chosen.size === t.subtopics.length ? [...rest, t.file] : [...rest, ...chosen]);
}

function renderOptions() {
  const s = state.settings;
  $("#opt-count").value = s.gaps;
  $("#opt-hints").checked = s.hints;
  for (const r of document.querySelectorAll('input[name="kind"]')) r.checked = r.value === s.kind;
  for (const r of document.querySelectorAll('input[name="bank"]')) r.checked = r.value === s.bank;
  for (const r of document.querySelectorAll('input[name="mode"]')) r.checked = r.value === s.mode;
  $("#row-bank").hidden = s.mode === "type"; // в режиме ввода банка нет
  updatePoolInfo();
}

function readOptions() {
  const s = state.settings;
  s.gaps = Math.max(1, Math.min(100, parseInt($("#opt-count").value, 10) || DEFAULT_SETTINGS.gaps));
  s.hints = $("#opt-hints").checked;
  s.kind = document.querySelector('input[name="kind"]:checked')?.value || "all";
  s.bank = document.querySelector('input[name="bank"]:checked')?.value || "answers";
  s.mode = document.querySelector('input[name="mode"]:checked')?.value || "drag";
  s.lemma = $("#opt-lemma").value;
  $("#row-bank").hidden = s.mode === "type";
  saveSettings();
}

function saveSettings() {
  store.saveSettings(state.settings);
  updatePoolInfo();
}

function selectedTopics() {
  return applySelection(state.topics, state.settings.topics);
}

// Название темы в заголовке раунда: у частично выбранной — подтемы (номера, если заголовки с них начинаются).
function topicLabel(t) {
  const lang = getLang();
  const title = topicTitle(t);
  if (!t.partial) return title;
  const sub = (st) => localized(st, "title", lang);
  if (t.subtopics.length === 1) return `${title}: ${sub(t.subtopics[0])}`;
  return `${title} (${t.subtopics.map((st) => sub(st).match(/^(\d+)\./)?.[1] ?? sub(st)).join(", ")})`;
}

// Список «Слово»: леммы выбранных тем, сгруппированные по темам.
function renderLemmaSelect() {
  const s = state.settings;
  const groups = listLemmas(selectedTopics(), s.kind).filter((g) => g.lemmas.length);
  const known = new Set(groups.flatMap((g) => g.lemmas.map((l) => l.key)));
  if (s.lemma && !known.has(s.lemma)) {
    s.lemma = ""; // выбранного слова нет в выбранных темах
    store.saveSettings(s);
  }
  const select = $("#opt-lemma");
  select.replaceChildren(
    h("option", { value: "" }, i18n.t("setup.allWords")),
    ...groups.map((g) =>
      h("optgroup", { label: topicTitle(g.topic) },
        g.lemmas.map((l) => h("option", { value: l.key }, i18n.t("setup.lemmaOption", { label: l.label, gaps: i18n.plural(l.count, "plural.gap") })))))
  );
  select.value = s.lemma;
  $("#row-lemma").hidden = !groups.length; // у выбранных тем тренировка одного слова не предусмотрена
}

function updatePoolInfo() {
  renderLemmaSelect();
  const pool = poolFor(selectedTopics(), state.settings);
  const n = pool.length;
  const gaps = pool.reduce((sum, u) => sum + u.active, 0);
  $("#pool-info").textContent = n
    ? i18n.t("setup.pool", { items: i18n.plural(n, "plural.item"), gaps: i18n.plural(gaps, "plural.gap") })
    : i18n.t("setup.poolEmpty");
  $("#start").disabled = n === 0;
}

// ---------- Раунд ----------

function startRound() {
  readOptions();
  const topics = selectedTopics();
  const mode = state.settings.mode === "type" ? "type" : "drag";
  // в режиме ввода банка нет, поэтому и лишние формы не нужны
  const opts = mode === "type" ? { ...state.settings, bank: "answers" } : state.settings;
  const r = buildRound(topics, opts, store.loadStats().items);
  if (!r.units.length) return;
  state.round = {
    ...r,
    mode,
    typed: new Map(), // gapId → введённый текст (режим ввода)
    activeInput: null, // последнее поле ввода в фокусе — туда вставляются буквы с панели
    gapById: new Map(r.gaps.map((g) => [g.id, g])),
    chipById: new Map(r.chips.map((c) => [c.id, c])),
    placement: new Map(), // gapId → chipId
    status: new Map(), // gapId → "correct" | "wrong"
    selected: null,
    recorded: false,
    revealed: false,
    topics, // для заголовка раунда: его пересчитывают при смене языка
    lemmaLabel: state.settings.lemma ? r.gaps[0]?.hint : "",
  };
  renderRound();
  show("round");
}

function renderRound() {
  const r = state.round;
  renderRoundTitle();
  r.refPaths = [...new Set(r.units.flatMap((u) => u.topic.refPaths))];
  $("#round-ref").hidden = !r.refPaths.length;

  const chipEls = new Map();
  if (r.mode === "drag") {
    for (const c of r.chips) {
      chipEls.set(c.id, h("button", { type: "button", class: "chip", dataset: { chip: c.id } }, c.text));
    }
  }
  r.chipEls = chipEls;

  const bank = $("#bank");
  bank.replaceChildren(); // плашки прошлого раунда (их id совпадают с новыми)
  bank.classList.toggle("letters", r.mode === "type");
  bank.setAttribute("aria-label", i18n.t(r.mode === "type" ? "round.letters" : "round.bank"));
  if (r.mode === "type") {
    bank.append(
      h("span", { class: "letters-label" }, i18n.t("round.lettersLabel")),
      ...LT_LETTERS.map((ch) => h("button", { type: "button", class: "letter", dataset: { letter: ch }, tabindex: "-1" }, ch))
    );
  }
  const units = $("#units");
  units.replaceChildren();
  $("#round-scroll").scrollTop = 0;
  r.gapEls = new Map();
  for (const unit of r.units) {
    let gi = 0;
    const paragraphs = unit.item.paragraphs.map((segs) =>
      h("p", {}, segs.map((s) => {
        if (!s.gap) return s;
        const slot = unit.slots[gi++];
        if (slot == null) return h("span", { class: "given" }, s.answers[0]); // пропуск другого слова — уже заполнен
        const gap = r.gapById.get(slot);
        const hint = showHint(unit.topic, unit.item) && gap.hint ? h("span", { class: "hint" }, gap.hint) : null;
        const el = r.mode === "type"
          ? h("span", { class: "gap typed", dataset: { gap: gap.id } },
              h("input", {
                type: "text",
                class: "gap-input",
                autocomplete: "off",
                autocapitalize: "off",
                autocorrect: "off",
                spellcheck: "false",
                enterkeyhint: "next",
                "aria-label": gap.hint ? i18n.t("round.gapHint", { hint: gap.hint }) : i18n.t("round.gap"),
                dataset: { gap: gap.id },
                style: `width:${inputWidth("", gap)}ch`,
              }),
              hint)
          : h("span", {
              class: "gap",
              role: "button",
              tabindex: "0",
              "aria-label": i18n.t("round.gap"),
              dataset: { gap: gap.id },
            },
              h("span", { class: "slot" }),
              hint);
        r.gapEls.set(gap.id, el);
        return el;
      })));
    units.append(
      h("li", { class: "unit " + unit.item.type },
        unit.item.type === "text" && unit.item.title ? h("h3", { class: "text-title" }, unit.item.title) : null,
        paragraphs));
  }
  $("#result").hidden = true;
  layout();
}

function showHint(topic, item) {
  return state.settings.hints || hintsAlways(topic, item);
}

const LT_LETTERS = ["ą", "č", "ę", "ė", "į", "š", "ų", "ū", "ž"];

// Ширина поля в символах: растёт по мере ввода, но не выдаёт длину ответа.
function inputWidth(value, gap) {
  return Math.max(6, (gap.hint || "").length + 2, value.length + 2);
}

// Обновить пропуски (и банк) согласно состоянию раунда.
function layout() {
  const r = state.round;
  for (const [gid, el] of r.gapEls) {
    const st = r.status.get(gid);
    el.classList.toggle("correct", st === "correct");
    el.classList.toggle("wrong", st === "wrong");
    el.classList.toggle("locked", st === "correct");
    const reveal = el.querySelector(".reveal");
    if (r.revealed && st !== "correct") {
      const answer = r.gapById.get(gid).answers.join(" / ");
      if (!reveal) el.append(h("span", { class: "reveal" }, answer));
    } else {
      reveal?.remove();
    }
  }
  const filled = r.mode === "type" ? layoutTyped() : layoutChips();
  $("#round-progress").textContent = i18n.t("round.progress", { filled, total: r.gaps.length });

  const allCorrect = r.gaps.every((g) => r.status.get(g.id) === "correct");
  const hasWrong = [...r.status.values()].includes("wrong");
  $("#check").hidden = allCorrect;
  $("#fix").hidden = !hasWrong;
  $("#reveal").hidden = !r.recorded || allCorrect || r.revealed;
}

// Режим ввода: поля заполнены тем, что ввёл пользователь; верные блокируются.
function layoutTyped() {
  const r = state.round;
  let filled = 0;
  for (const [gid, el] of r.gapEls) {
    const value = r.typed.get(gid) || "";
    if (value.trim()) filled++;
    el.classList.toggle("filled", !!value.trim());
    el.querySelector(".gap-input").readOnly = r.status.get(gid) === "correct";
  }
  return filled;
}

// Режим перетаскивания: разложить плашки по пропускам и банку.
function layoutChips() {
  const r = state.round;
  const placedIn = new Map([...r.placement].map(([g, c]) => [c, g]));
  const bank = $("#bank");
  for (const [gid, el] of r.gapEls) {
    const st = r.status.get(gid);
    el.classList.toggle("filled", r.placement.has(gid));
    el.classList.toggle("target", r.selected != null && st !== "correct");
    el.setAttribute("aria-label", r.placement.has(gid)
      ? i18n.t("round.gapFilled", { word: r.chipById.get(r.placement.get(gid)).text })
      : i18n.t("round.gapEmpty"));
    if (!r.placement.has(gid)) el.querySelector(".slot").replaceChildren();
  }
  for (const c of r.chips) {
    const el = r.chipEls.get(c.id);
    const gid = placedIn.get(c.id);
    el.classList.toggle("selected", r.selected === c.id);
    el.classList.toggle("locked", gid != null && r.status.get(gid) === "correct");
    if (gid != null) {
      const slot = r.gapEls.get(gid).querySelector(".slot");
      if (el.parentNode !== slot) slot.replaceChildren(el);
    } else {
      bank.append(el); // в исходном порядке
    }
  }
  bank.classList.toggle("empty", ![...r.chips].some((c) => !placedIn.has(c.id)));
  return r.placement.size;
}

function placeChip(chipId, gapId) {
  const r = state.round;
  if (r.status.get(gapId) === "correct") return;
  const fromGap = [...r.placement].find(([, c]) => c === chipId)?.[0];
  if (fromGap === gapId) return;
  const existing = r.placement.get(gapId);
  if (fromGap != null) {
    r.placement.delete(fromGap);
    r.status.delete(fromGap);
    if (existing != null) r.placement.set(fromGap, existing); // обмен
  }
  r.placement.set(gapId, chipId);
  r.status.delete(gapId);
  r.selected = null;
  layout();
}

function toBank(chipId) {
  const r = state.round;
  for (const [g, c] of r.placement) {
    if (c === chipId) {
      if (r.status.get(g) === "correct") return;
      r.placement.delete(g);
      r.status.delete(g);
    }
  }
  r.selected = null;
  layout();
}

function onDrop(chipId, target) {
  if (target?.classList.contains("gap")) placeChip(chipId, target.dataset.gap);
  else toBank(chipId);
}

function onRoundClick(e) {
  const r = state.round;
  if (!r) return;
  if (r.mode === "type") {
    const letter = e.target.closest(".letter");
    if (letter) insertLetter(letter.dataset.letter);
    else if (!e.target.closest(".gap-input")) e.target.closest(".gap.typed")?.querySelector(".gap-input").focus();
    return;
  }
  const gapEl = e.target.closest(".gap");
  const chipEl = e.target.closest(".chip");
  if (gapEl) {
    const gid = gapEl.dataset.gap;
    if (r.status.get(gid) === "correct") return;
    if (r.selected != null && r.selected !== r.placement.get(gid)) placeChip(r.selected, gid);
    else if (r.placement.has(gid)) toBank(r.placement.get(gid));
    return;
  }
  if (chipEl) {
    const id = chipEl.dataset.chip;
    r.selected = r.selected === id ? null : id;
    layout();
    return;
  }
  if (r.selected != null) {
    r.selected = null;
    layout();
  }
}

function onRoundKey(e) {
  if (e.key === "Enter" && e.target.classList.contains("gap-input")) {
    e.preventDefault();
    focusNextInput(e.target);
    return;
  }
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("gap")) {
    e.preventDefault();
    e.target.click();
  } else if (e.key === "Escape" && state.round?.selected != null) {
    state.round.selected = null;
    layout();
  }
}

function check() {
  const r = state.round;
  for (const g of r.gaps) {
    const answer = r.mode === "type" ? r.typed.get(g.id) : r.chipById.get(r.placement.get(g.id))?.text;
    r.status.set(g.id, isCorrect(g, answer) ? "correct" : "wrong");
  }
  r.selected = null;
  const correct = r.gaps.filter((g) => r.status.get(g.id) === "correct").length;

  if (!r.recorded) {
    r.recorded = true;
    r.firstScore = correct;
    store.recordRound(
      r.units.map((u) => ({
        topicFile: statsKey(u.topic, u.item),
        itemId: u.item.id,
        gaps: u.gapIds.length,
        correct: u.gapIds.filter((id) => r.status.get(id) === "correct").length,
      }))
    );
  }

  r.score = correct;
  $("#result").hidden = false;
  renderResult();
  layout();
}

// Итог проверки (отдельно, чтобы перерисовать его при смене языка).
function renderResult() {
  const r = state.round;
  const correct = r.score;
  const total = r.gaps.length;
  const res = $("#result");
  res.className = "result " + (correct === total ? "good" : "");
  const [before, after] = i18n.t("round.score").split("{score}");
  res.replaceChildren(
    correct === total
      ? h("strong", {}, i18n.t(r.firstScore === total ? "round.perfect" : "round.allCorrect"))
      : h("span", {}, before, h("strong", {}, i18n.t("round.scoreOf", { correct, total })), after,
          r.firstScore !== correct ? i18n.t("round.firstTry", { n: r.firstScore }) : "")
  );
}

function renderRoundTitle() {
  const r = state.round;
  $("#round-topics").textContent = r.topics.map(topicLabel).join(" · ")
    + (r.lemmaLabel ? " · " + i18n.t("round.word", { word: r.lemmaLabel }) : "");
}

function fixMistakes() {
  const r = state.round;
  const wrong = [...r.status].filter(([, st]) => st === "wrong").map(([g]) => g);
  for (const g of wrong) {
    r.placement.delete(g); // в режиме ввода текст остаётся — его удобнее поправить, чем набирать заново
    r.status.delete(g);
  }
  $("#result").hidden = true;
  layout();
  if (r.mode === "type" && wrong.length) {
    const input = r.gapEls.get(wrong[0]).querySelector(".gap-input");
    input.focus();
    input.select();
  }
}

// ---------- Режим ввода ----------

function onTypedInput(e) {
  const input = e.target;
  if (!input.classList?.contains("gap-input")) return;
  const r = state.round;
  const gid = input.dataset.gap;
  r.typed.set(gid, input.value);
  input.style.width = inputWidth(input.value, r.gapById.get(gid)) + "ch";
  if (r.status.get(gid) === "wrong") r.status.delete(gid); // правка снимает красную подсветку
  layout();
}

function insertLetter(ch) {
  const r = state.round;
  let input = r.activeInput;
  if (!input || !input.isConnected || input.readOnly) {
    input = [...document.querySelectorAll("#units .gap-input")].find((i) => !i.readOnly);
    if (!input) return;
  }
  input.focus();
  input.setRangeText(ch, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, "end");
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

// Enter: к следующему незаполненному полю; если таких нет — проверить.
function focusNextInput(current) {
  const inputs = [...document.querySelectorAll("#units .gap-input")].filter((i) => !i.readOnly);
  const after = inputs.slice(inputs.indexOf(current) + 1).concat(inputs.slice(0, inputs.indexOf(current)));
  const next = after.find((i) => !i.value.trim());
  if (next) next.focus();
  else {
    current.blur();
    check();
  }
}

function reveal() {
  state.round.revealed = true;
  layout();
}

// ---------- Справка ----------

let openedRefs = null; // { paths, active } — чтобы перерисовать окно при смене языка

function openRefs(paths, active = 0) {
  const dlg = $("#ref-dialog");
  const refs = paths.map((p) => state.refs.get(p)).filter(Boolean).map(refText);
  if (!refs.length) return;
  const show = (k) => {
    openedRefs = { paths, active: k };
    const ref = refs[k];
    $("#ref-title").textContent = ref.title;
    const tabs = $("#ref-tabs");
    tabs.replaceChildren(
      ...(refs.length > 1
        ? refs.map((x, i) =>
            h("button", { type: "button", class: "ref-tab" + (i === k ? " active" : ""), onclick: () => show(i) }, x.title))
        : [])
    );
    tabs.hidden = refs.length < 2;
    const body = $("#ref-body");
    body.innerHTML = renderMarkdown(stripTitle(ref.src));
    body.scrollTop = 0;
  };
  show(active);
  if (!dlg.open) dlg.showModal();
}

function renderRefList() {
  const box = $("#ref-list");
  box.replaceChildren();
  if (!state.refs.size) {
    box.append(h("p", { class: "muted" }, i18n.t("refs.none")));
    return;
  }
  const usedBy = new Map();
  for (const t of state.topics) {
    for (const path of t.refPaths) usedBy.set(path, [...(usedBy.get(path) || []), topicTitle(t)]);
  }
  const refs = [...state.refs.values()].sort((a, b) => refText(a).title.localeCompare(refText(b).title, "lt"));
  for (const ref of refs) {
    box.append(
      h("button", { type: "button", class: "ref-item", onclick: () => openRefs([ref.path]) },
        h("span", { class: "topic-title" }, refText(ref).title),
        usedBy.has(ref.path) ? h("span", { class: "topic-desc" }, i18n.t("refs.usedBy", { topics: usedBy.get(ref.path).join(", ") })) : null));
  }
}

// ---------- Статистика ----------

function pct(a, b) {
  return b ? Math.round((100 * a) / b) : 0;
}

function renderStats() {
  const stats = store.loadStats();
  const box = $("#stats-table");
  box.replaceChildren();
  const titles = new Map();
  for (const t of state.topics) {
    titles.set(t.file, topicTitle(t));
    for (const st of t.subtopics) titles.set(st.key, `${topicTitle(t)}: ${localized(st, "title", getLang())}`);
  }
  const rows = Object.entries(stats.topics).sort((a, b) => (b[1].last || "").localeCompare(a[1].last || ""));
  if (!rows.length) {
    box.append(h("p", { class: "muted" }, i18n.t("stats.empty")));
    return;
  }
  box.append(
    h("table", { class: "stats" },
      h("thead", {}, h("tr", {},
        h("th", {}, i18n.t("stats.topic")), h("th", {}, i18n.t("stats.rounds")), h("th", {}, i18n.t("stats.gaps")),
        h("th", {}, i18n.t("stats.correct")), h("th", {}, i18n.t("stats.last")))),
      h("tbody", {},
        rows.map(([file, s]) => {
          const p = pct(s.correct, s.gaps);
          return h("tr", {},
            h("td", {}, titles.get(file) || h("span", { class: "muted" }, file)),
            h("td", { class: "num" }, String(s.rounds)),
            h("td", { class: "num" }, String(s.gaps)),
            h("td", { class: "bar-cell" },
              h("span", { class: "bar" }, h("span", { style: `width:${p}%` })),
              h("span", { class: "num" }, p + "%")),
            h("td", { class: "muted" }, s.last ? new Date(s.last).toLocaleDateString(i18n.LOCALES[getLang()]) : "—"));
        }))));
}

// ---------- Язык ----------

// Тексты из index.html: data-i18n — текст, data-i18n-html — HTML из словаря (пустая строка скрывает элемент),
// data-i18n-title и data-i18n-aria-label — атрибуты.
function applyStaticTexts() {
  document.documentElement.lang = getLang();
  document.title = i18n.t("doc.title");
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = i18n.t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-html]")) {
    const html = i18n.t(el.dataset.i18nHtml);
    el.innerHTML = html;
    el.hidden = !html;
  }
  for (const el of document.querySelectorAll("[data-i18n-title]")) el.title = i18n.t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll("[data-i18n-aria-label]")) el.setAttribute("aria-label", i18n.t(el.dataset.i18nAriaLabel));
  $("#lang").value = getLang();
}

// Язык: выбранный пользователем или первый подходящий из настроек браузера.
function initLang() {
  i18n.setLang(state.settings.lang || i18n.detectLang(navigator.languages?.length ? navigator.languages : [navigator.language]));
  $("#lang").replaceChildren(...Object.entries(LANGS).map(([code, name]) => h("option", { value: code, title: name }, i18n.LANG_SHORT[code])));
  applyStaticTexts();
}

function changeLang(lang) {
  state.settings.lang = i18n.setLang(lang);
  store.saveSettings(state.settings);
  applyStaticTexts();
  renderLoadErrors();
  renderTopicList();
  updatePoolInfo();
  renderRefList();
  renderStats();
  if (state.round) {
    renderRoundTitle();
    const bank = $("#bank");
    bank.setAttribute("aria-label", i18n.t(state.round.mode === "type" ? "round.letters" : "round.bank"));
    const label = bank.querySelector(".letters-label");
    if (label) label.textContent = i18n.t("round.lettersLabel");
    for (const [gid, el] of state.round.gapEls) {
      const input = el.querySelector(".gap-input");
      const hint = state.round.gapById.get(gid).hint;
      if (input) input.setAttribute("aria-label", hint ? i18n.t("round.gapHint", { hint }) : i18n.t("round.gap"));
    }
    if (!$("#result").hidden) renderResult();
    layout();
  }
  if ($("#ref-dialog").open && openedRefs) openRefs(openedRefs.paths, openedRefs.active);
}

// ---------- Запуск ----------

async function init() {
  initLang();
  $("#lang").addEventListener("change", (e) => changeLang(e.target.value));
  for (const b of document.querySelectorAll(".nav-btn")) {
    b.addEventListener("click", () => {
      show(b.dataset.nav);
    });
  }
  $("#logo").addEventListener("click", (e) => {
    e.preventDefault();
    show("home");
  });
  $("#home-start").addEventListener("click", () => show("setup"));
  $("#home-refs").addEventListener("click", () => show("refs"));
  $("#select-all").addEventListener("click", () => {
    setSelection(state.topics.map((t) => t.file));
  });
  $("#select-none").addEventListener("click", () => {
    setSelection([]);
  });
  for (const el of document.querySelectorAll(".options input, .options select")) el.addEventListener("change", readOptions);
  $("#start").addEventListener("click", startRound);
  $("#check").addEventListener("click", check);
  $("#fix").addEventListener("click", fixMistakes);
  $("#reveal").addEventListener("click", reveal);
  $("#again").addEventListener("click", startRound);
  $("#to-setup").addEventListener("click", () => show("setup"));
  $("#round-ref").addEventListener("click", () => openRefs(state.round.refPaths));
  const dlg = $("#ref-dialog");
  $("#ref-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close(); // клик по фону вокруг окна
  });
  $("#stats-reset").addEventListener("click", () => {
    if (confirm(i18n.t("stats.confirmReset"))) {
      store.resetStats();
      renderStats();
    }
  });

  const area = $("#round-area");
  area.addEventListener("click", onRoundClick);
  area.addEventListener("keydown", onRoundKey);
  area.addEventListener("input", onTypedInput);
  area.addEventListener("focusin", (e) => {
    if (e.target.classList?.contains("gap-input") && state.round) state.round.activeInput = e.target;
  });
  // нажатие на кнопку буквы не должно уводить фокус из поля ввода
  area.addEventListener("mousedown", (e) => {
    if (e.target.closest(".letter")) e.preventDefault();
  });
  enableDragAndDrop(area, onDrop);

  await loadTopics();
  const known = new Set(state.topics.flatMap((t) => [t.file, ...t.subtopics.map((st) => st.key)]));
  // Если база загрузилась без ошибок, статистика удалённых тем и заданий больше не нужна.
  if (!state.loadErrors.length && state.topics.length) {
    store.pruneStats(known, new Set(state.topics.flatMap((t) => t.items.map((it) => it.id))));
  }
  state.settings.topics = state.settings.topics.filter((f) => known.has(f));
  if (!state.settings.topics.length && state.topics.length) state.settings.topics = [state.topics[0].file];
  renderLoadErrors();
  renderTopicList();
  renderOptions();
  window.addEventListener("popstate", () => show(screenFromHash(), { push: false }));
  show(screenFromHash(), { push: false });
}

init();
