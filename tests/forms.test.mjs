// Проверка базы заданий: каждый ответ — существующая форма своей подсказки-леммы.
// Леммы, которых нет в web/js/paradigms.js, пропускаются.
// Существительные (файлы из NOUN_FILES) проверяются по типу склонения: его номер — число в начале
// заголовка подтемы («1. мужской род…»). В других темах номера подтем — просто порядок.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseTopic, itemGaps, normalize } from "../web/js/parser.js";
import { formsOf, nounForms, DEMONSTRATIVE_FORMS } from "../web/js/paradigms.js";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
// Доля пропусков, где ответ совпадает с подсказкой (см. MATERIALS_GUIDE.md §4.3): немного — полезно, много — скучно.
const MAX_TRIVIAL_SHARE = 0.1;
const NOUN_FILES = new Set(["daiktavardziai.txt"]);

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
  has("kuris", "kurio", "kuriuo", "kuriuos", "kurią", "kuria", "kuriomis");
  has("koks", "kokį", "kokie", "kokiu", "kokią", "kokiose"); has("joks", "jokio", "jokių");
  has("pats", "paties", "patį", "patys", "patiems", "pačius", "pati", "pačią");
  has("visas", "visi", "visiems", "visą", "visoje"); has("kiekvienas", "kiekvieną", "kiekvienoje");
  has("anas", "ano", "aną", "anuo", "anie", "anuos", "ana", "anoje", "anomis");
  has("šis", "šį", "šie", "ši", "šią", "šioms"); has("tas", "tie", "tai", "toje"); has("kitas", "kiti", "kitai");
  assert.ok(!formsOf("ši").has("šį")); // женская лемма не покрывает мужской род
  assert.ok(!formsOf("kitas").has("kitie"));
  assert.ok(!formsOf("didelis").has("dideliai"));
  assert.ok(!formsOf("medinis").has("medini"));
  assert.equal(formsOf("skristi"), null); // глагола нет в таблицах
  const verb = (lemma, ...forms) => {
    const set = formsOf(lemma);
    for (const f of forms) assert.ok(set.has(f), `${lemma}: нет формы ${f}`);
  };
  // Nė dienos be lietuvių kalbos 1, приложение: таблицы спряжения (dirbti, žaisti, mylėti, skaityti)
  verb("dirbti", "dirbu", "dirbi", "dirba", "dirbame", "dirbate", "dirbau", "dirbo", "dirbsiu", "dirbs", "dirbdavau", "dirbk", "dirbkime");
  verb("žaisti", "žaidžiu", "žaidi", "žaidžia", "žaidžiau", "žaidei", "žaidė", "žaisiu", "žais", "žaisdavau", "žaisk");
  verb("skaityti", "skaitau", "skaitai", "skaito", "skaičiau", "skaitei", "skaitėme", "skaitysiu", "skaitydavau", "skaityk");
  verb("būti", "esu", "esi", "yra", "esame", "esate", "buvau", "bus", "būsime", "būdavo", "būk", "nesu", "nėra", "nebuvo");
  verb("eiti", "einu", "ėjau", "eisiu", "eik", "neinu", "neina", "nėjau", "neisiu", "neik");
  verb("bėgti", "bėk", "bėkime"); verb("mokytis", "mokausi", "mokiausi", "mokysiuosi", "mokykis", "nesimoko");
  verb("jaustis", "jaučiuosi", "jautiesi", "jaučiausi", "jauteisi"); verb("apsirengti", "apsirengiu", "apsirenk", "neapsirengė");
  assert.ok(!formsOf("eiti").has("neeina"));
  assert.ok(!formsOf("jaustis").has("jaučiesi"));

  const noun = (lemma, d, ...forms) => {
    const set = nounForms(lemma, d);
    for (const f of forms) assert.ok(set.has(f), `${lemma}: нет формы ${f}`);
  };
  // Žingsnis I, приложение «Daiktavardžių linksniavimas»
  noun("namas", 1, "namo", "namui", "namą", "namu", "name", "namai", "namų", "namams", "namus", "namais", "namuose");
  noun("kelias", 1, "kelio", "keliui", "kelią", "keliu", "kelyje", "keliai", "kelių", "keliams", "kelius", "keliais", "keliuose");
  noun("medis", 1, "medžio", "medžiui", "medį", "medžiu", "medyje", "medžiai", "medžių", "medžius", "medžiuose");
  noun("traukinys", 1, "traukinio", "traukiniui", "traukinį", "traukiniu", "traukinyje", "traukiniai", "traukinių");
  noun("knyga", 2, "knygos", "knygai", "knygą", "knygoje", "knygų", "knygoms", "knygas", "knygomis", "knygose");
  noun("bažnyčia", 2, "bažnyčios", "bažnyčiai", "bažnyčią", "bažnyčioje", "bažnyčių", "bažnyčioms", "bažnyčias");
  noun("klasė", 2, "klasės", "klasei", "klasę", "klase", "klasėje", "klasių", "klasėms", "klases", "klasėmis", "klasėse");
  noun("šalis", 3, "šalies", "šaliai", "šalį", "šalimi", "šalyje", "šalys", "šalių", "šalims", "šalis", "šalimis", "šalyse");
  noun("debesis", 3, "debesies", "debesiui", "debesį", "debesimi", "debesyje", "debesys", "debesų", "debesims");
  noun("dantis", 3, "danties", "dančiui", "dantį", "dantimi", "dantyje", "dantų"); // Langas į lietuvių kalbą
  noun("turgus", 4, "turgaus", "turgui", "turgų", "turgumi", "turguje", "turgūs", "turgums", "turgus", "turgumis", "turguose");
  noun("vaisius", 4, "vaisiaus", "vaisiui", "vaisių", "vaisiumi", "vaisiuje", "vaisiai", "vaisiams", "vaisiais", "vaisiuose");
  noun("žmogus", 4, "žmogaus", "žmogumi", "žmonės", "žmonių", "žmonėms", "žmones", "žmonėmis", "žmonėse");
  noun("asmuo", 5, "asmens", "asmeniui", "asmenį", "asmeniu", "asmenyje", "asmenys", "asmenų", "asmenims", "asmenis", "asmenimis", "asmenyse");
  noun("šuo", 5, "šuns", "šuniui", "šunį", "šunimi", "šuniu", "šunyje", "šunys", "šunų");
  noun("mėnuo", 5, "mėnesio", "mėnesiui", "mėnesį", "mėnesiu", "mėnesyje", "mėnesiai", "mėnesių", "mėnesiuose");
  noun("sesuo", 5, "sesers", "seseriai", "seserį", "seserimi", "seseria", "seseryje", "seserys", "seserų", "seserims");
  noun("duktė", 5, "dukters", "dukteriai", "dukterį", "dukterimi", "dukteria", "dukteryje", "dukterys", "dukterų");
  assert.ok(!nounForms("naktis", 3).has("nakčies"));
  assert.ok(!nounForms("akmuo", 5).has("akmenimi"));
  assert.ok(!nounForms("namas", 1).has("namam")); // не прилагательное
});

