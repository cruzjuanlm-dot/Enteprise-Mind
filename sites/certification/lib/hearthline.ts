import hearthlineFile from "../content/hearthline.json";

export type ReadinessAxis = {
  axis: string;
  score: number;
};

export type HearthlineReport = {
  organization: string;
  department: string;
  project: string;
  projectId: string;
  asOf: string;
  sessionsHeld: number;
  assetRegisterRows: number;
  debtRegisterRows: number;
  certifiedPeople: number;
  velocityDays: number;
  readiness: ReadinessAxis[];
  notes: {
    assets: string;
    debt: string;
    certified: string;
    velocity: string;
    sessions: string;
  };
};

export function getHearthlineReport(): HearthlineReport {
  return hearthlineFile as HearthlineReport;
}

export const UNIT_SOURCE_PATH = "projects/kilnwatch/units/kilnwatch-seed-DEC-001.md";
