import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseTopic, parseLine, normalize, itemGaps } from "../web/js/parser.js";
import { buildRound, isCorrect } from "../web/js/round.js";

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
      assert.ok(["jį", "jam", "jo", "juo"].includes(normalize(c.text)));
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

test("файлы базы data/ разбираются без ошибок", () => {
  const files = readdirSync(DATA, { recursive: true }).filter((f) => f.endsWith(".txt"));
  assert.ok(files.length > 0);
  for (const f of files) {
    const t = parseTopic(readFileSync(join(DATA, f), "utf8"), f);
    assert.deepEqual(t.errors, [], `ошибки в ${f}`);
    assert.ok(t.items.length > 0, `нет заданий в ${f}`);
  }
});
