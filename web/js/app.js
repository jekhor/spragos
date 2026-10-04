import { parseTopic, itemGaps } from "./parser.js";
import { buildRound, countItems, isCorrect } from "./round.js";
import { enableDragAndDrop } from "./dnd.js";
import * as store from "./stats.js";
import { renderMarkdown, markdownTitle, stripTitle } from "./markdown.js";

const DEFAULT_SETTINGS = {
  topics: [],
  gaps: 12,
  kind: "all",
  bank: "answers",
  hints: true,
  mode: "drag", // "drag" — перетаскивание из банка, "type" — ввод с клавиатуры
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
  refs: new Map(), // путь .md относительно data/ → { path, title, src }
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
  for (const r of refs) if (r) state.refs.set(r.path, r);
  for (const t of topics) {
    if (!t) continue;
    state.loadErrors.push(...t.errors);
    t.refPath = resolveRef(t);
    if (t.items.length) state.topics.push(t);
  }
}

// Справка темы: @reference (путь относительно data/) или файл .md с тем же именем.
function resolveRef(topic) {
  if (topic.reference) {
    const path = topic.reference.replace(/^\/+/, "");
    if (state.refs.has(path)) return path;
    state.loadErrors.push({ file: topic.file, line: 0, message: `справка «${topic.reference}» не найдена в data/` });
    return null;
  }
  const same = topic.file.replace(/\.txt$/, ".md");
  return state.refs.has(same) ? same : null;
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
      h("summary", {}, `Ошибки в файлах базы: ${state.loadErrors.length}`),
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
    list.append(h("p", { class: "muted" }, "В папке data/ нет ни одной темы."));
    return;
  }
  const stats = store.loadStats();
  const groups = new Map();
  for (const t of state.topics) {
    const g = t.group || "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  for (const [group, topics] of groups) {
    if (group) list.append(h("h3", { class: "group" }, group));
    for (const t of topics) {
      const c = countItems(t);
      const st = stats.topics[t.file];
      const parts = [];
      if (c.sentence) parts.push(`${c.sentence} предл.`);
      if (c.text) parts.push(`${c.text} текст.`);
      list.append(
        h("label", { class: "topic" },
          h("input", {
            type: "checkbox",
            value: t.file,
            checked: state.settings.topics.includes(t.file),
            onchange: onTopicToggle,
          }),
          h("span", { class: "topic-body" },
            h("span", { class: "topic-title" }, t.title),
            t.description ? h("span", { class: "topic-desc" }, t.description) : null),
          h("span", { class: "topic-meta" },
            h("span", {}, parts.join(", ")),
            t.refPath
              ? h("button", {
                  type: "button",
                  class: "link ref-link",
                  title: "Грамматическая справка",
                  onclick: (e) => {
                    e.preventDefault();
                    openRefs([t.refPath]);
                  },
                }, "справка")
              : null,
            st && st.gaps ? h("span", { class: "badge" }, pct(st.correct, st.gaps) + "%") : null)));
    }
  }
}

function onTopicToggle() {
  state.settings.topics = [...document.querySelectorAll("#topic-list input:checked")].map((i) => i.value);
  saveSettings();
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
  $("#row-bank").hidden = s.mode === "type";
  saveSettings();
}

function saveSettings() {
  store.saveSettings(state.settings);
  updatePoolInfo();
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  return `${n} ${word}`;
}

function selectedTopics() {
  return state.topics.filter((t) => state.settings.topics.includes(t.file));
}

function updatePoolInfo() {
  const kind = state.settings.kind;
  const items = selectedTopics()
    .flatMap((t) => t.items)
    .filter((it) => kind === "all" || it.type === kind);
  const n = items.length;
  const gaps = items.reduce((s, it) => s + itemGaps(it).length, 0);
  $("#pool-info").textContent = n
    ? `в базе: ${plural(n, "задание", "задания", "заданий")}, ${plural(gaps, "пропуск", "пропуска", "пропусков")}`
    : "выберите хотя бы одну тему";
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
    topicNames: topics.map((t) => t.title),
  };
  renderRound();
  show("round");
}

