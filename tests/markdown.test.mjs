import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderMarkdown, markdownTitle, stripTitle, inline } from "../web/js/markdown.js";
import { parseTopic } from "../web/js/parser.js";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

test("inline: жирный, курсив, код, экранирование", () => {
  assert.equal(inline("nam**as**"), "nam<strong>as</strong>");
  assert.equal(inline("*Aš myliu **savo** seserį*"), "<em>Aš myliu <strong>savo</strong> seserį</em>");
  assert.equal(inline("`{a|b}` и <b>"), "<code>{a|b}</code> и &lt;b&gt;");
  assert.equal(inline("`**не жирный**`"), "<code>**не жирный**</code>");
  assert.equal(inline("2 * 3 * 4"), "2 * 3 * 4");
});

test("блоки: заголовки, списки, цитата, черта, абзацы", () => {
  const html = renderMarkdown("# Заголовок\n\nПервая\nстрока.\n\n- один\n- два\n  продолжение\n\n1. раз\n2. два\n\n> **Важно**\n\n---");
  assert.match(html, /<h2>Заголовок<\/h2>/);
  assert.match(html, /<p>Первая строка\.<\/p>/);
  assert.match(html, /<ul><li>один<\/li><li>два продолжение<\/li><\/ul>/);
  assert.match(html, /<ol><li>раз<\/li><li>два<\/li><\/ol>/);
  assert.match(html, /<blockquote><p><strong>Важно<\/strong><\/p><\/blockquote>/);
  assert.match(html, /<hr>/);
});

test("таблица", () => {
  const html = renderMarkdown("| Падеж | aš |\n|---|---|\n| Kilm. | manęs |\n| Naud. |\n");
  assert.match(html, /<thead><tr><th>Падеж<\/th><th>aš<\/th><\/tr><\/thead>/);
  assert.match(html, /<tr><td>Kilm\.<\/td><td>manęs<\/td><\/tr>/);
  assert.match(html, /<tr><td>Naud\.<\/td><td><\/td><\/tr>/); // недостающие ячейки дополняются
});

test("заголовок справки", () => {
  assert.equal(markdownTitle("# Įvardžiai\n\ntext"), "Įvardžiai");
  assert.equal(markdownTitle("без заголовка", "x.md"), "x.md");
  assert.equal(stripTitle("# T\nтело"), "тело");
});

test("справки в data/: есть заголовок, рендерятся; ссылки @reference существуют", () => {
  const files = readdirSync(DATA, { recursive: true });
  const md = files.filter((f) => f.endsWith(".md"));
  assert.ok(md.length > 0);
  for (const f of md) {
    const src = readFileSync(join(DATA, f), "utf8");
    assert.ok(/^#\s+\S/m.test(src), `нет заголовка «# …» в ${f}`);
    assert.ok(renderMarkdown(src).length > 0);
  }
  for (const f of files.filter((f) => f.endsWith(".txt"))) {
    const t = parseTopic(readFileSync(join(DATA, f), "utf8"), f);
    for (const ref of t.references) assert.ok(existsSync(join(DATA, ref)), `${f}: нет справки ${ref}`);
  }
});
