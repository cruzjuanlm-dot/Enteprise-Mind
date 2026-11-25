export type MarkdownBlock =
  | { type: "heading"; level: 2 | 3; text: string; key: string }
  | { type: "paragraph"; text: string; key: string }
  | { type: "list"; items: { text: string; key: string }[]; key: string };

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let index = 0;
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (text) blocks.push({ type: "paragraph", text, key: `p-${index}-${text.slice(0, 24)}` });
  };
  const flushList = () => {
    if (list.length === 0) return;
    const items = list.map((text, itemIndex) => ({ text, key: `li-${index}-${itemIndex}` }));
    list = [];
    blocks.push({ type: "list", items, key: `ul-${index}` });
  };

  for (const line of lines) {
    index += 1;
    const trimmed = line.trim();
    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 3, text: trimmed.slice(4), key: `h-${index}` });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 2, text: trimmed.slice(3), key: `h-${index}` });
      continue;
    }
    if (trimmed.startsWith("- ")) {
      flushParagraph();
      list.push(trimmed.slice(2));
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  return blocks;
}
