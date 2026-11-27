import { renderMarkdown } from "@/lib/markdown";

export function MarkdownBlock({
  source,
  headingBase = 2,
}: {
  source: string;
  headingBase?: 2 | 3;
}) {
  return (
    <div
      className="prose"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source, headingBase) }}
    />
  );
}
