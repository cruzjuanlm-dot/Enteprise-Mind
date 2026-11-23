// This file is the only place the denied names are spelled out.
// scripts and the repository validator skip this path so the check does not flag itself.

const TERMS: { label: string; pattern: RegExp }[] = [
  { label: "Feld", pattern: /\bfeld\b/i },
  { label: "Ticketcel", pattern: /ticketcel/i },
  { label: "Cirque", pattern: /\bcirque\b/i },
];

export function deniedTerms(text: string): string[] {
  return TERMS.filter((term) => term.pattern.test(text)).map((term) => term.label);
}
