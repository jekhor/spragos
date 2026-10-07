// Парадигмы склонения для проверки ответов в data/*.txt.
// Таблицы сверены с учебниками: Langas į lietuvių kalbą, Žingsnis I (приложение с таблицами местоимений
// и числительных), Colloquial Lithuanian, Complete Lithuanian. formsOf(лемма) → Set всех форм или null, если лемма неизвестна.

const PRON = {
  aš: ["aš", "manęs", "man", "mane", "manimi", "manyje"],
  tu: ["tu", "tavęs", "tau", "tave", "tavimi", "tavyje"],
  jis: ["jis", "jo", "jam", "jį", "juo", "jame"],
  ji: ["ji", "jos", "jai", "ją", "ja", "joje"],
  mes: ["mes", "mūsų", "mums", "mus", "mumis", "mumyse"],
  jūs: ["jūs", "jūsų", "jums", "jus", "jumis", "jumyse"],
  jie: ["jie", "jų", "jiems", "juos", "jais", "juose"],
  jos: ["jos", "jų", "joms", "jas", "jomis", "jose"],
  savęs: ["savęs", "sau", "save", "savimi", "savyje"],
  kas: ["kas", "ko", "kam", "ką", "kuo", "kame"],
  // указательные: лемма ед. ч. покрывает и множественное число того же рода
  šis: ["šis", "šio", "šiam", "šį", "šiuo", "šiame", "šie", "šių", "šiems", "šiuos", "šiais", "šiuose"],
  ši: ["ši", "šios", "šiai", "šią", "šia", "šioje", "šių", "šioms", "šias", "šiomis", "šiose"],
  tas: ["tas", "to", "tam", "tą", "tuo", "tame", "tie", "tų", "tiems", "tuos", "tais", "tuose"],
  ta: ["ta", "tos", "tai", "tą", "toje", "tų", "toms", "tas", "tomis", "tose"],
};
// kuris склоняется как jis / ji (kuriuo, kuriuos) — Žingsnis II, Complete Lithuanian
PRON.kuris = ["kuris", "kurio", "kuriam", "kurį", "kuriuo", "kuriame", "kurie", "kurių", "kuriems", "kuriuos", "kuriais", "kuriuose",
  "kuri", "kurios", "kuriai", "kurią", "kuria", "kurioje", "kurioms", "kurias", "kuriomis", "kuriose"];
// koks, toks, joks: им. koks, вин. kokį, мн. kokie; остальное как žalias (Žingsnis I)
for (const b of ["kok", "tok", "jok"]) {
  PRON[b + "s"] = [b + "s", b + "io", b + "iam", b + "į", b + "iu", b + "iame", b + "ie", b + "ių", b + "iems", b + "ius", b + "iais", b + "iuose",
    b + "ia", b + "ios", b + "iai", b + "ią", b + "ioje", b + "ioms", b + "ias", b + "iomis", b + "iose"];
}
// pats (Žingsnis I)
PRON.pats = ["pats", "paties", "pačiam", "patį", "pačiu", "pačiame", "patys", "pačių", "patiems", "pačius", "pačiais", "pačiuose",
  "pati", "pačios", "pačiai", "pačią", "pačia", "pačioje", "pačioms", "pačias", "pačiomis", "pačiose"];
// šitas склоняется как tas (šitie, šituos), kitas во мн. ч. — как прилагательное (kiti, kitus)
PRON.šitas = ["šitas", "šito", "šitam", "šitą", "šitu", "šitame", "šitie", "šitų", "šitiems", "šituos", "šitais", "šituose"];
PRON.kitas = ["kitas", "kito", "kitam", "kitą", "kitu", "kitame", "kiti", "kitų", "kitiems", "kitus", "kitais", "kituose"];
// anas склоняется как tas (Žingsnis I): ano, anam, aną, anuo, aname; anie, anuos
PRON.anas = ["anas", "ano", "anam", "aną", "anuo", "aname", "anie", "anų", "aniems", "anuos", "anais", "anuose"];
for (const b of ["šit", "kit", "an"]) {
  PRON[b + "a"] = [b + "a", b + "os", b + "ai", b + "ą", b + "oje", b + "ų", b + "oms", b + "as", b + "omis", b + "ose"];
}

