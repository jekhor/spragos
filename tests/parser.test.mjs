import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseTopic, parseLine, normalize, itemGaps } from "../web/js/parser.js";
import { exactForms } from "../web/js/paradigms.js";
import { buildRound, isCorrect, poolFor, listLemmas, applySelection, statsKey, countItems, hintsAlways } from "../web/js/round.js";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

// Детерминированный генератор случайных чисел для воспроизводимых тестов.
function seeded(seed = 1) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  };
}

test("пропуск: ответ, альтернативы, лемма, отвлекающие формы", () => {
  const segs = parseLine("Važiuoju {į mokyklą/mokyklon|mokykla|mokykloje, mokyklos} rytoj.");
  assert.equal(segs.length, 3);
  assert.equal(segs[0], "Važiuoju ");
  assert.deepEqual(segs[1], {
    gap: true,
    answers: ["į mokyklą", "mokyklon"],
    hint: "mokykla",
    distractors: ["mokykloje", "mokyklos"],
  });
  assert.equal(segs[2], " rytoj.");
});

test("пропуск без леммы и экранированные скобки", () => {
  const segs = parseLine("\\{a\\} {jį}");
  assert.equal(segs[0], "{a} ");
  assert.deepEqual(segs[1], { gap: true, answers: ["jį"], hint: null, distractors: [] });
});

test("лишние формы без подсказки", () => {
  const [g] = parseLine("{jį||jam, jo}");
  assert.equal(g.hint, null);
  assert.deepEqual(g.distractors, ["jam", "jo"]);
});

test("ошибки строки", () => {
  assert.throws(() => parseLine("Aš {jį matau"), /незакрытая/);
  assert.throws(() => parseLine("Aš jį} matau"), /лишняя/);
  assert.throws(() => parseLine("Aš {|jis} matau"), /пустой ответ/);
  assert.throws(() => parseLine("{a|b|c|d}"), /больше трёх/);
});

test("заголовок, предложения, тексты, комментарии", () => {
  const t = parseTopic(
    [
      "@title: Тест",
      "@group: Группа",
      "@distractors: x, y",
      "@hints: always",
      "# комментарий",
      "",
      "Aš {jį|jis} matau.",
      "--- Pavadinimas",
      "Pirmas {sakinys|sakinys}.",
      "Be propuskų.",
      "---",
      "Su {ja|ji}.",
    ].join("\n"),
    "t.txt"
  );
  assert.deepEqual(t.errors, []);
  assert.equal(t.title, "Тест");
  assert.equal(t.group, "Группа");
  assert.deepEqual(t.distractors, ["x", "y"]);
  assert.equal(t.hints, "always");
  assert.equal(t.items.length, 3);
  assert.equal(t.items[0].type, "sentence");
  assert.equal(t.items[1].type, "text");
  assert.equal(t.items[1].title, "Pavadinimas");
  assert.equal(t.items[1].paragraphs.length, 2);
  assert.equal(itemGaps(t.items[1]).length, 1);
  assert.equal(t.items[2].line, 12);
});

test("ошибки файла содержат номера строк и не мешают остальному", () => {
  const t = parseTopic(
    ["@foo: bar", "Be propuskų.", "Aš {jį matau.", "Gerai {jį}.", "--- Neuždarytas", "Tekstas {x}."].join("\n"),
    "bad.txt"
  );
  assert.deepEqual(
    t.errors.map((e) => e.line),
    [1, 2, 3, 5]
  );
  assert.equal(t.items.length, 2); // «Gerai {jį}.» и незакрытый текст
});

test("id единицы стабилен и зависит от файла", () => {
  const a = parseTopic("Aš {jį}.", "a.txt").items[0].id;
  assert.equal(a, parseTopic("\n\nAš {jį}.", "a.txt").items[0].id);
  assert.notEqual(a, parseTopic("Aš {jį}.", "b.txt").items[0].id);
});

test("normalize: регистр, пробелы, NFC", () => {
  assert.equal(normalize("  Ją "), "ją");
  assert.equal(normalize("į mokyklą"), normalize("į  mokyklą"));
});

test("сборка раунда: только ответы", () => {
  const t = parseTopic("A {jį|jis}.\nB {jam|jis}.\nC {jo|jis}.\nD {ją|ji}.", "t.txt");
  const r = buildRound([t], { gaps: 3, kind: "all", bank: "answers" }, {}, seeded(3));
  assert.equal(r.units.length, 3);
  assert.equal(r.chips.length, r.gaps.length);
  assert.deepEqual(r.chips.map((c) => c.text).sort(), r.gaps.map((g) => g.answers[0]).sort());
});

