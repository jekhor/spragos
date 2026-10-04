// Минимальный рендерер Markdown для грамматических справок (data/*.md).
// Поддерживается: заголовки #–####, абзацы, списки (- и 1.), таблицы, цитаты (>),
// горизонтальная черта (---), **жирный**, *курсив*, `код`. Весь HTML экранируется.

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function inline(src) {
  // Код обрабатываем отдельно, чтобы внутри него не срабатывала остальная разметка.
  return src
    .split(/(`[^`]*`)/)
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      }
      return escapeHtml(part)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>");
    })
    .join("");
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

export function renderMarkdown(src) {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    if (!t) {
      flush();
      continue;
    }

    let m;
    if ((m = t.match(/^(#{1,4})\s+(.*)$/))) {
      flush();
      const level = m[1].length + 1; // # → h2: h1 зарезервирован под заголовок окна
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(t)) {
      flush();
      out.push("<hr>");
      continue;
    }

    if (t.startsWith("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      flush();
      const head = splitRow(t);
      i += 1;
      const rows = [];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) {
        rows.push(splitRow(lines[++i]));
      }
      out.push(
        '<div class="table-wrap"><table>' +
          `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` +
          `<tbody>${rows
            .map((r) => `<tr>${head.map((_, k) => `<td>${inline(r[k] ?? "")}</td>`).join("")}</tr>`)
            .join("")}</tbody>` +
          "</table></div>"
      );
      continue;
    }

    if (/^([-*])\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      flush();
      const ordered = /^\d/.test(t);
      const re = ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/;
      const items = [];
      i -= 1;
      while (i + 1 < lines.length && re.test(lines[i + 1].trim())) {
        items.push(lines[++i].trim().replace(re, ""));
        // строки-продолжения пункта (с отступом)
        while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !re.test(lines[i + 1].trim())) {
          items[items.length - 1] += " " + lines[++i].trim();
        }
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</${tag}>`);
      continue;
    }

    if (t.startsWith(">")) {
      flush();
      const quote = [];
      i -= 1;
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith(">")) {
        quote.push(lines[++i].trim().replace(/^>\s?/, ""));
      }
      out.push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`);
      continue;
    }

    para.push(t);
  }
  flush();
  return out.join("\n");
}

// Заголовок справки — первая строка «# …», иначе запасной вариант.
export function markdownTitle(src, fallback = "") {
  const m = src.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

// Тело справки без первого заголовка (он показывается в шапке окна).
export function stripTitle(src) {
  return src.replace(/^\s*#\s+.+\n?/, "");
}
