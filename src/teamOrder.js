// Feste Reihenfolge der Mannschaften (Index bestimmt die Position)
export const TEAM_ORDER = [
  "1. Mannschaft",
  "2. Mannschaft",
  "3. Mannschaft",
  "Damen",
  "Ü35/AH",
  "A-Jugend",
  "B-Jugend",
  "C-Jugend",
  "D-Jugend",
  "E-Jugend",
  "E-Jugend Funino",
  "F-Jugend",
  "F-Jugend Funino",
  "G-Jugend",
  "G-Jugend Funino"
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
export const ACTIVE_TEAMS = ["1. Mannschaft", "2. Mannschaft", "3. Mannschaft", "Damen", "Ü35/AH"];
export const isActiveTeam = (name) => ACTIVE_TEAMS.some((t) => isSameTeam(t, name));

// Push-Kanal (ntfy) je Mannschaft, z. B. "svonfjugend", "svongjugendfunino", "svonue35ah"
export const teamChannel = (clubId, team) =>
  `${clubId}${(team || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "")}`;

// Funino-Teams (E/F/G-Jugend Funino) gibt es nur im Live-Ticker, nicht in der Jugenddatenbank
export const isFuninoTeam = (name) => /funino/i.test(name || "");

// Mannschaftslisten zusammenführen (Live-Ticker-Teams + Jugenddatenbank), damit neue Mannschaften überall erscheinen.
// Bei gleicher Mannschaft in anderer Schreibweise gewinnt die erste Liste.
export const mergeTeamNames = (primary, extra) =>
  [...primary, ...extra.filter((e, i) => e && !primary.some((p) => isSameTeam(p, e)) && extra.findIndex((x) => isSameTeam(x, e)) === i)];
