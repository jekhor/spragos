// Сборка раунда: выбор единиц, банк слов, отвлекающие формы, проверка ответов.
import { normalize, itemGaps, itemSubtopic } from "./parser.js";
import { exactForms } from "./paradigms.js";

export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Взвешенная выборка без возвращения.
function weightedSample(pool, n, weightOf, rnd) {
  const rest = pool.slice();
  const picked = [];
  while (picked.length < n && rest.length) {
    const total = rest.reduce((s, x) => s + weightOf(x), 0);
    let r = rnd() * total;
    let k = 0;
    while (k < rest.length - 1 && (r -= weightOf(rest[k])) > 0) k++;
    picked.push(rest.splice(k, 1)[0]);
  }
  return picked;
}

// Сколько пропусков одного слова собирать в раунде при группировке: при 12 пропусках — по 3.
export function perWord(target) {
  return Math.max(2, Math.min(4, Math.round(target / 4)));
}

// Набрать единицы так, чтобы суммарно вышло примерно target пропусков.
// Единицу, с которой получился бы заметный перебор, пропускаем и пробуем следующую.
// group: собирать по нескольку пропусков на одно слово (подсказку). Иначе в режиме перетаскивания с банком
// «только ответы» все слова в банке разные и ответ находится по корню, а не по форме.
function pickUnits(pool, target, weightOf, rnd, group = false) {
  const order = weightedSample(pool, pool.length, weightOf, rnd);
  const slack = Math.max(2, Math.round(target * 0.25));
  const gapsOf = (u) => u.active ?? itemGaps(u.item).length;
  const fits = (u) => total + gapsOf(u) <= target + slack;
  const want = perWord(target);
  const units = [];
  const used = new Set();
  const words = new Map(); // слово → сколько его пропусков уже в раунде
  let total = 0;
  while (total < target) {
    let next = null;
    if (group) {
      const open = new Set([...words].filter(([, n]) => n < want).map(([w]) => w));
      if (open.size) next = order.find((u) => !used.has(u) && fits(u) && u.words.some((w) => open.has(w)));
    }
    next ??= order.find((u) => !used.has(u) && fits(u));
    if (!next) break;
    used.add(next);
    units.push(next);
    total += gapsOf(next);
    for (const w of next.words ?? []) words.set(w, (words.get(w) || 0) + 1);
  }
  // ни одна единица не влезла (например, остались только длинные тексты) — берём одну
  if (!units.length && order.length) units.push(order[0]);
  // при группировке задания одного слова шли бы подряд — перемешиваем
  return group ? shuffle(units, rnd) : units;
}

function isUpper(ch) {
  return ch !== ch.toLocaleLowerCase("lt");
}

// Подогнать регистр первой буквы отвлекающей формы под ответ пропуска.
function matchCase(word, model) {
  const first = word[0];
  const rest = word.slice(1);
  return (isUpper(model[0]) ? first.toLocaleUpperCase("lt") : first.toLocaleLowerCase("lt")) + rest;
}

export function countItems(topic, subtopicKey = null) {
  const c = { sentence: 0, text: 0, gaps: 0 };
  for (const it of topic.items) {
    if (subtopicKey && it.subtopic !== subtopicKey) continue;
    c[it.type]++;
    c.gaps += itemGaps(it).length;
  }
  return c;
}

// Выбор тем в настройках: ключ темы — имя файла, ключ подтемы — "файл#заголовок".
// Файл темы с подтемами означает «все подтемы». Возвращает выбранные темы; у темы, выбранной частично,
// в items остаются только задания выбранных подтем, а в subtopics — сами эти подтемы.
export function applySelection(topics, keys) {
  const sel = new Set(keys);
  const out = [];
  for (const t of topics) {
    if (sel.has(t.file)) {
      out.push(t);
      continue;
    }
    const subs = t.subtopics.filter((st) => sel.has(st.key));
    if (!subs.length) continue;
    const chosen = new Set(subs.map((st) => st.key));
    out.push({ ...t, subtopics: subs, items: t.items.filter((it) => chosen.has(it.subtopic)), partial: true, source: t });
  }
  return out;
}

// Подсказки показываются всегда, если так сказано у темы или у подтемы задания (@hints: always).
export function hintsAlways(topic, item) {
  return topic.hints === "always" || itemSubtopic(topic, item)?.hints === "always";
}

// Ключ статистики: подтема, если она есть, иначе файл темы.
export function statsKey(topic, item) {
  return item.subtopic || topic.file;
}

/**
 * topics   — выбранные темы (результат parseTopic)
 * settings — { lemma (необязательно: тренировать одно слово), gaps (желаемое число пропусков), kind: "all"|"sentence"|"text", bank: "answers"|"distractors" }
 * itemErrors — { [itemId]: число ошибок } из статистики
 */
// Пропуск «активен», если он относится к выбранному слову (лемме-подсказке) или слово не выбрано.
export function activeGap(settings) {
  const lemma = settings.lemma ? normalize(settings.lemma) : null;
  return (g) => !lemma || (!!g.hint && normalize(g.hint) === lemma);
}

