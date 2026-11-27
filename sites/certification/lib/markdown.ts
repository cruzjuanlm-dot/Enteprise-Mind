const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ESCAPE[char] ?? char);
}

function safeHref(href: string): string | null {
  if (href.startsWith("#")) return href;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (href.startsWith("https://") || href.startsWith("http://")) return href;
  return null;
}

function renderInline(value: string): string {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, (_match, code: string) => `<code>${code}</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_match, label: string, href: string) => {
      const safe = safeHref(href);
      if (!safe) return label;
      const external = safe.startsWith("http");
      const rel = external ? ' rel="noreferrer" target="_blank"' : "";
      return `<a href="${escapeHtml(safe)}"${rel}>${label}</a>`;
    },
  );
  return html;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function tableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

export function renderMarkdown(source: string, headingBase: 2 | 3 = 2): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  const usedIds = new Set<string>();
  let index = 0;

  function nextHeadingId(title: string): string {
    const base = slugify(title) || "section";
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    usedIds.add(id);
    return id;
  }

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      const depth = heading[1]?.length === 2 ? headingBase : headingBase + 1;
      const tag = depth <= 2 ? "h2" : depth === 3 ? "h3" : "h4";
      const text = heading[2] ?? "";
      const id = nextHeadingId(text);
      blocks.push(`<${tag} id="${id}">${renderInline(text)}</${tag}>`);
      index += 1;
      continue;
    }

    if (line.trim() === "---") {
      blocks.push("<hr />");
      index += 1;
      continue;
    }

    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (index < lines.length && (lines[index] ?? "").trim().startsWith("|")) {
        tableLines.push(lines[index] ?? "");
        index += 1;
      }
      blocks.push(renderTable(tableLines));
      continue;
    }

    if (line.startsWith("> ")) {
      const quoted: string[] = [];
      while (index < lines.length && (lines[index] ?? "").startsWith("> ")) {
        quoted.push((lines[index] ?? "").slice(2));
        index += 1;
      }
      blocks.push(`<blockquote><p>${renderInline(quoted.join(" "))}</p></blockquote>`);
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && (lines[index] ?? "").startsWith("- ")) {
        items.push((lines[index] ?? "").slice(2));
        index += 1;
      }
      blocks.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`);
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? "").trim() !== "" &&
      !/^(#{2,3})\s+/.test(lines[index] ?? "") &&
      !(lines[index] ?? "").startsWith("- ") &&
      !(lines[index] ?? "").startsWith("> ") &&
      !(lines[index] ?? "").trim().startsWith("|") &&
      (lines[index] ?? "").trim() !== "---" &&
      !/^\d+\.\s+/.test(lines[index] ?? "")
    ) {
      paragraph.push((lines[index] ?? "").trim());
      index += 1;
    }
    blocks.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return blocks.join("\n");
}

function renderTable(lines: string[]): string {
  if (lines.length < 2 || !isTableSeparator(lines[1] ?? "")) {
    return `<p>${renderInline(lines.join(" "))}</p>`;
  }
  const header = tableCells(lines[0] ?? "");
  const body = lines.slice(2).map(tableCells);
  const head = `<thead><tr>${header.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead>`;
  const rows = body
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<div class="table-wrap"><table>${head}<tbody>${rows}</tbody></table></div>`;
}