test("сборка раунда: отвлекающие формы той же леммы, без совпадений с ответами", () => {
  const t = parseTopic("{Jį|jis} matau.\nB {jam|jis}.\nC {jo|jis}.\nD {juo|jis}.", "t.txt");
  for (let seed = 1; seed < 30; seed++) {
    const r = buildRound([t], { gaps: 1, kind: "all", bank: "distractors" }, {}, seeded(seed));
    const extra = r.chips.filter((c) => c.distractor);
    assert.ok(extra.length >= 1 && extra.length <= 2);
    const answer = normalize(r.gaps[0].answers[0]);
    for (const c of extra) {
      assert.notEqual(normalize(c.text), answer);
      assert.ok(exactForms("jis").pos.includes(normalize(c.text))); // формы jis — из заданий темы и из парадигмы
      // регистр первой буквы подгоняется под ответ
      assert.equal(c.text[0] === c.text[0].toUpperCase(), r.gaps[0].answers[0][0] === "J");
    }
  }
});

test("размер раунда считается в пропусках", () => {
  const lines = [];
  for (let i = 0; i < 20; i++) lines.push(`S${i} {a${i}}.`);
  lines.push("--- Ilgas", "{x1} {x2} {x3} {x4} {x5} {x6} {x7} {x8} {x9} {x10}", "---");
  const t = parseTopic(lines.join("\n"), "t.txt");
  for (let seed = 1; seed < 40; seed++) {
    const r = buildRound([t], { gaps: 6, kind: "all", bank: "answers" }, {}, seeded(seed));
    assert.ok(r.gaps.length >= 6 && r.gaps.length <= 8, `seed ${seed}: ${r.gaps.length}`);
  }
  // если подходит только большой текст — берём его целиком
  const r = buildRound([t], { gaps: 3, kind: "text", bank: "answers" }, {}, seeded(1));
  assert.equal(r.gaps.length, 10);
});

test("тренировка одного слова: только его пропуски, остальные заполнены", () => {
  const t = parseTopic(
    ["A {jį|jis} ir {ją|ji}.", "B {jam|jis}.", "C {jai|ji}.", "--- T", "{Jo|jis} {jos|ji} {juo|jis}.", "---"].join("\n"),
    "t.txt"
  );
  t.distractors = ["man", "tau"]; // общий список темы не должен попадать в банк
  const settings = { gaps: 50, kind: "all", bank: "distractors", lemma: "jis" };
  const pool = poolFor([t], settings);
  assert.equal(pool.length, 3); // «C {jai}» не содержит jis
  assert.equal(pool.reduce((s, u) => s + u.active, 0), 4);
  const r = buildRound([t], settings, {}, seeded(2));
  assert.equal(r.gaps.length, 4);
  assert.ok(r.gaps.every((g) => g.hint === "jis"));
  for (const u of r.units) {
    assert.equal(u.slots.length, u.item.paragraphs.flat().filter((x) => x.gap).length);
    assert.deepEqual(u.slots.filter(Boolean), u.gapIds);
  }
  // лишние формы — только формы того же слова
  for (const c of r.chips.filter((c) => c.distractor)) assert.ok(exactForms("jis").pos.includes(c.text.toLowerCase()));

  const lemmas = listLemmas([t])[0].lemmas;
  assert.deepEqual(lemmas.map((l) => [l.label, l.count]), [["ji", 3], ["jis", 4]]);
  assert.deepEqual(listLemmas([t], "sentence")[0].lemmas.map((l) => l.count), [2, 2]);
});

test("перетаскивание: в раунде по нескольку пропусков на одно слово", () => {
  const lines = [];
  for (let w = 0; w < 8; w++) for (let i = 0; i < 6; i++) lines.push(`S${w}-${i} {f${w}${i}|w${w}}.`);
  const t = parseTopic(lines.join("\n"), "t.txt");
  for (let seed = 1; seed < 30; seed++) {
    const r = buildRound([t], { gaps: 12, kind: "all", bank: "answers", mode: "drag" }, {}, seeded(seed));
    const per = {};
    for (const g of r.gaps) per[g.hint] = (per[g.hint] || 0) + 1;
    assert.equal(r.gaps.length, 12);
    assert.deepEqual(Object.values(per), [3, 3, 3, 3], `seed ${seed}: ${JSON.stringify(per)}`);
  }
  // в режиме ввода группировки нет: слов обычно больше
  const spread = [];
  for (let seed = 1; seed < 30; seed++) {
    const r = buildRound([t], { gaps: 12, kind: "all", bank: "answers", mode: "type" }, {}, seeded(seed));
    spread.push(new Set(r.gaps.map((g) => g.hint)).size);
  }
  assert.ok(spread.some((n) => n > 4));
});

test("фильтр по типу и проверка ответа", () => {
  const t = parseTopic("A {jį/jį patį|jis}.\n--- T\nB {jam}.\n---", "t.txt");
  const r = buildRound([t], { gaps: 5, kind: "text", bank: "answers" }, {}, seeded(1));
  assert.equal(r.units.length, 1);
  assert.equal(r.units[0].item.type, "text");
  const s = buildRound([t], { gaps: 5, kind: "sentence", bank: "answers" }, {}, seeded(1));
  assert.ok(isCorrect(s.gaps[0], "Jį patį"));
  assert.ok(!isCorrect(s.gaps[0], "jam"));
  assert.ok(!isCorrect(s.gaps[0], undefined));
  // режим ввода: регистр и пробелы по краям не важны, диакритика важна
  assert.ok(isCorrect(s.gaps[0], "  JĮ  "));
  assert.ok(!isCorrect(s.gaps[0], "ji"));
  assert.ok(!isCorrect(s.gaps[0], ""));
});

