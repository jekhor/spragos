// Переводы: словари интерфейса, ключи в index.html, переводы тем и справок.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LANGS, DEFAULT_LANG, keys, raw, t, plural, detectLang, setLang } from "../web/js/i18n.js";
import { parseTopic, localized } from "../web/js/parser.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");

test("во всех словарях те же ключи, что в языке по умолчанию, и те же параметры", () => {
  const base = keys(DEFAULT_LANG);
  for (const lang of Object.keys(LANGS)) {
    assert.deepEqual(keys(lang).sort(), [...base].sort(), `словарь ${lang}`);
    for (const k of base) {
      const a = raw(k, DEFAULT_LANG);
      const b = raw(k, lang);
      if (Array.isArray(a)) {
        // число форм зависит от языка: [one, few, many] или [one, other]
        assert.ok(Array.isArray(b) && b.length >= 2, `${lang}: ${k} — формы множественного числа`);
        continue;
      }
      const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      assert.deepEqual(params(b), params(a), `${lang}: ${k} — параметры`);
    }
  }
});

test("все ключи из index.html есть в словаре", () => {
  const html = readFileSync(join(ROOT, "web", "index.html"), "utf8");
  const used = [...html.matchAll(/data-i18n(?:-html|-title|-aria-label)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(used.length > 30);
  const known = new Set(keys(DEFAULT_LANG));
  assert.deepEqual(used.filter((k) => !known.has(k)), []);
});

test("язык по умолчанию — из настроек браузера", () => {
  assert.equal(detectLang(["be-BY", "ru"]), "be");
  assert.equal(detectLang(["en-US", "ru-RU"]), "en");
  assert.equal(detectLang(["de-DE", "uk"]), "uk");
  assert.equal(detectLang(["de", "lt"]), DEFAULT_LANG);
  assert.equal(detectLang([]), DEFAULT_LANG);
  assert.equal(setLang("xx"), DEFAULT_LANG);
});

test("подстановки и множественное число", () => {
  setLang("be");
  assert.equal(t("round.progress", { filled: 2, total: 5 }), "запоўнена 2 з 5");
  assert.equal(plural(1, "plural.gap"), "1 пропуск");
  assert.equal(plural(3, "plural.gap"), "3 пропускі");
  assert.equal(plural(12, "plural.gap"), "12 пропускаў");
  assert.equal(plural(21, "plural.item"), "21 заданне");
  setLang("uk");
  assert.equal(plural(3, "plural.gap"), "3 пропуски");
  assert.equal(plural(5, "plural.item"), "5 завдань");
  setLang("en");
  assert.equal(plural(1, "plural.gap"), "1 gap");
  assert.equal(plural(21, "plural.gap"), "21 gaps");
  setLang("ru");
  assert.equal(plural(24, "plural.item"), "24 задания");
  assert.equal(t("нет такого ключа"), "нет такого ключа");
});

test("переводы тем и подтем: @title.be, @subtopic.be", () => {
  const src = "@title: Тема\n@title.be: Тэма\n@subtopic: Подтема | описание\n@subtopic.be: Падтэма | апісанне\nA {x}.";
  const topic = parseTopic(src, "t.txt");
  assert.deepEqual(topic.errors, []);
  assert.equal(localized(topic, "title", "be"), "Тэма");
  assert.equal(localized(topic, "title", "ru"), "Тема");
  const [st] = topic.subtopics;
  assert.equal(st.key, "t.txt#Подтема"); // ключ — по исходному заголовку
  assert.equal(localized(st, "title", "be"), "Падтэма");
  assert.equal(localized(st, "description", "be"), "апісанне");
  const bad = parseTopic("@subtopic.be: X\n@hints.be: always\nA {x}.", "b.txt");
  assert.deepEqual(bad.errors.map((e) => e.line), [1, 2]);
});

test("у каждой темы есть перевод на все языки", () => {
  for (const file of readdirSync(DATA, { recursive: true }).filter((f) => f.endsWith(".txt"))) {
    const topic = parseTopic(readFileSync(join(DATA, file), "utf8"), file);
    for (const lang of Object.keys(LANGS)) {
      if (lang === DEFAULT_LANG) continue;
      for (const field of ["title", "group", "description"]) {
        if (topic[field]) assert.ok(topic.i18n[lang]?.[field], `${file}: нет @${field}.${lang}`);
      }
      for (const st of topic.subtopics) {
        // заголовок без кириллицы (например «1. -as, -a») переводить не нужно
        if (/[а-яё]/i.test(st.title + st.description)) assert.ok(st.i18n[lang], `${file}: нет @subtopic.${lang} для «${st.title}»`);
      }
    }
  }
});

test("переводы справок: у каждого имя.xx.md есть исходный имя.md и заголовок, у каждой справки есть перевод", () => {
  const mds = readdirSync(DATA, { recursive: true }).filter((f) => f.endsWith(".md"));
  for (const f of mds) {
    const m = f.match(/^(.*)\.([a-z]{2,3})\.md$/);
    if (m && LANGS[m[2]]) {
      assert.ok(existsSync(join(DATA, m[1] + ".md")), `${f}: нет ${m[1]}.md`);
      assert.match(readFileSync(join(DATA, f), "utf8"), /^# \S/, `${f}: нет заголовка`);
    }
  }
  for (const f of mds.filter((x) => !/\.[a-z]{2,3}\.md$/.test(x))) {
    for (const lang of Object.keys(LANGS)) {
      if (lang !== DEFAULT_LANG) assert.ok(mds.includes(f.replace(/\.md$/, `.${lang}.md`)), `нет перевода ${f} на ${lang}`);
    }
  }
});