const NUM = {
  vienas: ["vienas", "vieno", "vienam", "vieną", "vienu", "viename"],
  viena: ["viena", "vienos", "vienai", "vieną", "vienoje"],
  du: ["du", "dviejų", "dviem", "dviejuose"],
  dvi: ["dvi", "dviejų", "dviem", "dviejose"],
  trys: ["trys", "trijų", "trims", "tris", "trimis", "trijuose", "trijose"],
  šimtas: ["šimtas", "šimto", "šimtui", "šimtą", "šimtu", "šimte",
    "šimtai", "šimtų", "šimtams", "šimtus", "šimtais", "šimtuose"],
  tūkstantis: ["tūkstantis", "tūkstančio", "tūkstančiui", "tūkstantį", "tūkstančiu", "tūkstantyje",
    "tūkstančiai", "tūkstančių", "tūkstančiams", "tūkstančius", "tūkstančiais", "tūkstančiuose"],
};
for (const m of ["keturi", "penki", "šeši", "septyni", "aštuoni", "devyni"]) {
  const b = m.slice(0, -1);
  NUM[m] = [b + "i", b + "ių", b + "iems", b + "is", b + "iais", b + "iuose"];
  NUM[b + "ios"] = [b + "ios", b + "ių", b + "ioms", b + "ias", b + "iomis", b + "iose"];
}
// собирательные: dveji/dvejos, treji/trejos (-ej-), остальные -er-
for (const b of ["dvej", "trej"]) {
  NUM[b + "i"] = [b + "i", b + "ų", b + "iems", b + "us", b + "ais", b + "uose"];
  NUM[b + "os"] = [b + "os", b + "ų", b + "oms", b + "as", b + "omis", b + "ose"];
}
for (const b of ["viener", "ketver", "penker", "šešer", "septyner", "aštuoner", "devyner"]) {
  NUM[b + "i"] = [b + "i", b + "ių", b + "iems", b + "ius", b + "iais", b + "iuose"];
  NUM[b + "ios"] = [b + "ios", b + "ių", b + "ioms", b + "ias", b + "iomis", b + "iose"];
}
// 11–19; винительный совпадает с именительным (Žingsnis I)
for (const w of ["vienuolika", "dvylika", "trylika", "keturiolika", "penkiolika", "šešiolika",
  "septyniolika", "aštuoniolika", "devyniolika"]) {
  const b = w.slice(0, -1);
  NUM[w] = [w, b + "os", b + "ai", b + "oje"];
}

// t → č, d → dž перед i + гласная (platus → plačiam, saldus → saldžios)
function soften(stem, ending) {
  if (/^i[aąeęėiįouųū]/.test(ending)) {
    if (stem.endsWith("t")) return stem.slice(0, -1) + "č";
    if (stem.endsWith("d")) return stem.slice(0, -1) + "dž";
  }
  return stem;
}

const ADJ = {
  ias: {
    m: ["ias", "io", "iam", "ią", "iu", "iame", "i", "ių", "iems", "ius", "iais", "iuose"],
    f: ["ia", "ios", "iai", "ią", "ioje", "ių", "ioms", "ias", "iomis", "iose"],
  },
  as: {
    m: ["as", "o", "am", "ą", "u", "ame", "i", "ų", "iems", "us", "ais", "uose"],
    f: ["a", "os", "ai", "ą", "oje", "ų", "oms", "as", "omis", "ose"],
  },
  us: {
    m: ["us", "aus", "iam", "ų", "iu", "iame", "ūs", "ių", "iems", "ius", "iais", "iuose"],
    f: ["i", "ios", "iai", "ią", "ia", "ioje", "ių", "ioms", "ias", "iomis", "iose"],
  },
  is: {
    m: ["is", "io", "iam", "į", "iu", "iame", "iai", "ių", "iams", "ius", "iais", "iuose"],
    f: ["ė", "ės", "ei", "ę", "e", "ėje", "ių", "ėms", "es", "ėmis", "ėse"],
  },
};

