// Разбор файла темы (data/*.txt) в объект темы.
// Формат описан в README.md. Модуль не зависит от DOM — его можно тестировать в node.

const KNOWN_KEYS = new Set(["title", "group", "description", "distractors", "hints", "reference", "subtopic", "word-practice"]);
// Ключи, у которых бывают переводы: @title.be: …, @subtopic.be: Заголовок | описание
const LOCALIZED_KEYS = new Set(["title", "group", "description", "subtopic"]);

// Нормализация для сравнения ответов: NFC, схлопывание пробелов, без учёта регистра.
export function normalize(s) {
  return s.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("lt");
}

// Короткий стабильный хеш (FNV-1a, 32 бита) — для id единиц в статистике.
export function hash(s) {
  let h = 0x811c9dc5;
  for (const ch of s) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function splitList(s, sep) {
  return s.split(sep).map((x) => x.trim()).filter(Boolean);
}

// Разбор содержимого фигурных скобок: "ответ/альт|лемма|отвл1, отвл2"
function parseGap(body) {
  const parts = body.split("|");
  if (parts.length > 3) {
    throw new Error(`в пропуске {${body}} больше трёх частей, разделённых «|»`);
  }
  const answers = splitList(parts[0], "/");
  if (answers.length === 0) throw new Error(`пустой ответ в пропуске {${body}}`);
  const hint = (parts[1] ?? "").trim() || null;
  const distractors = parts[2] !== undefined ? splitList(parts[2], ",") : [];
  return { gap: true, answers, hint, distractors };
}

// Разбор одной строки текста в массив сегментов: строки и пропуски.
export function parseLine(text) {
  const segments = [];
  let buf = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" && (text[i + 1] === "{" || text[i + 1] === "}")) {
      buf += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === "}") throw new Error("лишняя закрывающая «}»");
    if (ch === "{") {
      const end = text.indexOf("}", i + 1);
      if (end === -1) throw new Error("незакрытая «{»");
      const body = text.slice(i + 1, end);
      if (body.includes("{")) throw new Error("вложенная «{» внутри пропуска");
      if (buf) segments.push(buf);
      buf = "";
      segments.push(parseGap(body));
      i = end + 1;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf) segments.push(buf);
  return segments;
}

