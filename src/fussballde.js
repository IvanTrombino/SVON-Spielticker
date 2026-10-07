// Gemeinsame Hilfen für die fussball.de-Anbindung (Import in die Platzbelegung, nächste Spiele)

// Heimspiel = Spielort ist unser Sportpark (Orsinger Str. 42, 78359 Orsingen-Nenzingen).
// Vergleich ohne Leerzeichen/Punkte und mit "Str."/"Straße" gleichwertig.
export const HOME_ADDRESS = "Orsinger Str. 42, 78359 Orsingen-Nenzingen";
const normalizeAddress = (text) => text.toLowerCase().replace(/straße|strasse/g, "str").replace(/[\s.,-]/g, "");
export const isAtHomeVenue = (venue) => {
  const v = normalizeAddress(venue || "");
  return v.includes(normalizeAddress("Orsinger Str. 42")) && v.includes("78359");
};

// Mannschaftsnamen vergleichen: "1. Mannschaft" (Ticker) == "1.Mannschaft" (Jugenddatenbank)
const normalizeTeam = (name) => (name || "").toLowerCase().replace(/\s+/g, "");
export const findLinkedTeamId = (links, teamName) => {
  const entry = Object.entries(links || {}).find(([name]) => normalizeTeam(name) === normalizeTeam(teamName));
  return entry ? entry[1] : null;
};

export const fetchTeamMatches = async (teamId) => {
  const response = await fetch(`/api/fussballde?teamId=${teamId}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.status);
  return data.matches || [];
};

// Nächstes Spiel (ein laufendes Spiel bleibt bis 2 Stunden nach Anpfiff "das nächste")
export const nextMatchFrom = (matches, now = new Date()) => {
  const upcoming = matches
    .filter(m => m.date)
    .map(m => ({ ...m, kickoff: new Date(`${m.date}T${m.time || "23:59"}`) }))
    .filter(m => m.kickoff.getTime() + 2 * 60 * 60 * 1000 > now.getTime())
    .sort((a, b) => a.kickoff - b.kickoff);
  if (upcoming.length === 0) return null;
  const m = upcoming[0];
  return {
    opponent: m.isHome ? m.away : m.home,
    date: m.date,
    time: m.time || "",
    isHome: m.venue ? isAtHomeVenue(m.venue) : m.isHome,
    location: m.venue || "",
    competition: m.competition,
    source: "fussball.de"
  };
};
