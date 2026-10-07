// Namensnennung im Live-Ticker: Spieler ohne Einwilligung erscheinen öffentlich nur mit Initialen.
// Die Jugenddatenbank (Admin) pflegt dafür das Dokument ticker/<verein>_nameDisplay,
// der Ticker liest es, bevor Namen öffentlich gespeichert, gepusht oder geteilt werden.

// Reihenfolge- und schreibweisenunabhängig: "Baumann Sidney" == "Sidney Baumann" == "baumann, sidney"
export const nameKey = (name) =>
  (name || "").toLowerCase().replace(/[,.;]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");

export const initialsOf = (firstName, lastName) =>
  [firstName, lastName].map(n => (n || "").trim()).filter(Boolean).map(n => `${n[0].toUpperCase()}.`).join(" ");

// Alle Spieler ohne Einwilligung -> { nameKey: Initialen }
export const buildNameDisplayMap = (players) =>
  Object.fromEntries(
    players
      .filter(p => !p.nameConsent && (p.firstName || p.lastName))
      .map(p => [nameKey(`${p.firstName || ""} ${p.lastName || ""}`), initialsOf(p.firstName, p.lastName)])
  );

export const displayNameFor = (map, name) => (map && map[nameKey(name)]) || name;
