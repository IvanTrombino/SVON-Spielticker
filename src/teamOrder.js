// Feste Reihenfolge der Mannschaften (Index bestimmt die Position)
export const TEAM_ORDER = [
  "1. Mannschaft",
  "2. Mannschaft",
  "3. Mannschaft",
  "Damen",
  "A-Jugend",
  "B-Jugend",
  "C-Jugend",
  "D-Jugend",
  "E-Jugend",
  "F-Jugend",
  "G-Jugend"
];

// Leerzeichen und Groß-/Kleinschreibung ignorieren, damit "1.Mannschaft" == "1. Mannschaft"
const normalize = (name) => (name || "").toLowerCase().replace(/\s+/g, "");

const orderIndex = (name) => {
  const index = TEAM_ORDER.findIndex((item) => normalize(item) === normalize(name));
  return index === -1 ? TEAM_ORDER.length : index;
};

// Vergleicht zwei Mannschaftsnamen; unbekannte Teams landen alphabetisch am Ende
export const compareTeamNames = (a, b) =>
  orderIndex(a) - orderIndex(b) || (a || "").localeCompare(b || "");

// Gleiche Mannschaft trotz unterschiedlicher Schreibweise ("1.Mannschaft" == "1. Mannschaft")
export const isSameTeam = (a, b) => normalize(a) === normalize(b);

// Aktive Mannschaften: kein Spielerstamm in der Jugenddatenbank, Namen werden im Trainer Portal gepflegt
export const ACTIVE_TEAMS = ["1. Mannschaft", "2. Mannschaft", "3. Mannschaft", "Damen"];
export const isActiveTeam = (name) => ACTIVE_TEAMS.some((t) => isSameTeam(t, name));
