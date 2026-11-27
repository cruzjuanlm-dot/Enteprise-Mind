export const stationIds = [
  "outside",
  "pause",
  "organized",
  "session",
  "value",
  "velocity",
  "debt",
] as const;

export type StationId = (typeof stationIds)[number];

export type Station = {
  id: StationId;
  name: string;
  group: "turn" | "measure";
  text: string;
};

export const stations: Station[] = [
  {
    id: "outside",
    name: "Outside knowledge",
    group: "turn",
    text: "A fact arrives that the organization does not yet hold as a record. On the Kilnwatch bench, that fact is a firing curve. It is knowledge. It is not yet an asset, and a recording of the room does not make it one.",
  },
  {
    id: "pause",
    name: "Big Pause",
    group: "turn",
    text: "The sponsor and the steward stop new AI and enterprise projects and learn the language first. The pause is a signed decision. Skipping it puts debt into the work before there is a register to put it on. The ring is broken here on purpose.",
  },
  {
    id: "organized",
    name: "Organized",
    group: "turn",
    text: "The fact becomes a unit: a type, an owner, a scope, and a row on the asset register or the debt register. Organized means someone else can find it without asking the people who were in the room.",
  },
  {
    id: "session",
    name: "Value session",
    group: "turn",
    text: "The meeting is for capture. People record typed knowledge, such as a decision or a risk, into units a later workflow can read. A session that changes no unit did not move the cycle. The conversation is not the record.",
  },
  {
    id: "value",
    name: "Actionable value",
    group: "turn",
    text: "An accepted unit is in use. Someone can carry it out without asking what was meant. That is the point of the turn. The next outside fact starts another one.",
  },
  {
    id: "velocity",
    name: "Velocity",
    group: "measure",
    text: "Velocity is the number of days from knowledge arriving to an accepted unit that changes the work. It is a duration. A count of meetings, tools, or people in the room is not velocity. The board report states the median in days.",
  },
  {
    id: "debt",
    name: "Enterprise debt",
    group: "measure",
    text: "Enterprise debt is knowledge the organization already depends on and has not organized. It sits across the cycle because it slows every turn: the unowned decision, the procedure that lives in one person, the register that does not match the files. Debt is not a verdict. It is a drag, and it has an owner on the debt register.",
  },
];

export function isStationId(value: string): value is StationId {
  return stationIds.some((id) => id === value);
}

export function getStation(id: StationId): Station {
  const station = stations.find((item) => item.id === id);
  if (!station) throw new Error(`Unknown station ${id}.`);
  return station;
}
