// Spieltags-Zu-/Absage: Trainer legt einen Termin an und teilt einen Link,
// Eltern sagen ohne Anmeldung für ihr Kind zu oder ab.

export const STATUS = {
  yes: { label: "Bin dabei", icon: "✅", color: "#27ae60", background: "#eafaf1" },
  no: { label: "Bin nicht dabei", icon: "❌", color: "#c0392b", background: "#fdecea" }
};

// Alte Antworten (z. B. früheres „Unsicher“) gelten als offen
export const statusOf = (response) => (response && STATUS[response.status]) || null;

// Trainer-Auswahl bei begrenzter Kinderzahl
export const SELECTION = {
  confirmed: { label: "Bestätigt", icon: "👍", color: "#1e8449" },
  waitlist: { label: "Warteliste", icon: "⏳", color: "#b9770e" }
};

export const formatResponseTime = (ts) => ts?.toDate
  ? ts.toDate().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + " Uhr"
  : "";

export const EVENT_TYPES = ["Spiel", "Training", "Turnier", "Sonstiges"];

// In der Abstimmung mit Vor- und Nachnamen
export const rosterName = (p) => `${(p.firstName || "").trim()} ${(p.lastName || "").trim()}`.trim();

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
  event.maxPlayers ? `👥 Max. ${event.maxPlayers} Kinder – die Trainer entscheiden, wer dabei ist` : null,
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
  const counts = { yes: 0, no: 0, open: 0 };
  roster.forEach(r => { const s = responses[r.key]?.status; counts[STATUS[s] ? s : "open"]++; });
  return counts;
};

export const laundryName = (roster, responses) => roster.find(r => responses[r.key]?.laundry)?.name || "";

// Bestätigte Kinder und Warteliste (nur Kinder mit Zusage), Warteliste in Reihenfolge der Rückmeldung
export const selectionLists = (event, responses) => {
  const yes = (event.roster || []).filter(r => responses[r.key]?.status === "yes");
  const byTime = (a, b) => (responses[a.key]?.updatedAt?.toMillis?.() ?? 0) - (responses[b.key]?.updatedAt?.toMillis?.() ?? 0);
  const selection = event.selection || {};
  return {
    confirmed: yes.filter(r => selection[r.key] === "confirmed").sort((a, b) => a.name.localeCompare(b.name)),
    waitlist: yes.filter(r => selection[r.key] === "waitlist").sort(byTime),
    undecided: yes.filter(r => !selection[r.key]).sort(byTime)
  };
};

export const resultText = (event, responses) => {
  const { confirmed, waitlist } = selectionLists(event, responses);
  const laundry = laundryName(event.roster || [], responses);
  return [
    `📋 ${event.team}: ${event.title || event.type}`,
    `📅 ${formatEventDate(event)}${event.meetTime ? ` (Treffpunkt ${event.meetTime} Uhr)` : ""}`,
    event.location ? `📍 ${event.location}` : null,
    "",
    `👍 Dabei (${confirmed.length}${event.maxPlayers ? `/${event.maxPlayers}` : ""}):`,
    ...(confirmed.length ? confirmed.map((r, i) => `${i + 1}. ${r.name}`) : ["–"]),
    ...(waitlist.length ? ["", `⏳ Warteliste (${waitlist.length}):`, ...waitlist.map((r, i) => `${i + 1}. ${r.name}`)] : []),
    laundry ? "" : null,
    laundry ? `🧺 Trikotwäsche: ${laundry}` : null
  ].filter(line => line !== null).join("\n");
};