// Прилагательные и порядковые числительные (склоняются как прилагательные).
function adjForms(lemma) {
  const type = ["ias", "as", "us", "is"].find((t) => lemma.endsWith(t));
  if (!type) return null;
  const stem = lemma.slice(0, -type.length);
  const out = new Set();
  for (const e of ADJ[type].m) out.add((type === "ias" ? stem : soften(stem, e)) + e);
  for (const e of ADJ[type].f) out.add((type === "ias" || type === "is" ? stem : soften(stem, e)) + e);
  // исключения: trečias → treti, tretiems; didelis → dideli, dideliems (мн. ч. м. р.)
  if (lemma === "trečias") ["treti", "tretiems"].forEach((f) => out.add(f));
  if (lemma.endsWith("didelis")) {
    out.delete(stem + "iai");
    out.delete(stem + "iams");
    out.add(stem + "i");
    out.add(stem + "iems");
  }
  return out;
}

// Лемма мужского рода указательного местоимения покрывает и женский род: в теме «kuris, koks…»
// подсказка всегда мужского рода (šis → ši, šios). Лемма женского рода — только женский.
const WITH_FEMININE = { šis: "ši", tas: "ta", šitas: "šita", kitas: "kita", anas: "ana" };

// Числительные: подсказка мужского рода покрывает и женский (keturi → keturios, du → dvi).
const NUM_FEMININE = {
  vienas: "viena", du: "dvi", keturi: "keturios", penki: "penkios", šeši: "šešios", septyni: "septynios",
  aštuoni: "aštuonios", devyni: "devynios", vieneri: "vienerios", dveji: "dvejos", treji: "trejos",
  ketveri: "ketverios", penkeri: "penkerios", šešeri: "šešerios", septyneri: "septynerios",
  aštuoneri: "aštuonerios", devyneri: "devynerios",
};

// ---------- Существительные ----------
// Пять типов склонения (linksniuotė), без звательного падежа. Таблицы: Žingsnis I (приложение
// «Daiktavardžių linksniavimas» и «V linksniuotės daiktavardžiai»), Langas į lietuvių kalbą (приложение),
// Colloquial Lithuanian (Declension tables).

// č → t, dž → d перед y: kelias → kelyje, svečias → svetyje
function unsoften(stem) {
  if (stem.endsWith("dž")) return stem.slice(0, -2) + "d";
  if (stem.endsWith("č")) return stem.slice(0, -1) + "t";
  return stem;
}

const withStem = (stem, endings, soft = true) => endings.map((e) => (soft ? soften(stem, e) : stem) + e);

// III склонение: мужской род (дат. п. ед. ч. -iui), род. п. мн. ч. на -ų вместо -ių
const NOUN3_MASC = new Set(["dantis", "debesis", "žvėris", "vagis"]);
const NOUN3_GEN_PL_U = new Set(["ausis", "dantis", "debesis", "naktis", "žąsis", "žuvis"]);
// V склонение: основа косвенных падежей
const NOUN5_STEM = { šuo: "šun", sesuo: "seser", duktė: "dukter" };

const NOUN_IRREGULAR = {
  // mėnuo: основа mėnes- с окончаниями I склонения (Žingsnis I, Colloquial Lithuanian)
  mėnuo: ["mėnuo", "mėnesio", "mėnesiui", "mėnesį", "mėnesiu", "mėnesyje",
    "mėnesiai", "mėnesių", "mėnesiams", "mėnesius", "mėnesiais", "mėnesiuose"],
  // žmogus: ед. ч. — IV склонение, мн. ч. — žmonės (Langas į lietuvių kalbą)
  žmogus: ["žmogus", "žmogaus", "žmogui", "žmogų", "žmogumi", "žmoguje",
    "žmonės", "žmonių", "žmonėms", "žmones", "žmonėmis", "žmonėse"],
};