function renderRound() {
  const r = state.round;
  $("#round-topics").textContent = r.topicNames.join(" · ");
  r.refPaths = [...new Set(r.units.map((u) => u.topic.refPath).filter(Boolean))];
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
  bank.setAttribute("aria-label", r.mode === "type" ? "Литовские буквы" : "Банк слов");
  if (r.mode === "type") {
    bank.append(
      h("span", { class: "letters-label" }, "Литовские буквы:"),
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
        const gap = r.gapById.get(unit.gapIds[gi++]);
        const hint = showHint(unit.topic) && gap.hint ? h("span", { class: "hint" }, gap.hint) : null;
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
                "aria-label": gap.hint ? `пропуск, начальная форма: ${gap.hint}` : "пропуск",
                dataset: { gap: gap.id },
                style: `width:${inputWidth("", gap)}ch`,
              }),
              hint)
          : h("span", {
              class: "gap",
              role: "button",
              tabindex: "0",
              "aria-label": "пропуск",
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

function showHint(topic) {
  return state.settings.hints || topic.hints === "always";
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
  $("#round-progress").textContent = `заполнено ${filled} из ${r.gaps.length}`;

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
    el.setAttribute("aria-label", r.placement.has(gid) ? "пропуск: " + r.chipById.get(r.placement.get(gid)).text : "пустой пропуск");
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
        topicFile: u.topic.file,
        itemId: u.item.id,
        gaps: u.gapIds.length,
        correct: u.gapIds.filter((id) => r.status.get(id) === "correct").length,
      }))
    );
  }

  const total = r.gaps.length;
  const res = $("#result");
  res.hidden = false;
  res.className = "result " + (correct === total ? "good" : "");
  res.replaceChildren(
    correct === total
      ? h("strong", {}, r.firstScore === total ? "Puiku! Всё верно с первой попытки." : "Теперь всё верно!")
      : h("span", {}, "Верно ", h("strong", {}, `${correct} из ${total}`),
          r.firstScore !== correct ? ` (с первой попытки: ${r.firstScore})` : "")
  );
  layout();
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

function openRefs(paths, active = 0) {
  const dlg = $("#ref-dialog");
  const refs = paths.map((p) => state.refs.get(p)).filter(Boolean);
  if (!refs.length) return;
  const show = (k) => {
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
    box.append(h("p", { class: "muted" }, "В папке data/ пока нет ни одной справки (.md)."));
    return;
  }
  const usedBy = new Map();
  for (const t of state.topics) {
    if (t.refPath) usedBy.set(t.refPath, [...(usedBy.get(t.refPath) || []), t.title]);
  }
  const refs = [...state.refs.values()].sort((a, b) => a.title.localeCompare(b.title, "lt"));
  for (const ref of refs) {
    box.append(
      h("button", { type: "button", class: "ref-item", onclick: () => openRefs([ref.path]) },
        h("span", { class: "topic-title" }, ref.title),
        usedBy.has(ref.path) ? h("span", { class: "topic-desc" }, "к теме: " + usedBy.get(ref.path).join(", ")) : null));
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
  const titles = new Map(state.topics.map((t) => [t.file, t.title]));
  const rows = Object.entries(stats.topics).sort((a, b) => (b[1].last || "").localeCompare(a[1].last || ""));
  if (!rows.length) {
    box.append(h("p", { class: "muted" }, "Пока нет ни одного завершённого раунда."));
    return;
  }
  box.append(
    h("table", { class: "stats" },
      h("thead", {}, h("tr", {},
        h("th", {}, "Тема"), h("th", {}, "Раундов"), h("th", {}, "Пропусков"),
        h("th", {}, "Верно"), h("th", {}, "Последний раз"))),
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
            h("td", { class: "muted" }, s.last ? new Date(s.last).toLocaleDateString("ru-RU") : "—"));
        }))));
}

// ---------- Запуск ----------

async function init() {
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
    state.settings.topics = state.topics.map((t) => t.file);
    renderTopicList();
    saveSettings();
  });
  $("#select-none").addEventListener("click", () => {
    state.settings.topics = [];
    renderTopicList();
    saveSettings();
  });
  for (const el of document.querySelectorAll(".options input")) el.addEventListener("change", readOptions);
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
    if (confirm("Сбросить всю статистику?")) {
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
  const known = new Set(state.topics.map((t) => t.file));
  state.settings.topics = state.settings.topics.filter((f) => known.has(f));
  if (!state.settings.topics.length && state.topics.length) state.settings.topics = [state.topics[0].file];
  renderLoadErrors();
  renderTopicList();
  renderOptions();
  window.addEventListener("popstate", () => show(screenFromHash(), { push: false }));
  show(screenFromHash(), { push: false });
}

init();
