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
for (const b of ["šit", "kit"]) {
  PRON[b + "as"] = [b + "as", b + "o", b + "am", b + "ą", b + "u", b + "ame",
    b + "ie", b + "ų", b + "iems", b + "uos", b + "ais", b + "uose"];
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
// 11–19; винительный не включён — источники расходятся (vienuolika / vienuoliką)
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

export function formsOf(lemma) {
  const l = lemma.toLocaleLowerCase("lt");
  if (PRON[l]) return new Set(PRON[l]);
  if (NUM[l]) return new Set(NUM[l]);
  return adjForms(l);
}

// Все формы указательных местоимений: для альтернатив вида {šį/tą|šis}.
export const DEMONSTRATIVE_FORMS = new Set(
  ["šis", "ši", "tas", "ta", "šitas", "šita", "kitas", "kita"].flatMap((k) => PRON[k])
);
