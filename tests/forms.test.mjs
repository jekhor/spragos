// Проверка базы заданий: каждый ответ — существующая форма своей подсказки-леммы.
// Леммы, которых нет в tests/paradigms.mjs (например, существительные и глаголы), пропускаются.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseTopic, itemGaps, normalize } from "../web/js/parser.js";
import { formsOf, DEMONSTRATIVE_FORMS } from "./paradigms.mjs";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const MAX_TRIVIAL = 2; // пропусков, где ответ совпадает с подсказкой (см. MATERIALS_GUIDE.md §4.3)

test("парадигмы совпадают со сверенными таблицами", () => {
  const has = (lemma, ...forms) => {
    const set = formsOf(lemma);
    for (const f of forms) assert.ok(set.has(f), `${lemma}: нет формы ${f}`);
  };
  has("geras", "gero", "geram", "gerą", "geru", "gerame", "geri", "gerų", "geriems", "gerus", "gerais", "geruose",
    "gera", "geros", "gerai", "geroje", "geroms", "geras", "geromis", "gerose");
  has("gražus", "gražaus", "gražiam", "gražų", "gražiu", "gražiame", "gražūs", "gražių", "gražiems", "gražius",
    "graži", "gražios", "gražiai", "gražią", "gražia", "gražioje", "gražioms", "gražias", "gražiomis", "gražiose");
  has("platus", "plataus", "plačiam", "plati", "plačios", "plačią");
  has("medinis", "medinio", "mediniam", "medinį", "mediniai", "mediniams", "medinė", "medinę", "medine", "medinėje");
  has("didelis", "dideli", "dideliems", "didelį", "didelė", "didelę");
  has("trečias", "trečio", "trečią", "treti", "tretiems", "trečius", "trečia", "trečioje");
  has("dveji", "dvejų", "dvejiems", "dvejus"); has("dvejos", "dvejas", "dvejomis");
  has("vieneri", "vienerius"); has("penkerios", "penkerias");
  has("du", "dviejų", "dviem"); has("trys", "tris", "trimis", "trijose");
  has("tas", "to", "tą", "tuo", "tų", "tuos"); has("ji", "jos", "jai", "ją", "ja", "joje");
  has("kitas", "kiti", "kitiems", "kitus"); has("šitas", "šitie", "šituos");
  assert.ok(!formsOf("kitas").has("kitie"));
  assert.ok(!formsOf("didelis").has("dideliai"));
  assert.ok(!formsOf("medinis").has("medini"));
  assert.equal(formsOf("rašyti"), null);
});

for (const file of readdirSync(DATA, { recursive: true }).filter((f) => f.endsWith(".txt"))) {
  test(`ответы в ${file} — формы своих подсказок`, (t) => {
    const topic = parseTopic(readFileSync(join(DATA, file), "utf8"), file);
    const bad = [];
    const unknown = new Set();
    let trivial = 0;
    for (const item of topic.items) {
      for (const gap of itemGaps(item)) {
        if (!gap.hint) continue;
        if (normalize(gap.answers[0]) === normalize(gap.hint)) trivial++;
        const forms = formsOf(gap.hint);
        if (!forms) {
          unknown.add(gap.hint);
          continue;
        }
        gap.answers.forEach((a, i) => {
          const w = normalize(a);
          const ok = forms.has(w) || (i > 0 && DEMONSTRATIVE_FORMS.has(normalize(gap.hint)) && DEMONSTRATIVE_FORMS.has(w));
          if (!ok) bad.push(`строка ${item.line}: «${a}» — не форма «${gap.hint}»`);
        });
      }
    }
    if (unknown.size) t.diagnostic(`леммы без парадигмы (не проверялись): ${[...unknown].join(", ")}`);
    assert.deepEqual(bad, []);
    assert.ok(trivial <= MAX_TRIVIAL, `тривиальных пропусков ${trivial}, допустимо не больше ${MAX_TRIVIAL}`);
  });

  test(`в ${file} нет повторяющихся предложений`, () => {
    const lines = readFileSync(join(DATA, file), "utf8").split(/\r?\n/).map((l) => l.trim())
      .filter((l) => l.includes("{"));
    const seen = new Set();
    const dups = lines.filter((l) => (seen.has(l) ? true : (seen.add(l), false)));
    assert.deepEqual(dups, []);
  });
}