for (const file of readdirSync(DATA, { recursive: true }).filter((f) => f.endsWith(".txt"))) {
  test(`ответы в ${file} — формы своих подсказок`, (t) => {
    const topic = parseTopic(readFileSync(join(DATA, file), "utf8"), file);
    const bad = [];
    const unknown = new Set();
    let trivial = 0;
    let total = 0;
    const declension = new Map(NOUN_FILES.has(file)
      ? topic.subtopics.map((st) => [st.key, Number(st.title.match(/^(\d)\./)?.[1]) || null])
      : []);
    for (const item of topic.items) {
      const decl = declension.get(item.subtopic) ?? null;
      for (const gap of itemGaps(item)) {
        total++;
        if (!gap.hint) continue;
        if (normalize(gap.answers[0]) === normalize(gap.hint)) trivial++;
        const forms = formsOf(gap.hint, decl);
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
    const max = Math.max(2, Math.floor(total * MAX_TRIVIAL_SHARE));
    assert.ok(trivial <= max, `тривиальных пропусков ${trivial} из ${total}, допустимо не больше ${max}`);
  });

  test(`в ${file} нет повторяющихся предложений`, () => {
    const lines = readFileSync(join(DATA, file), "utf8").split(/\r?\n/).map((l) => l.trim())
      .filter((l) => l.includes("{"));
    const seen = new Set();
    const dups = lines.filter((l) => (seen.has(l) ? true : (seen.add(l), false)));
    assert.deepEqual(dups, []);
  });
}
