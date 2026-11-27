import type { TreeNode } from "@/lib/tree";

export function RepoTree({ nodes }: { nodes: TreeNode[] }) {
  return (
    <ul className="tree">
      {nodes.map((node) => (
        <li key={node.name}>
          {node.href ? <a href={node.href}>{node.name}</a> : node.name}
          {node.children ? <RepoTree nodes={node.children} /> : null}
        </li>
      ))}
    </ul>
  );
}
