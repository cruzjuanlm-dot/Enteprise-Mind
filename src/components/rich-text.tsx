import { parseMarkdownBlocks } from "@/lib/markdown";

export function RichText({ markdown }: { markdown: string }) {
  const blocks = parseMarkdownBlocks(markdown);
  return (
    <div className="grid gap-3 leading-7">
      {blocks.map((block) => {
        if (block.type === "heading") {
          const Heading = block.level === 3 ? "h3" : "h2";
          return (
            <Heading key={block.key} className={block.level === 3 ? "text-xl" : "text-2xl"}>
              {block.text}
            </Heading>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={block.key} className="list-disc pl-5">
              {block.items.map((item) => (
                <li key={item.key}>{item.text}</li>
              ))}
            </ul>
          );
        }
        return <p key={block.key}>{block.text}</p>;
      })}
    </div>
  );
}
