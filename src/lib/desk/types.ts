import type { TypeCode, UnitDomain, UnitScope } from "../frontmatter";

export const DESK_PROJECT_ID = "project.kilnwatch";

export type DeskProposal = {
  id: string;
  title: string;
  type: TypeCode;
  body: string;
  excerpt: string;
  scope: UnitScope;
  projectId: string;
  sourceId: string;
  ownerName: string | null;
  systems: string[];
  acceptance: string | null;
  domain: UnitDomain | null;
  status: "proposed" | "rejected";
  createdAt: string;
};

export type DeskUnit = {
  id: string;
  title: string;
  type: TypeCode;
  scope: UnitScope;
  projectId: string;
  sourceId: string;
  version: number;
  status: "accepted";
  owner: string;
  entities: string[];
  supersedes: string | null;
  body: string;
  path: string;
  excerpt: string;
  origin: "session";
  domain: UnitDomain | null;
  acceptanceCriteria: string | null;
  systemsTouched: string[];
  createdAt: string;
};

export type CompilationRecord = {
  id: string;
  sourceId: string;
  proposalCount: number;
  createdAt: string;
};

export type DeskSnapshot = {
  proposals: DeskProposal[];
  units: DeskUnit[];
  promotions: Record<string, UnitDomain>;
  compilations: CompilationRecord[];
  meetingStep: number;
};

export type ProposalPatch = {
  title?: string;
  type?: string;
  body?: string;
  scope?: string;
  domain?: string;
  acceptance?: string;
};

export function emptyDesk(): DeskSnapshot {
  return {
    proposals: [],
    units: [],
    promotions: {},
    compilations: [],
    meetingStep: 0,
  };
}
