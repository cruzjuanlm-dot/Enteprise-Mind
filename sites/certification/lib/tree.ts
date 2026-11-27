export type TreeNode = {
  name: string;
  href?: string;
  current?: boolean;
  children?: TreeNode[];
};

export const exampleTree: TreeNode[] = [
  {
    name: "_control/",
    children: [
      { name: "RUN_STATE.md" },
      { name: "triage.md" },
      { name: "change-logs/" },
      { name: "id-migrations/" },
      { name: "ledgers/" },
    ],
  },
  {
    name: "ontology/",
    children: [{ name: "entities/" }, { name: "schemas/" }, { name: "seed/" }],
  },
  {
    name: "core/",
    children: [
      {
        name: "value-flow/",
        children: [
          { name: "market/" },
          { name: "acquire/" },
          { name: "deliver/" },
          { name: "retain/" },
        ],
      },
      { name: "enable/" },
      { name: "govern/" },
    ],
  },
  {
    name: "projects/",
    children: [
      { name: "_template/" },
      {
        name: "kilnwatch/",
        children: [
          {
            name: "units/",
            children: [
              { name: "kilnwatch-handoff-BR-001.md" },
              { name: "kilnwatch-seed-ARC-001.md" },
              {
                name: "kilnwatch-seed-DEC-001.md",
                href: "#unit",
                current: true,
              },
              { name: "kilnwatch-seed-DS-001.md" },
              { name: "kilnwatch-seed-WF-001.md" },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "comps/",
    children: [{ name: "kilnwatch-story/", children: [{ name: "COMP.md" }] }],
  },
];
