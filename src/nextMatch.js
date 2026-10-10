// Nächstes Spiel: fussball.de liefert automatisch, Trainer können anpassen/ergänzen oder selbst anlegen.
// Gespeichert in ticker/<verein>_next_matches als { Mannschaft: Eintrag }.
// Einträge mit override: true (vom Trainer) haben Vorrang vor fussball.de, bis das Spiel vorbei ist.

export const NEXT_KINDS = ["Spiel", "Freundschaftsspiel", "Turnier", "Sonstiges"];

// Ein Spiel bleibt bis 2 Stunden nach Anpfiff "das nächste" (ohne Uhrzeit: bis Tagesende)
export const isOver = (entry, now = new Date()) => {
  if (!entry?.date) return false;
  const kickoff = new Date(`${entry.date}T${entry.time || "23:59"}`);
  return kickoff.getTime() + 2 * 60 * 60 * 1000 < now.getTime();
};

export const isActiveOverride = (manual, now = new Date()) => !!(manual?.override && manual.date && !isOver(manual, now));

// Was angezeigt wird: Trainer-Eintrag (solange aktuell) > fussball.de > alter Eintrag ohne Vorrang (nur ohne fussball.de)
export const effectiveNextMatch = (auto, manual, now = new Date()) => {
  if (isActiveOverride(manual, now)) return { ...manual, source: "trainer" };
  if (auto) return { ...auto, kind: "Spiel", source: "fussball.de" };
  if (manual && !manual.override && (manual.opponent || manual.date)) return { ...manual, source: "manuell" };
  return null;
};

export const nextMatchTitle = (m) => {
  if (!m) return "";
  const kind = m.kind || "Spiel";
  if (kind === "Turnier") return `🏆 Turnier${m.opponent ? `: ${m.opponent}` : ""}`;
  if (kind === "Sonstiges") return m.opponent || "Termin";
  if (!m.opponent) return "Gegner noch offen";
  const prefix = kind === "Freundschaftsspiel" ? "Freundschaftsspiel" : (m.isHome ? "Heimspiel" : "Auswärtsspiel");
  return `${prefix} gegen ${m.opponent}`;
};

export const formatNextDate = (date) => date
  ? new Date(`${date}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })
  : "";

export const meetText = (m) => [m?.meetTime ? `${m.meetTime} Uhr` : "", m?.meetPlace || ""].filter(Boolean).join(", ");

// Abweichungen zwischen Trainer-Eintrag und fussball.de (z. B. Spielverlegung)
export const differencesToAuto = (manual, auto) => {
  if (!manual || !auto) return [];
  const fields = [["date", "Datum"], ["time", "Uhrzeit"], ["opponent", "Gegner"], ["location", "Spielort"]];
  return fields
    .filter(([key]) => (auto[key] || "") && (auto[key] || "") !== (manual[key] || ""))
    .map(([key, label]) => `${label}: ${key === "date" ? formatNextDate(auto[key]) : auto[key]}`);
};

export const nextMatchShareText = (team, m) => [
  `⚽ ${team}: ${nextMatchTitle(m)}`,
  `📅 ${formatNextDate(m.date)}${m.time ? `, ${m.time} Uhr` : ""}`,
  m.location ? `📍 ${m.location}` : null,
  meetText(m) ? `⏱ Treffpunkt: ${meetText(m)}` : null,
  m.equipment ? `🎒 Mitbringen: ${m.equipment}` : null,
  m.note ? `ℹ️ ${m.note}` : null,
  m.organization ? `📋 ${m.organization}` : null
].filter(Boolean).join("\n");