export function nounForms(lemma, declension) {
  const l = lemma.toLocaleLowerCase("lt");
  if (NOUN_IRREGULAR[l]) return new Set(NOUN_IRREGULAR[l]);
  const cut = (n) => l.slice(0, -n);
  let forms = null;
  switch (declension) {
    case 1:
      if (l.endsWith("ias")) {
        const st = cut(3);
        forms = [...withStem(st, ["ias", "io", "iui", "ią", "iu", "iai", "ių", "iams", "ius", "iais", "iuose"], false), unsoften(st) + "yje"];
      } else if (l.endsWith("as")) {
        const st = cut(2);
        forms = withStem(st, ["as", "o", "ui", "ą", "u", st.endsWith("j") ? "yje" : "e", "ai", "ų", "ams", "us", "ais", "uose"], false);
      } else if (l.endsWith("is") || l.endsWith("ys")) {
        const st = cut(2);
        forms = [l, ...withStem(st, ["io", "iui", "į", "iu", "iai", "ių", "iams", "ius", "iais", "iuose"]), st + "yje"];
      }
      break;
    case 2:
      if (l.endsWith("ia")) forms = withStem(cut(2), ["ia", "ios", "iai", "ią", "ioje", "ių", "ioms", "ias", "iomis", "iose"], false);
      else if (l.endsWith("a")) forms = withStem(cut(1), ["a", "os", "ai", "ą", "oje", "ų", "oms", "as", "omis", "ose"], false);
      else if (l.endsWith("ė")) forms = withStem(cut(1), ["ė", "ės", "ei", "ę", "e", "ėje", "ių", "ėms", "es", "ėmis", "ėse"]);
      break;
    case 3:
      if (l.endsWith("is")) {
        const st = cut(2);
        const dat = l === "vagis" ? ["iui", "iai"] : NOUN3_MASC.has(l) ? ["iui"] : ["iai"];
        // -ies — дифтонг, основа не смягчается: nakties, но nakčiai
        forms = [st + "ies", ...withStem(st, ["is", ...dat, "į", "imi", "yje", "ys", "ims", "imis", "yse"]),
          NOUN3_GEN_PL_U.has(l) ? st + "ų" : soften(st, "ių") + "ių"];
      }
      break;
    case 4:
      if (l.endsWith("ius")) forms = withStem(cut(3), ["ius", "iaus", "iui", "ių", "iumi", "iuje", "iai", "iams", "iais", "iuose"], false);
      else if (l.endsWith("us")) forms = withStem(cut(2), ["us", "aus", "ui", "ų", "umi", "uje", "ūs", "ums", "umis", "uose"], false);
      break;
    case 5: {
      const st = NOUN5_STEM[l] ?? (l.endsWith("uo") ? cut(2) + "en" : null);
      if (!st) break;
      const fem = st.endsWith("er");
      // твор. п.: sesuo, duktė — -imi и -ia; šuo — -imi и -iu; akmuo, vanduo — только -iu
      const instr = fem ? ["imi", "ia"] : l === "šuo" ? ["imi", "iu"] : ["iu"];
      forms = [l, ...withStem(st, ["s", fem ? "iai" : "iui", "į", ...instr, "yje",
        "ys", "ų", "ims", "is", "imis", "yse"], false)];
      break;
    }
  }
  return forms ? new Set(forms) : null;
}

// ---------- Возвратные глаголы ----------
// Спряжение по трём основным формам (инфинитив, наст. и прош. время 3 л. без -si), как в
// «365 lietuvių kalbos veiksmažodžiai» (2015): таблицы спряжения возвратных глаголов во введении и словарные статьи.
// Формы: настоящее, прошедшее, будущее время, повелительное наклонение (2 л. ед. ч., 1 и 2 л. мн. ч.),
// инфинитив; отрицательные (ne-si-moko, ne-ap-si-rengė).

