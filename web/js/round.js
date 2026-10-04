// Сборка раунда: выбор единиц, банк слов, отвлекающие формы, проверка ответов.
import { normalize, itemGaps } from "./parser.js";

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
    const n = itemGaps(u.item).length;
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

export function countItems(topic) {
  const c = { sentence: 0, text: 0, gaps: 0 };
  for (const it of topic.items) {
    c[it.type]++;
    c.gaps += itemGaps(it).length;
  }
  return c;
}

/**
 * topics   — выбранные темы (результат parseTopic)
 * settings — { gaps (желаемое число пропусков), kind: "all"|"sentence"|"text", bank: "answers"|"distractors" }
 * itemErrors — { [itemId]: число ошибок } из статистики
 */
export function buildRound(topics, settings, itemErrors = {}, rnd = Math.random) {
  const pool = [];
  for (const topic of topics) {
    for (const item of topic.items) {
      if (settings.kind === "all" || settings.kind === item.type) pool.push({ topic, item });
    }
  }
  const weight = (u) => 1 + Math.min(itemErrors[u.item.id] || 0, 5);
  const units = pickUnits(pool, settings.gaps, weight, rnd);

  let gapSeq = 0;
  const gaps = [];
  for (const unit of units) {
    unit.gapIds = [];
    for (const g of itemGaps(unit.item)) {
      const id = "g" + gapSeq++;
      gaps.push({ id, unit, ...g, accept: new Set(g.answers.map(normalize)) });
      unit.gapIds.push(id);
    }
  }

  let chipSeq = 0;
  const chips = gaps.map((g) => ({ id: "c" + chipSeq++, text: g.answers[0], distractor: false }));

  if (settings.bank === "distractors") {
    const used = new Set(gaps.flatMap((g) => [...g.accept]));
    for (const g of gaps) {
      const want = rnd() < 0.3 ? 2 : 1;
      let added = 0;
      for (const cand of distractorCandidates(g, rnd)) {
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
function distractorCandidates(gap, rnd) {
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
  return [...explicit, ...shuffle(sameLemma, rnd), ...shuffle(topic.distractors, rnd)];
}

export function isCorrect(gap, chipText) {
  return chipText != null && gap.accept.has(normalize(chipText));
}