// Задания, подходящие под настройки (тип и слово), с числом активных пропусков в каждом.
export function poolFor(topics, settings) {
  const isActive = activeGap(settings);
  const pool = [];
  for (const topic of topics) {
    for (const item of topic.items) {
      if (settings.kind !== "all" && settings.kind !== item.type) continue;
      const gaps = itemGaps(item).filter(isActive);
      // words — подсказки активных пропусков (по одной на каждый пропуск): по ним группируется раунд
      if (gaps.length) pool.push({ topic, item, active: gaps.length, words: gaps.filter((g) => g.hint).map((g) => normalize(g.hint)) });
    }
  }
  return pool;
}

// Слова (леммы-подсказки) тем с числом пропусков — для выбора «тренировать одно слово».
// Темы с @word-practice: off (например, существительные — там выбирают подтему) не участвуют.
export function listLemmas(topics, kind = "all") {
  return topics.filter((t) => t.wordPractice !== false).map((topic) => {
    const byKey = new Map();
    for (const item of topic.items) {
      if (kind !== "all" && kind !== item.type) continue;
      for (const g of itemGaps(item)) {
        if (!g.hint) continue;
        const key = normalize(g.hint);
        const entry = byKey.get(key) || { key, label: g.hint, count: 0 };
        entry.count++;
        byKey.set(key, entry);
      }
    }
    const lemmas = [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, "lt"));
    return { topic, lemmas };
  });
}

export function buildRound(topics, settings, itemErrors = {}, rnd = Math.random) {
  const isActive = activeGap(settings);
  const pool = poolFor(topics, settings);
  const weight = (u) => 1 + Math.min(itemErrors[u.item.id] || 0, 5);
  // группировка по словам — только для перетаскивания (в режиме ввода банка нет)
  const units = pickUnits(pool, settings.gaps, weight, rnd, settings.mode !== "type" && !settings.lemma);

  let gapSeq = 0;
  const gaps = [];
  for (const unit of units) {
    unit.gapIds = []; // активные пропуски
    unit.slots = []; // для каждого пропуска задания: id активного пропуска или null (будет показан ответ)
    for (const g of itemGaps(unit.item)) {
      if (!isActive(g)) {
        unit.slots.push(null);
        continue;
      }
      const id = "g" + gapSeq++;
      gaps.push({ id, unit, ...g, accept: new Set(g.answers.map(normalize)) });
      unit.gapIds.push(id);
      unit.slots.push(id);
    }
  }

  let chipSeq = 0;
  const chips = gaps.map((g) => ({ id: "c" + chipSeq++, text: g.answers[0], distractor: false }));

  if (settings.bank === "distractors") {
    const used = new Set(gaps.flatMap((g) => [...g.accept]));
    for (const g of gaps) {
      const want = rnd() < 0.3 ? 2 : 1;
      let added = 0;
      for (const cand of distractorCandidates(g, rnd, !!settings.lemma)) {
        if (added >= want) break;
        const word = matchCase(cand, g.answers[0]);
        const key = normalize(word);
        if (used.has(key)) continue;
        used.add(key);
        chips.push({ id: "c" + chipSeq++, text: word, distractor: true });
        added++;
      }
    }
  }

  return { units, gaps, chips: shuffle(chips, rnd) };
}

function commonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Формы того же слова: ответы других пропусков всей темы (не только выбранных подтем) с той же подсказкой
// и формы из парадигмы (paradigms.js), если слово в ней есть. К утвердительной форме глагола — только
// утвердительные, к отрицательной — отрицательные. Сначала идут формы, похожие на ответ (общее начало):
// для «žaisdavo» — «žaisdavau», «žaisdavome», потом «žaidė», «žais».
function sameWordForms(gap, rnd) {
  if (!gap.hint) return [];
  const lemma = normalize(gap.hint);
  const full = gap.unit.topic.source || gap.unit.topic;
  const answers = full.items
    .flatMap(itemGaps)
    .filter((g) => g.hint && normalize(g.hint) === lemma)
    .flatMap((g) => g.answers);
  let forms = answers;
  const paradigm = exactForms(gap.hint);
  if (paradigm) {
    const neg = new Set(paradigm.neg);
    const negative = neg.has(normalize(gap.answers[0]));
    forms = [...answers, ...(negative ? paradigm.neg : paradigm.pos)].filter((w) => neg.has(normalize(w)) === negative);
  }
  const answer = normalize(gap.answers[0]);
  const unique = [...new Map(forms.map((w) => [normalize(w), w])).values()];
  return unique
    .map((w) => ({ w, score: commonPrefix(normalize(w), answer) + rnd() * 3 }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.w);
}

// Кандидаты в отвлекающие формы для пропуска — в порядке приоритета.
// При тренировке одного слова общий список темы не используется: там формы других слов.
function distractorCandidates(gap, rnd, oneWord = false) {
  const topic = gap.unit.topic;
  const explicit = shuffle(gap.distractors, rnd);
  // запас лишних форм: у подтемы свой, если задан
  const sub = itemSubtopic(topic, gap.unit.item);
  const pool = sub?.distractors.length ? sub.distractors : topic.distractors;
  return [...explicit, ...sameWordForms(gap, rnd), ...(oneWord ? [] : shuffle(pool, rnd))];
}

export function isCorrect(gap, chipText) {
  return chipText != null && gap.accept.has(normalize(chipText));
}
