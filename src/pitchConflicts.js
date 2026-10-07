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

// Einen Termin auf anderen Platz/Tag verschieben. Einmalige Buchung wird geändert,
// bei einer Serie wird nur dieser Termin herausgenommen und als Einzeltermin neu angelegt.
export const moveBookingInList = (bookings, booking, fromDate, toPitchId, toDate, movedFrom) => {
  if (booking.repetition === "Einmalig") {
    return bookings.map(b => b.id === booking.id ? { ...b, pitchId: toPitchId, date: toDate, movedFrom } : b);
  }
  const single = {
    ...booking,
    id: `${booking.id}-${fromDate}-${Date.now()}`,
    repetition: "Einmalig",
    date: toDate,
    startDate: null,
    endDate: null,
    days: [],
    exceptions: [],
    pitchId: toPitchId,
    movedFrom
  };
  return [
    ...bookings.map(b => b.id === booking.id ? { ...b, exceptions: [...(b.exceptions || []), fromDate] } : b),
    single
  ];
};

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