// Возвратные без приставки: инфинитив → [наст. 3 л., прош. 3 л.] без -si
const VERB_REFLEXIVE = {
  mokytis: ["moko", "mokė"], // 365
  praustis: ["prausia", "prausė"], // 365
  rengtis: ["rengia", "rengė"], // 365
  keltis: ["kelia", "kėlė"], // 365
  juoktis: ["juokia", "juokė"], // 365
  džiaugtis: ["džiaugia", "džiaugė"], // 365
  jaustis: ["jaučia", "jautė"], // 365
  tikėtis: ["tiki", "tikėjo"], // 365, введение: tikiuosi, tikiesi, tikisi
  domėtis: ["domi", "domėjo"],
  rūpintis: ["rūpina", "rūpino"],
  šypsotis: ["šypso", "šypsojo"], // 365
  ruoštis: ["ruošia", "ruošė"], // 365
  kalbėtis: ["kalba", "kalbėjo"], // 365, введение: kalbėjausi
  sveikintis: ["sveikina", "sveikino"], // 365
  maudytis: ["maudo", "maudė"], // 365
  klausytis: ["klauso", "klausė"], // 365
  naudotis: ["naudoja", "naudojo"], // 365
  sėstis: ["sėda", "sėdo"],
  jaudintis: ["jaudina", "jaudino"], // 365
  skųstis: ["skundžia", "skundė"], // 365
  didžiuotis: ["didžiuoja", "didžiavo"],
  elgtis: ["elgia", "elgė"],
  ilsėtis: ["ilsi", "ilsėjo"],
};

// Приставочные: инфинитив → [приставка, инфинитив без приставки и -si-, наст. 3 л., прош. 3 л.]
const VERB_PREFIXED = {
  atsikelti: ["at", "kelti", "kelia", "kėlė"], // kelti — 365
  nusiprausti: ["nu", "prausti", "prausia", "prausė"], // prausti — 365
  apsirengti: ["ap", "rengti", "rengia", "rengė"], // rengti — 365
  atsisėsti: ["at", "sėsti", "sėda", "sėdo"],
  susitikti: ["su", "tikti", "tinka", "tiko"],
  susipažinti: ["su", "pažinti", "pažįsta", "pažino"],
  pasiimti: ["pa", "imti", "ima", "ėmė"],
  užsiimti: ["už", "imti", "ima", "ėmė"],
  nusipirkti: ["nu", "pirkti", "perka", "pirko"],
  atsigulti: ["at", "gulti", "gula", "gulė"],
  užsisakyti: ["už", "sakyti", "sako", "sakė"], // sakyti — 365
  atsiprašyti: ["at", "prašyti", "prašo", "prašė"], // 365
  išsimaudyti: ["iš", "maudyti", "maudo", "maudė"], // maudyti — 365
  įsimylėti: ["į", "mylėti", "myli", "mylėjo"],
  apsistoti: ["ap", "stoti", "stoja", "stojo"], // 365
  pasiklysti: ["pa", "klysti", "klysta", "klydo"], // 365
};

// Основа будущего времени: inf без -ti + s; s/š/z/ž основы сливаются с s (praus-ti → praus, vež-ti → veš)
function futureStem(stem) {
  if (/[sšzž]$/.test(stem)) return stem.replace(/z$/, "s").replace(/ž$/, "š");
  return stem + "s";
}

// Основа повелительного наклонения: inf без -ti + k; g → k, k остаётся (rengti → renk, juoktis → juok)
function imperativeStem(stem) {
  if (stem.endsWith("g")) return stem.slice(0, -1) + "k";
  if (stem.endsWith("k")) return stem;
  return stem + "k";
}