export function parseTopic(source, file = "") {
  const topic = {
    file,
    title: file.replace(/\.txt$/, ""),
    group: "",
    description: "",
    distractors: [],
    hints: "", // "always" — подсказки в этой теме показываются всегда
    references: [], // пути к справкам .md относительно data/ (@reference: a.md, b.md; по умолчанию — файл с тем же именем)
    wordPractice: true, // предлагать ли тренировку одного слова (@word-practice: off — нет)
    subtopics: [], // { key, title, description, i18n, hints, distractors }; key = "файл#заголовок" (по исходному заголовку, без перевода)
    i18n: {}, // переводы: { be: { title, group, description } }
    items: [],
    errors: [],
  };
  const lines = source.normalize("NFC").replace(/^﻿/, "").split(/\r?\n/);
  let block = null; // открытый блок связного текста
  let subtopic = null; // текущая подтема (@subtopic) — к ней относятся задания ниже

  const err = (line, message) => topic.errors.push({ file, line, message });

  const closeBlock = () => {
    if (block.paragraphs.length === 0) {
      err(block.line, `текст «${block.title}» пуст`);
    } else if (!block.paragraphs.some((p) => p.some((s) => s.gap))) {
      err(block.line, `в тексте «${block.title}» нет ни одного пропуска`);
    } else {
      topic.items.push({
        id: hash(file + "\n" + block.raw.join("\n")),
        type: "text",
        title: block.title,
        line: block.line,
        subtopic: block.subtopic,
        paragraphs: block.paragraphs,
      });
    }
    block = null;
  };

  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    const fence = line.match(/^---+\s*(.*)$/);
    if (fence) {
      if (block) {
        if (fence[1]) err(lineNo, "новый текст начат, а предыдущий не закрыт строкой «---»");
        closeBlock();
        if (!fence[1]) return;
      }
      block = { title: fence[1], line: lineNo, paragraphs: [], raw: [], subtopic: subtopic?.key ?? null };
      return;
    }

    const meta = !block && line.match(/^@([\wа-яё-]+)(?:\.([a-z]{2,3}))?\s*:\s*(.*)$/i);
    if (meta) {
      const key = meta[1].toLowerCase();
      const lang = meta[2]?.toLowerCase();
      const value = meta[3].trim();
      if (lang) {
        // перевод: заголовок подтемы относится к последней строке @subtopic
        if (!LOCALIZED_KEYS.has(key)) err(lineNo, `у параметра @${key} не бывает перевода`);
        else if (key === "subtopic") {
          const [title, ...rest] = value.split("|").map((x) => x.trim());
          if (!subtopic) err(lineNo, `@subtopic.${lang} стоит до первой строки @subtopic`);
          else subtopic.i18n[lang] = { title, description: rest.join("|") };
        } else (topic.i18n[lang] ??= {})[key] = value;
        return;
      }
      if (!KNOWN_KEYS.has(key)) {
        err(lineNo, `неизвестный параметр @${key}`);
      } else if (key === "distractors") {
        // после @subtopic — запас лишних форм этой подтемы, иначе всей темы
        (subtopic ? subtopic.distractors : topic.distractors).push(...splitList(value, ","));
      } else if (key === "hints") {
        if (subtopic) subtopic.hints = value;
        else topic.hints = value;
      } else if (key === "reference") {
        if (subtopic) err(lineNo, "@reference задаётся для всей темы, а не для подтемы");
        else topic.references.push(...splitList(value, ",").map((x) => x.replace(/^\/+/, "")));
      } else if (key === "subtopic") {
        // @subtopic: Заголовок | описание
        const [title, ...rest] = value.split("|").map((x) => x.trim());
        const subKey = `${file}#${title}`;
        if (!title) err(lineNo, "у подтемы нет заголовка");
        else if (topic.subtopics.some((st) => st.key === subKey)) err(lineNo, `подтема «${title}» уже есть в этом файле`);
        else {
          subtopic = { key: subKey, title, description: rest.join("|"), line: lineNo, i18n: {}, hints: "", distractors: [] };
          topic.subtopics.push(subtopic);
        }
      } else if (key === "word-practice") {
        topic.wordPractice = !/^(off|no|нет)$/i.test(value);
      } else {
        topic[key] = value;
      }
      return;
    }

    let segments;
    try {
      segments = parseLine(line);
    } catch (e) {
      err(lineNo, e.message);
      return;
    }

    if (block) {
      block.paragraphs.push(segments);
      block.raw.push(line);
      return;
    }
    if (!segments.some((s) => s.gap)) {
      err(lineNo, "в предложении нет ни одного пропуска {…}");
      return;
    }
    topic.items.push({
      id: hash(file + "\n" + line),
      type: "sentence",
      line: lineNo,
      subtopic: subtopic?.key ?? null,
      paragraphs: [segments],
    });
  });

  if (block) {
    err(block.line, `текст «${block.title}» не закрыт строкой «---»`);
    closeBlock();
  }
  // Если подтемы есть, каждое задание должно относиться к одной из них.
  if (topic.subtopics.length) {
    for (const it of topic.items) {
      if (!it.subtopic) err(it.line, "задание стоит до первой строки @subtopic и не относится ни к одной подтеме");
    }
    topic.items = topic.items.filter((it) => it.subtopic);
    for (const st of topic.subtopics) {
      if (!topic.items.some((it) => it.subtopic === st.key)) err(st.line, `в подтеме «${st.title}» нет заданий`);
    }
  }
  return topic;
}

// Подтема задания (или null).
export function itemSubtopic(topic, item) {
  return item.subtopic ? topic.subtopics.find((st) => st.key === item.subtopic) || null : null;
}

// Поле темы или подтемы на нужном языке; если перевода нет — исходное.
export function localized(obj, field, lang) {
  return (lang && obj.i18n?.[lang]?.[field]) || obj[field];
}

// Все пропуски единицы по порядку.
export function itemGaps(item) {
  return item.paragraphs.flat().filter((s) => s.gap);
}