test("подтемы: разбор, выбор целиком и по частям", () => {
  const src = [
    "@title: Daiktavardžiai",
    "@word-practice: off",
    "@subtopic: 1. мужской род | namas, kelias",
    "A {namą|namas}.",
    "--- Tekstas",
    "B {kelyje|kelias}.",
    "---",
    "@subtopic: 2. женский род",
    "C {knygą|knyga}.",
    "D {gatvėje|gatvė}.",
  ].join("\n");
  const t = parseTopic(src, "d.txt");
  assert.deepEqual(t.errors, []);
  assert.equal(t.wordPractice, false);
  assert.deepEqual(t.subtopics.map((st) => [st.key, st.title, st.description]), [
    ["d.txt#1. мужской род", "1. мужской род", "namas, kelias"],
    ["d.txt#2. женский род", "2. женский род", ""],
  ]);
  assert.deepEqual(t.items.map((it) => it.subtopic), ["d.txt#1. мужской род", "d.txt#1. мужской род", "d.txt#2. женский род", "d.txt#2. женский род"]);
  assert.equal(countItems(t, "d.txt#2. женский род").sentence, 2);
  assert.equal(statsKey(t, t.items[0]), "d.txt#1. мужской род");

  const plain = parseTopic("X {jį|jis}.", "p.txt");
  assert.equal(plain.wordPractice, true);
  assert.equal(statsKey(plain, plain.items[0]), "p.txt");

  // файл темы — все подтемы; ключ подтемы — только её задания
  assert.equal(applySelection([t, plain], ["d.txt"])[0], t);
  const part = applySelection([t, plain], ["d.txt#2. женский род", "p.txt"]);
  assert.equal(part.length, 2);
  assert.ok(part[0].partial);
  assert.deepEqual(part[0].items.map((it) => it.line), [9, 10]);
  assert.deepEqual(part[0].subtopics.map((st) => st.title), ["2. женский род"]);
  assert.equal(t.items.length, 4); // исходная тема не изменилась
  assert.deepEqual(applySelection([t], ["d.txt#нет такой"]), []);

  // в выборе одного слова темы с @word-practice: off не участвуют
  assert.deepEqual(listLemmas([t, plain]).map((g) => g.topic.file), ["p.txt"]);
});

test("подтемы: свои @hints и @distractors, несколько справок", () => {
  const src = [
    "@reference: a.md, /b.md",
    "@distractors: x1, x2",
    "@subtopic: Личные",
    "@distractors: jam, jo",
    "A {foo|fo}.",
    "@subtopic: Указательные",
    "@hints: always",
    "B {bar|ba}.",
  ].join("\n");
  const t = parseTopic(src, "p.txt");
  assert.deepEqual(t.errors, []);
  assert.deepEqual(t.references, ["a.md", "b.md"]);
  assert.equal(t.hints, "");
  assert.deepEqual(t.distractors, ["x1", "x2"]);
  assert.deepEqual(t.subtopics.map((st) => [st.hints, st.distractors]), [["", ["jam", "jo"]], ["always", []]]);
  assert.equal(hintsAlways(t, t.items[0]), false);
  assert.equal(hintsAlways(t, t.items[1]), true);
  // лишние формы личных — из запаса подтемы, указательных — из запаса темы
  const pick = (line) => {
    const words = new Set();
    for (let seed = 1; seed < 20; seed++) {
      const r = buildRound([t], { gaps: 1, kind: "all", bank: "distractors" }, {}, seeded(seed));
      if (r.units[0].item.line === line) r.chips.filter((c) => c.distractor).forEach((c) => words.add(c.text));
    }
    return [...words].sort();
  };
  assert.ok(pick(5).every((w) => ["jam", "jo"].includes(w)));
  assert.ok(pick(8).every((w) => ["x1", "x2"].includes(w)));
  assert.equal(parseTopic("@subtopic: S\n@reference: a.md\nA {x}.", "e.txt").errors[0].line, 2);
});

test("подтемы: ошибки", () => {
  const t = parseTopic("A {x}.\n@subtopic: S\n@subtopic: S\nB {y}.\n@subtopic: Пустая\n@subtopic:", "e.txt");
  assert.deepEqual(t.errors.map((e) => e.line), [3, 6, 1, 5]);
  assert.deepEqual(t.items.map((it) => it.line), [4]); // задание без подтемы отброшено
});

test("файлы базы data/ разбираются без ошибок", () => {
  const files = readdirSync(DATA, { recursive: true }).filter((f) => f.endsWith(".txt"));
  assert.ok(files.length > 0);
  for (const f of files) {
    const t = parseTopic(readFileSync(join(DATA, f), "utf8"), f);
    assert.deepEqual(t.errors, [], `ошибки в ${f}`);
    assert.ok(t.items.length > 0, `нет заданий в ${f}`);
  }
});
