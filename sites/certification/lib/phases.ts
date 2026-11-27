import phasesFile from "../content/phases.json";

export type PhaseDownload = {
  href: string;
  label: string;
};

export type Phase = {
  slug: string;
  number: number;
  name: string;
  summary: string;
  work: string;
  signedBy: string;
  artifact: string;
  downloads: PhaseDownload[];
};

const phases = phasesFile.phases as Phase[];

export function getPhases(): Phase[] {
  return phases;
}

export function getPhase(slug: string): Phase | undefined {
  return phases.find((phase) => phase.slug === slug);
}

export function neighborPhases(slug: string): {
  previous?: Phase;
  next?: Phase;
} {
  const index = phases.findIndex((phase) => phase.slug === slug);
  return {
    previous: index > 0 ? phases[index - 1] : undefined,
    next: index >= 0 && index < phases.length - 1 ? phases[index + 1] : undefined,
  };
}