// Невозвратные формы: наст., прош., буд. время, повелительное наклонение.
function plainConjugation(stem, pres, past) {
  const out = [];
  const pb = pres.slice(0, -1);
  if (pres.endsWith("o")) out.push(pb + "au", pb + "ai", pres, pb + "ome", pb + "ote");
  else if (pres.endsWith("i")) out.push(soften(pb, "iu") + "iu", pres, pb + "ime", pb + "ite");
  // 2 л. ед. ч. — от несмягчённой основы: jaučia → jauti, skundžia → skundi
  else out.push(pb + "u", pb.endsWith("i") ? unsoften(pb.slice(0, -1)) + "i" : pb + "i", pres, pres + "me", pres + "te");
  const qb = past.slice(0, -1);
  if (past.endsWith("o")) out.push(qb + "au", qb + "ai", past, qb + "ome", qb + "ote");
  else out.push(soften(qb, "iau") + "iau", qb + "ei", past, past + "me", past + "te");
  const fs = futureStem(stem);
  out.push(fs + "iu", fs + "i", fs, fs + "ime", fs + "ite");
  const ks = imperativeStem(stem);
  out.push(ks, ks + "ime", ks + "ite");
  return out;
}

// Возвратные формы глагола без приставки (-si в конце).
function reflexiveConjugation(stem, pres, past) {
  const out = [];
  const pb = pres.slice(0, -1);
  if (pres.endsWith("o")) out.push(pb + "ausi", pb + "aisi", pb + "osi", pb + "omės", pb + "otės");
  else if (pres.endsWith("i")) out.push(soften(pb, "iu") + "iuosi", pb + "iesi", pb + "isi", pb + "imės", pb + "itės");
  else out.push(pb + "uosi", (pb.endsWith("i") ? unsoften(pb.slice(0, -1)) : pb) + "iesi", pb + "asi", pb + "amės", pb + "atės");
  const qb = past.slice(0, -1);
  if (past.endsWith("o")) out.push(qb + "ausi", qb + "aisi", qb + "osi", qb + "omės", qb + "otės");
  else out.push(soften(qb, "iau") + "iausi", qb + "eisi", qb + "ėsi", qb + "ėmės", qb + "ėtės");
  const fs = futureStem(stem);
  out.push(fs + "iuosi", fs + "iesi", fs + "is", fs + "imės", fs + "itės");
  const ks = imperativeStem(stem);
  out.push(ks + "is", ks + "imės", ks + "itės");
  return out;
}

export function verbForms(lemma) {
  const l = lemma.toLocaleLowerCase("lt");
  if (VERB_REFLEXIVE[l]) {
    const stem = l.slice(0, -3); // -tis
    const plain = plainConjugation(stem, ...VERB_REFLEXIVE[l]);
    return new Set([l, "nesi" + stem + "ti", ...reflexiveConjugation(stem, ...VERB_REFLEXIVE[l]), ...plain.map((f) => "nesi" + f)]);
  }
  if (VERB_PREFIXED[l]) {
    const [prefix, inf, pres, past] = VERB_PREFIXED[l];
    const forms = [inf, ...plainConjugation(inf.slice(0, -2), pres, past)].map((f) => prefix + "si" + f);
    return new Set([...forms, ...forms.map((f) => "ne" + f)]);
  }
  return null;
}

// declension — номер типа склонения существительного (1–5); если задан, лемма считается существительным.
export function formsOf(lemma, declension = null) {
  if (declension) return nounForms(lemma, declension);
  const l = lemma.toLocaleLowerCase("lt");
  const verb = verbForms(l);
  if (verb) return verb;
  if (WITH_FEMININE[l]) return new Set([...PRON[l], ...PRON[WITH_FEMININE[l]]]);
  if (NUM_FEMININE[l]) return new Set([...NUM[l], ...NUM[NUM_FEMININE[l]]]);
  if (PRON[l]) return new Set(PRON[l]);
  if (NUM[l]) return new Set(NUM[l]);
  return adjForms(l);
}

// Все формы указательных местоимений: для альтернатив вида {šį/tą|šis}.
export const DEMONSTRATIVE_FORMS = new Set(
  ["šis", "ši", "tas", "ta", "šitas", "šita", "kitas", "kita", "anas", "ana"].flatMap((k) => PRON[k])
);
