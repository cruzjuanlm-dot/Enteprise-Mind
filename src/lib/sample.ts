// Synthetic Hearthline Instruments transcript. It is a demo fixture, not a stored record.
export const SAMPLE_TITLE = "Monday sensor review";

export const SAMPLE_TRANSCRIPT = `Decision: Name an owner before a firmware task leaves review
Owner: Field systems lead
Dependencies: none
Systems: Review queue
Acceptance: Each accepted task names an owner or shows an explicit unknown
Due: 2026-12-15
Approval: required
Details: Hearthline firmware tasks without an owner stay proposed. They are not written into shared project context.

Task: File the Monday sensor review on Sensor firmware review
Owner: unknown
Dependencies: Name an owner before a firmware task leaves review
Systems: unknown
Acceptance: The transcript is filed on Sensor firmware review
Due: unknown
Approval: not required
Details: Assignment happens at ingest. The reader must not invent an owner.

Term: Hold point
Owner: Field systems lead
Dependencies: unknown
Systems: unknown
Acceptance: unknown
Due: unknown
Approval: unknown
Details: A firmware change that stays proposed until an owner is named. Alias: hold. Scoped to Sensor firmware review at Hearthline Instruments.`;
