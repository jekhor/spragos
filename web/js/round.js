// Сборка раунда: выбор единиц, банк слов, отвлекающие формы, проверка ответов.
import { normalize, itemGaps, itemSubtopic } from "./parser.js";

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

// Набрать единицы так, чтобы суммарно вышло примерно target пропусков.
// Единицу, с которой получился бы заметный перебор, пропускаем и пробуем следующую.
function pickUnits(pool, target, weightOf, rnd) {
  const order = weightedSample(pool, pool.length, weightOf, rnd);
  const slack = Math.max(2, Math.round(target * 0.25));
  const units = [];
  let total = 0;
  for (const u of order) {
    if (total >= target) break;
    const n = u.active ?? itemGaps(u.item).length;
    if (total + n > target + slack) continue;
    units.push(u);
    total += n;
  }
  // ни одна единица не влезла (например, остались только длинные тексты) — берём одну
  if (!units.length && order.length) units.push(order[0]);
  return units;
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
    out.push({ ...t, subtopics: subs, items: t.items.filter((it) => chosen.has(it.subtopic)), partial: true });
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
      const active = itemGaps(item).filter(isActive).length;
      if (active) pool.push({ topic, item, active });
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
  const units = pickUnits(pool, settings.gaps, weight, rnd);

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

// Кандидаты в отвлекающие формы для пропуска — в порядке приоритета.
// При тренировке одного слова общий список темы не используется: там формы других слов.
function distractorCandidates(gap, rnd, oneWord = false) {
  const topic = gap.unit.topic;
  const explicit = shuffle(gap.distractors, rnd);
  let sameLemma = [];
  if (gap.hint) {
    const lemma = normalize(gap.hint);
    sameLemma = topic.items
      .flatMap(itemGaps)
      .filter((g) => g.hint && normalize(g.hint) === lemma)
      .flatMap((g) => g.answers);
  }
  // запас лишних форм: у подтемы свой, если задан
  const pool = itemSubtopic(topic, gap.unit.item)?.distractors.length ? itemSubtopic(topic, gap.unit.item).distractors : topic.distractors;
  return [...explicit, ...shuffle(sameLemma, rnd), ...(oneWord ? [] : shuffle(pool, rnd))];
}

export function isCorrect(gap, chipText) {
  return chipText != null && gap.accept.has(normalize(chipText));
}
