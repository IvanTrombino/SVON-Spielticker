import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export const conflictsDocRef = (clubId) => doc(db, "ticker", `${clubId}_pitchConflicts`);
const bookingsDocRef = (clubId) => doc(db, "ticker", `${clubId}_bookings`);

// Alle Buchungen, die am Tag dateStr auf dem Platz pitchId zeitlich überlappen
export const findOverlappingBookings = (bookings, { pitchId, date, startTime, endTime }) =>
  bookings.filter(b => {
    if (b.pitchId !== pitchId) return false;
    const occurs = b.repetition === "Einmalig"
      ? b.date === date
      : date >= b.startDate && date <= b.endDate
        && b.days.includes(DAY_NAMES[new Date(date).getDay()])
        && !(b.exceptions || []).includes(date);
    return occurs && startTime < b.endTime && endTime > b.startTime;
  });

const SHARE_VALUES = { "Ganz": 1, "Halb": 0.5, "Viertel": 0.25 };

// Buchungen, die am Ziel (Platz/Tag/Zeit) im Weg wären – nur wenn der Platzanteil nicht mehr reicht
export const findMoveConflicts = (bookings, booking, toPitchId, toDate) => {
  const overlapping = findOverlappingBookings(bookings, { pitchId: toPitchId, date: toDate, startTime: booking.startTime, endTime: booking.endTime })
    .filter(b => b.id !== booking.id);
  const used = overlapping.reduce((sum, b) => sum + SHARE_VALUES[b.share || "Ganz"], 0);
  return used + SHARE_VALUES[booking.share || "Ganz"] > 1 ? overlapping : [];
};

// Buchung bearbeiten. scope "occurrence" = nur dieser Termin, "series" = ganze Serie.
// Bei einer Serie und "nur dieser Termin" wird der Termin aus der Serie herausgenommen
// und als Einzeltermin mit den Änderungen neu angelegt.
export const applyBookingEdit = (bookings, booking, occurrenceDate, changes, scope = "occurrence") => {
  if (booking.repetition === "Einmalig") {
    return bookings.map(b => b.id === booking.id ? { ...b, ...changes } : b);
  }
  if (scope === "series") {
    // eslint-disable-next-line no-unused-vars
    const { date, ...seriesChanges } = changes;
    return bookings.map(b => b.id === booking.id ? { ...b, ...seriesChanges } : b);
  }
  const single = {
    ...booking,
    id: `${booking.id}-${occurrenceDate}-${Date.now()}`,
    repetition: "Einmalig",
    date: occurrenceDate,
    startDate: null,
    endDate: null,
    days: [],
    exceptions: [],
    ...changes
  };
  return [
    ...bookings.map(b => b.id === booking.id ? { ...b, exceptions: [...(b.exceptions || []), occurrenceDate] } : b),
    single
  ];
};

// Einen Termin auf anderen Platz/Tag verschieben (bei Serien nur diesen Termin)
export const moveBookingInList = (bookings, booking, fromDate, toPitchId, toDate, movedFrom) =>
  applyBookingEdit(bookings, booking, fromDate, { pitchId: toPitchId, date: toDate, movedFrom });

// Einen Termin absagen: einmalige Buchung löschen, bei Serien nur diesen Tag ausnehmen
export const cancelOccurrence = (bookings, booking, date) =>
  booking.repetition === "Einmalig"
    ? bookings.filter(b => b.id !== booking.id)
    : bookings.map(b => b.id === booking.id ? { ...b, exceptions: [...(b.exceptions || []), date] } : b);

// Alle Termine einer Serie ab fromDate (für die Konfliktprüfung beim Bearbeiten der ganzen Serie)
export const seriesOccurrences = (booking, fromDate) => {
  const dates = [];
  const start = new Date(`${fromDate > booking.startDate ? fromDate : booking.startDate}T00:00:00Z`);
  const end = new Date(`${booking.endDate}T00:00:00Z`);
  for (const d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (booking.days.includes(DAY_NAMES[d.getUTCDay()]) && !(booking.exceptions || []).includes(iso)) dates.push(iso);
  }
  return dates;
};

// --- PLATZSPERRUNGEN ---
export const isPitchClosed = (closures, pitchId, date) => closures.some(c => c.pitchId === pitchId && c.date === date);

// Alle Buchungen, die an diesem Tag auf dem Platz stattfinden
export const bookingsOnPitchDay = (bookings, pitchId, date) =>
  findOverlappingBookings(bookings, { pitchId, date, startTime: "00:00", endTime: "23:59" })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

// Neue Konflikt-Anfrage an Vorstand/Jugendleitung speichern
export const createConflictRequest = (clubId, request) =>
  runTransaction(db, async (transaction) => {
    const snap = await transaction.get(conflictsDocRef(clubId));
    const list = snap.exists() ? snap.data().list || [] : [];
    const entry = { id: Date.now().toString(), createdAt: new Date().toISOString(), status: "offen", ...request };
    transaction.set(conflictsDocRef(clubId), { list: [...list, entry] });
    return entry;
  });

// Genehmigen: Anfrage wird gebucht, bisherige Belegungen an diesem Tag/Zeitraum werden entfernt
// (einmalige Buchung gelöscht, bei einer Serie nur dieser Termin als Ausnahme)
export const approveConflict = (clubId, conflictId, decidedBy, note) =>
  runTransaction(db, async (transaction) => {
    const conflictsSnap = await transaction.get(conflictsDocRef(clubId));
    const bookingsSnap = await transaction.get(bookingsDocRef(clubId));
    const conflicts = conflictsSnap.exists() ? conflictsSnap.data().list || [] : [];
    const bookings = bookingsSnap.exists() ? bookingsSnap.data().list || [] : [];

    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict || conflict.status !== "offen") throw new Error("Konflikt wurde bereits entschieden.");

    const requested = conflict.booking;
    const overlapping = findOverlappingBookings(bookings, requested);
    const overlappingIds = overlapping.map(b => b.id);

    const updatedBookings = bookings
      .filter(b => !(overlappingIds.includes(b.id) && b.repetition === "Einmalig"))
      .map(b => (overlappingIds.includes(b.id) && b.repetition !== "Einmalig")
        ? { ...b, exceptions: [...(b.exceptions || []), requested.date] }
        : b);
    updatedBookings.push({ ...requested, id: Date.now().toString() });

    const updatedConflicts = conflicts.map(c => c.id === conflictId ? {
      ...c,
      status: "genehmigt",
      decidedBy,
      decidedAt: new Date().toISOString(),
      decisionNote: note || "",
      displacedTeams: overlapping.map(b => b.team)
    } : c);

    transaction.set(bookingsDocRef(clubId), { list: updatedBookings });
    transaction.set(conflictsDocRef(clubId), { list: updatedConflicts });
  });

// Ablehnen: Kalender bleibt unverändert, nur die Entscheidung wird dokumentiert
export const rejectConflict = (clubId, conflictId, decidedBy, note) =>
  runTransaction(db, async (transaction) => {
    const snap = await transaction.get(conflictsDocRef(clubId));
    const conflicts = snap.exists() ? snap.data().list || [] : [];
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict || conflict.status !== "offen") throw new Error("Konflikt wurde bereits entschieden.");

    transaction.set(conflictsDocRef(clubId), {
      list: conflicts.map(c => c.id === conflictId ? {
        ...c,
        status: "abgelehnt",
        decidedBy,
        decidedAt: new Date().toISOString(),
        decisionNote: note || ""
      } : c)
    });
  });
