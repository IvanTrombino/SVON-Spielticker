// Spieltags-Zu-/Absage: Trainer legt einen Termin an und teilt einen Link,
// Eltern sagen ohne Anmeldung für ihr Kind zu oder ab.

export const STATUS = {
  yes: { label: "Dabei", icon: "✅", color: "#27ae60", background: "#eafaf1" },
  no: { label: "Nicht dabei", icon: "❌", color: "#c0392b", background: "#fdecea" },
  maybe: { label: "Unsicher", icon: "❔", color: "#b9770e", background: "#fef9e7" }
};

export const EVENT_TYPES = ["Spiel", "Training", "Turnier", "Sonstiges"];

// In der Elternliste nur Vorname + Initial des Nachnamens
export const rosterName = (p) => `${(p.firstName || "").trim()} ${(p.lastName || "").trim().charAt(0)}${p.lastName ? "." : ""}`.trim();

export const buildRoster = (players) =>
  [...players]
    .sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""))
    .map(p => ({ key: p.id, name: rosterName(p) }));

export const attendanceLink = (eventId) => `${window.location.origin}/?zusage=${eventId}`;

export const formatEventDate = (event) => {
  const date = event.date ? new Date(`${event.date}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  return [date, event.time ? `${event.time} Uhr` : ""].filter(Boolean).join(", ");
};

export const shareText = (event) => [
  `⚽ ${event.team}: ${event.title || event.type}`,
  `📅 ${formatEventDate(event)}${event.meetTime ? ` (Treffpunkt ${event.meetTime} Uhr)` : ""}`,
  event.location ? `📍 ${event.location}` : null,
  event.note ? `ℹ️ ${event.note}` : null,
  "",
  "Bitte für euer Kind zu- oder absagen:",
  attendanceLink(event.id)
].filter(line => line !== null).join("\n");

export const reminderText = (event, missingNames) => [
  `⏰ Erinnerung ${event.team}: ${event.title || event.type} am ${formatEventDate(event)}`,
  `Noch keine Rückmeldung: ${missingNames.join(", ")}`,
  "",
  "Bitte kurz zu- oder absagen:",
  attendanceLink(event.id)
].join("\n");

export const shareViaWhatsApp = (text) => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");

export const countResponses = (roster, responses) => {
  const counts = { yes: 0, no: 0, maybe: 0, open: 0 };
  roster.forEach(r => { const s = responses[r.key]?.status; counts[s || "open"]++; });
  return counts;
};
