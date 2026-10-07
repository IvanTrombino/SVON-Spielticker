import React, { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { findOverlappingBookings, createConflictRequest, findMoveConflicts, moveBookingInList, applyBookingEdit, cancelOccurrence, seriesOccurrences, isPitchClosed, bookingsOnPitchDay } from "../pitchConflicts";
import PitchConflicts from "./PitchConflicts";
import FussballImport from "./FussballImport";

// isAdmin: Plätze verwalten, Dashboard bearbeiten, Massen-Stornierung und Konflikte entscheiden
export default function PitchManager({ clubId, teams, currentUserName, isAdmin = false }) {
  // --- NAVIGATION & VIEW STATES ---
  const [activeTab, setActiveTab] = useState("schedule"); // "schedule", "book", "manage", "dashboard", "conflicts"
  const [calendarView, setCalendarView] = useState("3days"); // "week", "3days", "day"
  const [viewDate, setViewDate] = useState(new Date());
  
  // --- FILTER STATES ---
  const [filterPitch, setFilterPitch] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showLegend, setShowLegend] = useState(false); // NEU: Legende anzeigen

  // --- CLOUD-STATE ---
  const [pitches, setPitches] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [teamCoaches, setTeamCoaches] = useState({}); // NEU: Trainer pro Team speichern

  // --- FORMULAR-STATE FÜR NEUEN PLATZ ---
  const [newPitchName, setNewPitchName] = useState("");
  const [hasFloodlight, setHasFloodlight] = useState(false);
  const [hasCabin, setHasCabin] = useState(false);

  // --- FORMULAR-STATE FÜR NEUE BUCHUNG ---
  const [bookTeam, setBookTeam] = useState(teams && teams.length > 0 ? teams[0] : "");
  const [bookType, setBookType] = useState("Training");
  const [bookPitch, setBookPitch] = useState("");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:30");
  const [bookShare, setBookShare] = useState("Ganz"); 
  const [repetition, setRepetition] = useState("Einmalig"); 
  const [bookDate, setBookDate] = useState(new Date().toISOString().split("T")[0]); 
  
  const [seriesStartDate, setSeriesStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [seriesEndDate, setSeriesEndDate] = useState("");
  const [bookDays, setBookDays] = useState([]); 
  const [bookNotes, setBookNotes] = useState("");

  // --- DASHBOARD EDIT STATE ---
  const [editingCoachForTeam, setEditingCoachForTeam] = useState(null);
  const [tempCoachName, setTempCoachName] = useState("");

  // --- KONFLIKT-STATE ---
  const [conflictBooking, setConflictBooking] = useState(null);
  const [isSendingConflict, setIsSendingConflict] = useState(false);

  // --- VERSCHIEBEN (Drag & Drop am PC, Antippen am Handy) ---
  const [dragging, setDragging] = useState(null); // { booking, fromDate, fromPitchId }
  const [dropTarget, setDropTarget] = useState(null); // "pitchId|datum"
  const [editDialog, setEditDialog] = useState(null); // Buchung bearbeiten/verschieben (siehe openEditDialog)

  // --- PLATZSPERRUNGEN ---
  const [closures, setClosures] = useState([]); // [{ id, pitchId, date, reason, closedBy }]
  const [closeDialog, setCloseDialog] = useState(null); // { pitchId, date, reason, targetPitchId }

  const daysOfWeek = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  const bookingTypes = ["Training", "Ligaspiel", "Pokalspiel", "Freundschaftsspiel"];

  // --- DATEN AUS FIREBASE LADEN ---
  useEffect(() => {
    if (!clubId) return;

    const unsubPitches = onSnapshot(doc(db, "ticker", `${clubId}_pitches`), (snap) => {
      if (snap.exists()) setPitches(snap.data().list || []);
      else setPitches([]);
    });

    const unsubBookings = onSnapshot(doc(db, "ticker", `${clubId}_bookings`), (snap) => {
      if (snap.exists()) setBookings(snap.data().list || []);
      else setBookings([]);
    });

    const unsubClosures = onSnapshot(doc(db, "ticker", `${clubId}_closures`), (snap) => {
      setClosures(snap.exists() ? snap.data().list || [] : []);
    });

    const unsubCoaches = onSnapshot(doc(db, "ticker", `${clubId}_teamCoaches`), (snap) => {
      if (snap.exists()) setTeamCoaches(snap.data() || {});
      else setTeamCoaches({});
    });

    return () => {
      unsubPitches();
      unsubBookings();
      unsubCoaches();
      unsubClosures();
    };
  }, [clubId]);

  useEffect(() => {
    if (pitches.length > 0 && !bookPitch) {
      setBookPitch(pitches[0].id);
    }
  }, [pitches, bookPitch]);

  // --- HILFSFUNKTIONEN ---
  const syncPitches = async (newList) => {
    try { await setDoc(doc(db, "ticker", `${clubId}_pitches`), { list: newList }); } 
    catch (error) { console.error("Fehler:", error); }
  };

  const syncBookings = async (newList) => {
    try { await setDoc(doc(db, "ticker", `${clubId}_bookings`), { list: newList }); } 
    catch (error) { console.error("Fehler:", error); }
  };

  const syncClosures = async (newList) => {
    try { await setDoc(doc(db, "ticker", `${clubId}_closures`), { list: newList }); }
    catch (error) { console.error("Fehler:", error); }
  };

  const syncCoaches = async (newCoaches) => {
    try { await setDoc(doc(db, "ticker", `${clubId}_teamCoaches`), newCoaches); } 
    catch (error) { console.error("Fehler:", error); }
  };

  // Kalender-Berechnungen (Je nach View)
  const getDisplayDates = () => {
    const dates = [];
    const current = new Date(viewDate);

    if (calendarView === "week") {
      const day = current.getDay();
      const diff = current.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(current.setDate(diff));
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d);
      }
    } else if (calendarView === "3days") {
      for (let i = 0; i < 3; i++) {
        const d = new Date(current);
        d.setDate(current.getDate() + i);
        dates.push(d);
      }
    } else {
      dates.push(new Date(current)); // Day view
    }
    return dates;
  };

  const getWeekNumber = (d) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  };

  const displayDates = getDisplayDates();
  const kw = getWeekNumber(displayDates[0]);
  const dateRangeStr = displayDates.length > 1 
    ? `${displayDates[0].getDate()}.${displayDates[0].getMonth()+1}. – ${displayDates[displayDates.length-1].getDate()}.${displayDates[displayDates.length-1].getMonth()+1}.${displayDates[displayDates.length-1].getFullYear()}`
    : `${displayDates[0].getDate()}.${displayDates[0].getMonth()+1}.${displayDates[0].getFullYear()}`;

  const changeDate = (offset) => {
    const newDate = new Date(viewDate);
    if (calendarView === "week") newDate.setDate(viewDate.getDate() + (offset * 7));
    else if (calendarView === "3days") newDate.setDate(viewDate.getDate() + (offset * 3));
    else newDate.setDate(viewDate.getDate() + offset);
    setViewDate(newDate);
  };

  // Feste Farben für die Teams
  const teamColorMap = {
    "1. Mannschaft": "#00838f", // Türkis/Dunkelblau
    "2. Mannschaft": "#fbc02d", // Gelb
    "3. Mannschaft": "#8e24aa", // Lila
    "Damen": "#d81b60",         // Pink/Rot
    "A-Jugend": "#455a64",      // Dunkelgrau
    "B-Jugend": "#388e3c",      // Grün
    "C-Jugend": "#5d4037",      // Braun
    "D-Jugend": "#455a64",      // Graublau
    "E-Jugend": "#e64a19",      // Rot
    "F-Jugend": "#f57c00",      // Orange
    "G-Jugend": "#fbc02d",      // Gelb
    "Alte Herren": "#388e3c"    // Grün
  };

  const getTeamColor = (teamName) => {
    if(!teamName) return "#666666";
    // Versuchen, eine vordefinierte Farbe zu finden (z.B. wenn der Name "1. Mannschaft Herren" lautet)
    for (const [key, color] of Object.entries(teamColorMap)) {
      if (teamName.includes(key)) return color;
    }
    // Fallback: Hash-basierte Farbe
    let hash = 0;
    for (let i = 0; i < teamName.length; i++) hash = teamName.charCodeAt(i) + ((hash << 5) - hash);
    const fallbackColors = ["#1976d2", "#8e24aa", "#00796b"];
    return fallbackColors[Math.abs(hash) % fallbackColors.length];
  };

  const toggleBookDay = (day) => {
    if (bookDays.includes(day)) setBookDays(bookDays.filter(d => d !== day));
    else setBookDays([...bookDays, day]);
  };

  // --- BUCHUNG VERWALTEN ---
  const handleAddBooking = (e) => {
    e.preventDefault();
    setConflictBooking(null);

    if (repetition === "Wöchentlich") {
      if (bookDays.length === 0) return alert("Bitte wähle mindestens einen Wochentag für die Serie aus.");
      if (!seriesEndDate) return alert("Bitte wähle ein Enddatum für die Serie aus.");
      if (seriesStartDate > seriesEndDate) return alert("Das Startdatum darf nicht nach dem Enddatum liegen.");
    }

    const shareValues = { "Ganz": 1, "Halb": 0.5, "Viertel": 0.25 };
    const requestedShareVal = shareValues[bookShare];

    let datesToCheck = [];
    if (repetition === "Einmalig") {
      datesToCheck.push(bookDate);
    } else {
      let curr = new Date(seriesStartDate);
      let end = new Date(seriesEndDate);
      while (curr <= end) {
        const dayNameFull = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][curr.getDay()];
        if (bookDays.includes(dayNameFull)) datesToCheck.push(curr.toISOString().split("T")[0]);
        curr.setDate(curr.getDate() + 1);
      }
    }

    let conflicts = [];
    let validDates = [];

    if (repetition === "Einmalig" && isPitchClosed(closures, bookPitch, bookDate)) {
      return alert("🚫 Dieser Platz ist an dem Tag gesperrt. Bitte einen anderen Platz wählen.");
    }

    datesToCheck.forEach(dateStr => {
      if (isPitchClosed(closures, bookPitch, dateStr)) {
        conflicts.push({ date: dateStr, team: "🚫 Platz gesperrt" });
        return;
      }
      const overlappingBookings = findOverlappingBookings(bookings, { pitchId: bookPitch, date: dateStr, startTime, endTime });

      const currentTotalShare = overlappingBookings.reduce((sum, b) => sum + shareValues[b.share || "Ganz"], 0);

      if (currentTotalShare + requestedShareVal > 1) {
        conflicts.push({ date: dateStr, team: overlappingBookings[0].team });
      } else {
        validDates.push(dateStr);
      }
    });

    if (validDates.length === 0) {
      if (repetition === "Einmalig") {
         setConflictBooking({ team: conflicts[0].team, type: "einem Termin", share: "Platz" });
      } else {
         alert("Fehler: Alle Termine in diesem Zeitraum sind zu dieser Uhrzeit bereits belegt!");
      }
      return;
    }

    if (conflicts.length > 0 && repetition === "Wöchentlich") {
      const confirmMsg = `⚠️ Achtung: An ${conflicts.length} Terminen ist der Platz belegt und wird übersprungen.\nMöchtest du die Serie für die restlichen ${validDates.length} freien Termine trotzdem buchen?`;
      if (!window.confirm(confirmMsg)) return;
    }

    const autoExceptions = conflicts.map(c => c.date);

    const newBooking = {
      id: Date.now().toString(),
      team: bookTeam,
      type: bookType,
      repetition,
      date: repetition === "Einmalig" ? bookDate : null,
      startDate: repetition === "Wöchentlich" ? seriesStartDate : null,
      endDate: repetition === "Wöchentlich" ? seriesEndDate : null,
      days: repetition === "Wöchentlich" ? bookDays : [],
      exceptions: autoExceptions, 
      pitchId: bookPitch,
      startTime,
      endTime,
      share: bookShare,
      notes: bookNotes,
      bookedBy: currentUserName || "Ein Trainer"
    };

    const updatedBookings = [...bookings, newBooking];
    setBookings(updatedBookings);
    syncBookings(updatedBookings);
    alert("✅ Platz erfolgreich gebucht!");
    setActiveTab("schedule");
    setBookNotes("");
  };

  const pitchName = (id) => pitches.find(p => p.id === id)?.name || "Unbekannter Platz";
  const formatDay = (date) => new Date(date).toLocaleDateString("de-DE");

  // Prüft das Ziel einer Buchung (gesperrt/belegt). Gesperrt blockiert immer,
  // bei Belegung darf nur ein Admin nach Rückfrage trotzdem speichern.
  const confirmTargetFree = (bookingsToCheck, edited, dates) => {
    const closedDates = dates.filter(d => isPitchClosed(closures, edited.pitchId, d));
    if (closedDates.length > 0) {
      alert(`🚫 ${pitchName(edited.pitchId)} ist am ${closedDates.map(formatDay).join(", ")} gesperrt.`);
      return false;
    }
    const blocked = dates
      .map(d => ({ date: d, teams: [...new Set(findMoveConflicts(bookingsToCheck, edited, edited.pitchId, d).map(c => c.team))] }))
      .filter(c => c.teams.length > 0);
    if (blocked.length === 0) return true;

    const list = blocked.slice(0, 5).map(c => `${formatDay(c.date)}: ${c.teams.join(", ")}`).join("\n") + (blocked.length > 5 ? `\n… und ${blocked.length - 5} weitere` : "");
    if (!isAdmin) {
      alert(`${pitchName(edited.pitchId)} ist ${edited.startTime}–${edited.endTime} bereits belegt:\n${list}\n\nBitte über "Buchen" einen Konflikt melden.`);
      return false;
    }
    return window.confirm(`⚠️ ${pitchName(edited.pitchId)} ist ${edited.startTime}–${edited.endTime} bereits belegt:\n${list}\n\nTrotzdem speichern?`);
  };

  // Termin per Drag & Drop verschieben (bei Serien nur diesen Termin)
  const moveBooking = (booking, fromDate, fromPitchId, toPitchId, toDate) => {
    if (fromPitchId === toPitchId && fromDate === toDate) return false;
    if (!confirmTargetFree(bookings, { ...booking, pitchId: toPitchId }, [toDate])) return false;

    const seriesHint = booking.repetition === "Einmalig" ? "" : "\n(Nur dieser Termin – die restliche Serie bleibt unverändert.)";
    if (!window.confirm(`${booking.team} (${booking.startTime}–${booking.endTime}) verschieben nach ${pitchName(toPitchId)} am ${formatDay(toDate)}?${seriesHint}`)) return false;

    const updated = moveBookingInList(bookings, booking, fromDate, toPitchId, toDate, `${pitchName(fromPitchId)}, ${formatDay(fromDate)}`);
    setBookings(updated);
    syncBookings(updated);
    return true;
  };

  const openEditDialog = (booking, occurrenceDate, pitchId) => setEditDialog({
    booking,
    fromDate: occurrenceDate,
    fromPitchId: pitchId,
    scope: "occurrence",
    pitchId,
    date: occurrenceDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
    share: booking.share || "Ganz",
    type: booking.type,
    team: booking.team,
    notes: booking.notes || ""
  });

  const saveEdit = () => {
    const d = editDialog;
    if (!d.date || !d.startTime || !d.endTime) return alert("Bitte Datum und Uhrzeit ausfüllen.");
    if (d.startTime >= d.endTime) return alert("Die Endzeit muss nach der Startzeit liegen.");

    const isSeriesEdit = d.booking.repetition !== "Einmalig" && d.scope === "series";
    const changes = { pitchId: d.pitchId, startTime: d.startTime, endTime: d.endTime, share: d.share, type: d.type, team: d.team, notes: d.notes };
    if (!isSeriesEdit) changes.date = d.date;
    if (d.pitchId !== d.fromPitchId || (!isSeriesEdit && d.date !== d.fromDate)) {
      changes.movedFrom = `${pitchName(d.fromPitchId)}, ${formatDay(d.fromDate)}`;
    }

    const edited = { ...d.booking, ...changes };
    const today = new Date().toLocaleDateString("sv-SE");
    const datesToCheck = isSeriesEdit ? seriesOccurrences(d.booking, today) : [d.date];
    if (!confirmTargetFree(bookings, edited, datesToCheck)) return;

    const updated = applyBookingEdit(bookings, d.booking, d.fromDate, changes, isSeriesEdit ? "series" : "occurrence");
    setBookings(updated);
    syncBookings(updated);
    setEditDialog(null);
  };

  // Platz an einem Tag sperren und alle Buchungen umbuchen (oder absagen)
  const handleClosePitch = () => {
    const { pitchId, date, reason, targetPitchId } = closeDialog;
    if (!date) return alert("Bitte ein Datum wählen.");
    if (isPitchClosed(closures, pitchId, date)) return alert("Dieser Platz ist an dem Tag bereits gesperrt.");

    const affected = bookingsOnPitchDay(bookings, pitchId, date);
    let updated = bookings;

    if (affected.length > 0 && targetPitchId) {
      if (isPitchClosed(closures, targetPitchId, date)) return alert(`🚫 ${pitchName(targetPitchId)} ist an dem Tag ebenfalls gesperrt.`);
      // Nacheinander prüfen, damit auch bereits umgebuchte Termine mitzählen
      const problems = [];
      affected.forEach(b => {
        const inWay = findMoveConflicts(updated, { ...b, pitchId: targetPitchId }, targetPitchId, date);
        if (inWay.length > 0) problems.push(`${b.startTime}–${b.endTime} ${b.team} ↔ ${[...new Set(inWay.map(c => c.team))].join(", ")}`);
        updated = moveBookingInList(updated, b, date, targetPitchId, date, `${pitchName(pitchId)} (gesperrt)`);
      });
      if (problems.length > 0 && !window.confirm(`⚠️ Auf ${pitchName(targetPitchId)} gibt es Überschneidungen:\n${problems.join("\n")}\n\nTrotzdem alle umbuchen?`)) return;
    } else if (affected.length > 0) {
      affected.forEach(b => { updated = cancelOccurrence(updated, b, date); });
    }

    const action = affected.length === 0 ? "" : targetPitchId ? `\n${affected.length} Buchung(en) werden nach ${pitchName(targetPitchId)} verlegt.` : `\n${affected.length} Buchung(en) werden ABGESAGT.`;
    if (!window.confirm(`${pitchName(pitchId)} am ${formatDay(date)} sperren?${action}`)) return;

    if (updated !== bookings) {
      setBookings(updated);
      syncBookings(updated);
    }
    const newClosures = [...closures, { id: Date.now().toString(), pitchId, date, reason: reason.trim(), closedBy: currentUserName || "Admin" }];
    setClosures(newClosures);
    syncClosures(newClosures);
    setCloseDialog(null);
  };

  const handleReopenPitch = (closure) => {
    if (!window.confirm(`Sperre für ${pitchName(closure.pitchId)} am ${formatDay(closure.date)} aufheben?\n(Umgebuchte Termine bleiben auf dem Ausweichplatz.)`)) return;
    const newClosures = closures.filter(c => c.id !== closure.id);
    setClosures(newClosures);
    syncClosures(newClosures);
  };

  const handleDrop = (pitchId, date) => {
    if (dragging) moveBooking(dragging.booking, dragging.fromDate, dragging.fromPitchId, pitchId, date);
    setDragging(null);
    setDropTarget(null);
  };

  const handleDeleteBooking = (b, cellDateString) => {
    if (b.repetition === "Wöchentlich") {
      const choice = window.prompt("Diese Buchung ist Teil einer Serie.\nTippe '1' = NUR diesen Termin stornieren.\nTippe '2' = Die KOMPLETTE Serie stornieren.");
      if (choice === "1") {
        const updatedBookings = bookings.map(bk => {
          if (bk.id === b.id) return { ...bk, exceptions: [...(bk.exceptions || []), cellDateString] };
          return bk;
        });
        setBookings(updatedBookings);
        syncBookings(updatedBookings);
      } else if (choice === "2") {
        const updatedBookings = bookings.filter(bk => bk.id !== b.id);
        setBookings(updatedBookings);
        syncBookings(updatedBookings);
      }
    } else {
      if (window.confirm("Diese einmalige Platzbelegung wirklich löschen?")) {
        const updatedBookings = bookings.filter(bk => bk.id !== b.id);
        setBookings(updatedBookings);
        syncBookings(updatedBookings);
      }
    }
  };

  const handleBulkDelete = (action) => {
    setShowMenu(false);
    let updated = [...bookings];

    if (action === "all") {
      if (window.confirm("ACHTUNG: Willst du wirklich ALLE Buchungen restlos löschen?")) updated = [];
      else return;
    } else if (action === "pitch") {
      if (!filterPitch) return alert("Bitte wähle zuerst einen Platz im Filter aus!");
      if (window.confirm("Alle Buchungen für diesen Platz löschen?")) updated = bookings.filter(b => b.pitchId !== filterPitch);
      else return;
    } else if (action === "team") {
      if (!filterTeam) return alert("Bitte wähle zuerst eine Mannschaft im Filter aus!");
      if (window.confirm("Alle Buchungen dieser Mannschaft löschen?")) updated = bookings.filter(b => b.team !== filterTeam);
      else return;
    }

    setBookings(updated);
    syncBookings(updated);
  };

  // Konflikt als Anfrage speichern (Admin entscheidet im Admin Portal) und per Push melden
  const sendConflictToJugendleitung = async () => {
    setIsSendingConflict(true);
    try {
      const pitchName = pitches.find(p => p.id === bookPitch)?.name || "Unbekannter Platz";
      const requestedBy = currentUserName || bookTeam;
      const conflictTeams = [...new Set(findOverlappingBookings(bookings, { pitchId: bookPitch, date: bookDate, startTime, endTime }).map(b => b.team))];

      await createConflictRequest(clubId, {
        requestedBy,
        conflictTeams,
        booking: {
          team: bookTeam,
          type: bookType,
          repetition: "Einmalig",
          date: bookDate,
          startDate: null,
          endDate: null,
          days: [],
          exceptions: [],
          pitchId: bookPitch,
          startTime,
          endTime,
          share: bookShare,
          notes: bookNotes,
          bookedBy: requestedBy
        }
      });

      const message = `${requestedBy} (${bookTeam}) benötigt den ${pitchName} am ${new Date(bookDate).toLocaleDateString("de-DE")} (${startTime}-${endTime}). Platz ist belegt durch ${conflictTeams.join(", ")}. Bitte im Admin Portal entscheiden!`;
      // Push ist nur ein Zusatz – die Anfrage ist bereits gespeichert
      fetch(`https://ntfy.sh/${clubId}vorstandundjugend`, { method: "POST", body: `🏟️ Platzkonflikt: ${message}`, headers: { "Priority": "high" } }).catch(() => {});

      alert("Vorstand und Jugendleitung wurden benachrichtigt! Die Entscheidung siehst du unter \"⚠️ Konflikte\".");
      setConflictBooking(null);
      setActiveTab("conflicts");
    } catch (error) {
      console.error("Fehler beim Melden des Konflikts:", error);
      alert("Fehler beim Senden.");
    } finally {
      setIsSendingConflict(false);
    }
  };

  const shareConflictViaWhatsApp = () => {
    const pitchName = pitches.find(p => p.id === bookPitch)?.name || "Unbekannter Platz";
    const text = `Hallo! Ich (${currentUserName || bookTeam}) bräuchte von ${startTime} bis ${endTime} den ${pitchName} für ein ${bookType}. Aktuell steht dort ${conflictBooking.team} im Plan. Können wir uns einigen?`;
    if (navigator.share) navigator.share({ title: "Platzanfrage", text: text }).catch(() => {});
    else { navigator.clipboard.writeText(text); alert("Nachricht kopiert."); }
  };

  const handleAddPitch = (e) => {
    e.preventDefault();
    if (!newPitchName.trim()) return;
    const newPitch = { id: Date.now().toString(), name: newPitchName.trim(), hasFloodlight, hasCabin };
    const updated = [...pitches, newPitch];
    setPitches(updated); syncPitches(updated);
    setNewPitchName(""); setHasFloodlight(false); setHasCabin(false);
  };

  const handleDeletePitch = (id) => {
    if (window.confirm("Diesen Platz wirklich löschen?")) {
      const updated = pitches.filter(p => p.id !== id);
      setPitches(updated); syncPitches(updated);
    }
  };

  // Hilfsfunktion fürs Dashboard (Welche Tage trainiert Team X?)
  const getTrainingDaysForTeam = (teamName) => {
    const teamBookings = bookings.filter(b => b.team === teamName && b.type === "Training");
    let days = new Set();
    teamBookings.forEach(b => {
      if(b.repetition === "Wöchentlich" && b.days) {
         b.days.forEach(d => days.add(d.substring(0,2))); 
      } else if (b.date) {
         const d = new Date(b.date);
         days.add(["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()]);
      }
    });
    return Array.from(days).join("+") || "Keine Serie";
  };

  // --- UI STYLES ---
  const tabButtonStyle = (tabName) => ({
    flex: 1, padding: "10px",
    background: activeTab === tabName ? "#2146d0" : "#e0e0e0",
    color: activeTab === tabName ? "white" : "#333",
    border: "none", borderRadius: "8px", fontWeight: "bold",
    cursor: "pointer", fontSize: "13px"
  });

  const inputStyle = { padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box", fontSize: "14px", color: "#333", background: "white" };
  const shareBtnStyle = (val) => ({
    flex: 1, padding: "12px", border: "1px solid #ccc", background: bookShare === val ? "#f0f0f0" : "white", cursor: "pointer",
    fontWeight: bookShare === val ? "bold" : "normal", textAlign: "center", fontSize: "12px",
    borderLeft: val !== "Viertel" ? "none" : "1px solid #ccc",
    borderTopLeftRadius: val === "Viertel" ? "8px" : "0", borderBottomLeftRadius: val === "Viertel" ? "8px" : "0",
    borderTopRightRadius: val === "Ganz" ? "8px" : "0", borderBottomRightRadius: val === "Ganz" ? "8px" : "0"
  });

  return (
    <div style={{ padding: "10px", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto", color: "#333" }}>
      <h2 style={{ color: "#2146d0", textAlign: "center", marginBottom: "15px" }}>🏟 Platzbelegung</h2>

      {/* TABS */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button onClick={() => setActiveTab("schedule")} style={tabButtonStyle("schedule")}>📅 Kalender</button>
        <button onClick={() => setActiveTab("dashboard")} style={tabButtonStyle("dashboard")}>📋 Dashboard</button>
        <button onClick={() => setActiveTab("book")} style={tabButtonStyle("book")}>➕ Buchen</button>
        {isAdmin && <button onClick={() => setActiveTab("manage")} style={tabButtonStyle("manage")}>⚙ Plätze verwalten</button>}
        <button onClick={() => setActiveTab("conflicts")} style={tabButtonStyle("conflicts")}>⚠️ Konflikte</button>
        {isAdmin && <button onClick={() => setActiveTab("import")} style={tabButtonStyle("import")}>📥 fussball.de</button>}
      </div>

      {/* TAB 1: KALENDER GRID */}
      {activeTab === "schedule" && (
        <div style={{ textAlign: "left", overflowX: "auto" }}>
          {pitches.length === 0 ? (
            <p style={{ color: "#666", textAlign: "center" }}>Noch keine Plätze angelegt.</p>
          ) : (
            <div style={{ minWidth: calendarView === "week" ? "1000px" : calendarView === "3days" ? "560px" : "100%" }}> 
              
              {/* Header über allem */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px", marginBottom: "20px", background: "white", padding: "12px 20px", borderRadius: "10px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
                
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <button onClick={() => setViewDate(new Date())} style={{ padding: "6px 12px", background: "white", border: "1px solid #27ae60", color: "#27ae60", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>📅 Heute</button>
                  <button onClick={() => changeDate(-1)} style={{ background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", color: "#555" }}>&lt;</button>
                  <button onClick={() => changeDate(1)} style={{ background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", color: "#555" }}>&gt;</button>
                  <strong style={{ fontSize: "16px", marginLeft: "5px" }}>{calendarView === "week" ? `KW ${kw} · ` : ""}{dateRangeStr}</strong>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative", flexWrap: "wrap" }}>
                  <select value={filterPitch} onChange={(e) => setFilterPitch(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px" }}>
                    <option value="">Alle Plätze</option>
                    {pitches.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  
                  <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px" }}>
                    <option value="">Alle Teams</option>
                    {teams && teams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  {/* Umschalter Tag / 3 Tage / Woche */}
                  <div style={{ display: "flex", border: "1px solid #ccc", borderRadius: "6px", overflow: "hidden" }}>
                     <button onClick={() => setCalendarView("day")} style={{ padding: "8px 10px", border: "none", background: calendarView === "day" ? "#e0e0e0" : "white", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>TAG</button>
                     <button onClick={() => setCalendarView("3days")} style={{ padding: "8px 10px", border: "none", borderLeft: "1px solid #ccc", borderRight: "1px solid #ccc", background: calendarView === "3days" ? "#e0e0e0" : "white", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>3 TAGE</button>
                     <button onClick={() => setCalendarView("week")} style={{ padding: "8px 10px", border: "none", background: calendarView === "week" ? "#e0e0e0" : "white", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>WOCHE</button>
                  </div>

                  <button onClick={() => setActiveTab("book")} style={{ background: "#27ae60", color: "white", padding: "8px 15px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>➕ Buchen</button>
                  {isAdmin && <button onClick={() => setShowMenu(!showMenu)} style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", padding: "0 5px" }}>⋮</button>}

                  {isAdmin && showMenu && (
                    <div style={{ position: "absolute", top: "100%", right: "0", marginTop: "5px", background: "white", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 100, minWidth: "200px" }}>
                      <button onClick={() => handleBulkDelete("pitch")} disabled={!filterPitch} style={{ display: "block", width: "100%", padding: "12px", background: "white", border: "none", borderBottom: "1px solid #eee", textAlign: "left", cursor: filterPitch ? "pointer" : "not-allowed", opacity: filterPitch ? 1 : 0.5 }}>Platz komplett leeren</button>
                      <button onClick={() => handleBulkDelete("team")} disabled={!filterTeam} style={{ display: "block", width: "100%", padding: "12px", background: "white", border: "none", borderBottom: "1px solid #eee", textAlign: "left", cursor: filterTeam ? "pointer" : "not-allowed", opacity: filterTeam ? 1 : 0.5 }}>Mannschaft stornieren</button>
                      <button onClick={() => handleBulkDelete("all")} style={{ display: "block", width: "100%", padding: "12px", background: "white", color: "#e74c3c", border: "none", textAlign: "left", cursor: "pointer" }}>ALLE Buchungen stornieren</button>
                    </div>
                  )}
                </div>
              </div>

              {/* LEGENDE FÜR TEAM FARBEN */}
              <div style={{ marginBottom: "15px", textAlign: "left" }}>
                 <button onClick={() => setShowLegend(!showLegend)} style={{ background: "transparent", border: "none", color: "#2146d0", fontWeight: "bold", cursor: "pointer", fontSize: "12px" }}>
                   {showLegend ? "▲ Team-Farben ausblenden" : "▼ Team-Farben anzeigen (Legende)"}
                 </button>
                 {showLegend && (
                   <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "10px", background: "white", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}>
                     {teams && teams.map(t => (
                       <div key={t} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px" }}>
                         <div style={{ width: "12px", height: "12px", background: getTeamColor(t), borderRadius: "3px" }}></div>
                         {t}
                       </div>
                     ))}
                   </div>
                 )}
              </div>

              <p style={{ fontSize: "11px", color: "#888", margin: "0 0 10px 0" }}>💡 Buchung antippen zum Bearbeiten (Zeit, Platzanteil, Platz …) – oder auf einen anderen Platz/Tag ziehen.</p>

              {/* GRIDS PRO PLATZ */}
              {pitches.filter(p => filterPitch ? p.id === filterPitch : true).map((p, idx) => (
                <div key={p.id} style={{ marginBottom: "20px", background: "white", borderRadius: "10px", border: "1px solid #ddd", overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                  
                  <div style={{ padding: "12px 15px", background: "white", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #eee" }}>
                    <span style={{ fontSize: "16px" }}>🌱</span>
                    <strong style={{ fontSize: "15px", color: "#333" }}>{p.name}</strong>
                    <span style={{ fontSize: "12px", color: "#888" }}>{p.hasFloodlight ? "· Flutlicht" : ""} {p.hasCabin ? "· Kabine" : ""}</span>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          const todayStr = new Date().toLocaleDateString("sv-SE");
                          const visible = displayDates.map(dt => dt.toISOString().split("T")[0]);
                          setCloseDialog({ pitchId: p.id, date: visible.includes(todayStr) ? todayStr : visible[0], reason: "", targetPitchId: pitches.find(o => o.id !== p.id)?.id || "" });
                        }}
                        style={{ marginLeft: "auto", background: "white", color: "#c0392b", border: "1px solid #e6b0aa", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        🚫 Platz sperren
                      </button>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${displayDates.length}, minmax(0, 1fr))`, background: "white", borderTop: "1px solid #eee" }}>
                    
                    {/* Spaltenköpfe */}
                    {displayDates.map((dateObj, i) => {
                      const isToday = dateObj.toDateString() === new Date().toDateString();
                      const dayShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][dateObj.getDay()];
                      const dateStr = `${dateObj.getDate()}.${dateObj.getMonth() + 1}.`;

                      return (
                        <div key={`head-${i}`} style={{ background: isToday ? "#27ae60" : "#fafafa", color: isToday ? "white" : "#555", padding: "6px 4px", textAlign: "center", fontSize: "12px", fontWeight: "bold", borderRight: "1px solid #eee", borderBottom: isToday ? "2px solid #1e8449" : "1px solid #eee" }}>
                          {dayShort} {dateStr}
                          {isToday && <div style={{ fontSize: "10px", fontWeight: "normal", letterSpacing: "1px", textTransform: "uppercase", opacity: 0.9 }}>Heute</div>}
                        </div>
                      );
                    })}

                    {/* Inhalts-Zellen */}
                    {displayDates.map((dateObj, i) => {
                      const dayNameFull = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][dateObj.getDay()];
                      const cellDateString = dateObj.toISOString().split("T")[0];
                      const isToday = dateObj.toDateString() === new Date().toDateString();
                      const closure = closures.find(c => c.pitchId === p.id && c.date === cellDateString);

                      const cellBookings = bookings.filter(b => {
                        if (b.pitchId !== p.id) return false;
                        if (filterTeam && b.team !== filterTeam) return false;
                        
                        if (b.repetition === "Einmalig") return b.date === cellDateString;
                        if (cellDateString >= b.startDate && cellDateString <= b.endDate && b.days && b.days.includes(dayNameFull)) {
                          if (b.exceptions && b.exceptions.includes(cellDateString)) return false; 
                          return true;
                        }
                        return false;
                      }).sort((a, b) => a.startTime.localeCompare(b.startTime));

                      return (
                        <div
                          key={`cell-${i}`}
                          onDragOver={(e) => { if (!dragging) return; e.preventDefault(); setDropTarget(`${p.id}|${cellDateString}`); }}
                          onDragLeave={() => setDropTarget(null)}
                          onDrop={(e) => { e.preventDefault(); handleDrop(p.id, cellDateString); }}
                          style={{ background: dropTarget === `${p.id}|${cellDateString}` ? "#dbeafe" : closure ? "repeating-linear-gradient(45deg, #fdecea, #fdecea 6px, #fff 6px, #fff 12px)" : isToday ? "#f0faf4" : "white", padding: "5px", minHeight: "90px", display: "flex", flexDirection: "column", gap: "4px", borderRight: "1px solid #eee", boxShadow: dropTarget === `${p.id}|${cellDateString}` ? "inset 0 0 0 2px #2146d0" : isToday ? "inset 2px 0 0 #27ae60, inset -2px 0 0 #27ae60" : "none", transition: "background 0.1s" }}
                        >
                          {closure && (
                            <div style={{ background: "#c0392b", color: "white", borderRadius: "4px", padding: "4px 6px", fontSize: "11px", lineHeight: 1.3 }}>
                              <strong>🚫 Gesperrt</strong>{closure.reason ? `: ${closure.reason}` : ""}
                              {isAdmin && <button onClick={() => handleReopenPitch(closure)} style={{ display: "block", marginTop: "3px", background: "white", color: "#c0392b", border: "none", borderRadius: "3px", padding: "2px 6px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}>Sperre aufheben</button>}
                            </div>
                          )}
                          {!closure && cellBookings.length === 0 && <div style={{ fontSize: "11px", color: "#bbb", textAlign: "center", marginTop: "8px" }}>frei</div>}
                          {cellBookings.map(b => {
                            const bColor = getTeamColor(b.team);
                            const shareLabel = b.share === "Halb" ? "½ Platz" : b.share === "Viertel" ? "¼ Platz" : "";

                            return (
                              <div
                                key={b.id}
                                draggable
                                onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", b.id); setDragging({ booking: b, fromDate: cellDateString, fromPitchId: p.id }); }}
                                onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                                onClick={() => openEditDialog(b, cellDateString, p.id)}
                                title={[b.notes, b.movedFrom ? `Verlegt von ${b.movedFrom}` : "", "Antippen zum Bearbeiten, ziehen zum Verschieben"].filter(Boolean).join("\n")}
                                style={{ background: `${bColor}1f`, borderLeft: `4px solid ${bColor}`, color: "#333", padding: "4px 18px 4px 6px", borderRadius: "4px", position: "relative", boxSizing: "border-box", lineHeight: 1.3, cursor: "grab", opacity: dragging?.booking.id === b.id && dragging?.fromDate === cellDateString ? 0.4 : 1 }}
                              >
                                <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                  <span>{b.startTime}–{b.endTime}</span>
                                  {shareLabel && <span style={{ fontWeight: "normal", color: "#777" }}>{shareLabel}</span>}
                                  {b.movedFrom && <span style={{ fontWeight: "normal", color: "#2146d0" }}>↪ verlegt</span>}
                                </div>
                                <div style={{ fontSize: "12px", fontWeight: "bold", wordBreak: "break-word" }}>
                                  {b.type === "Training" ? "⚽" : "🏆"} {b.team}
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteBooking(b, cellDateString); }} title="Buchung löschen" style={{ position: "absolute", top: "3px", right: "4px", background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "11px", padding: 0 }}>✖</button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DIALOG: BUCHUNG BEARBEITEN */}
      {editDialog && (() => {
        const d = editDialog;
        const isSeries = d.booking.repetition !== "Einmalig";
        const teamOptions = teams && teams.includes(d.team) ? teams : [d.team, ...(teams || [])];
        const label = { fontSize: "12px", fontWeight: "bold", color: "#555" };
        const choiceStyle = (active) => ({ flex: 1, padding: "8px", borderRadius: "6px", border: active ? "2px solid #2146d0" : "1px solid #ccc", background: active ? "#eef2ff" : "white", fontWeight: active ? "bold" : "normal", fontSize: "12px", cursor: "pointer", color: "#333" });
        return (
          <div onClick={() => setEditDialog(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "15px" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: "10px", padding: "18px", width: "100%", maxWidth: "420px", maxHeight: "90vh", overflowY: "auto", textAlign: "left", boxShadow: "0 6px 20px rgba(0,0,0,0.2)" }}>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#2146d0" }}>✏️ Buchung bearbeiten</h3>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#666" }}>
                {d.booking.team} · {pitchName(d.fromPitchId)} · {formatDay(d.fromDate)} · {d.booking.startTime}–{d.booking.endTime}
                {d.booking.movedFrom && <><br /><span style={{ color: "#2146d0" }}>↪ ursprünglich: {d.booking.movedFrom}</span></>}
                {d.booking.bookedBy && <><br />Gebucht von: {d.booking.bookedBy}</>}
              </p>

              {isSeries && (
                <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
                  {[{ id: "occurrence", text: "Nur dieser Termin" }, { id: "series", text: "Ganze Serie" }].map(o => (
                    <button key={o.id} onClick={() => setEditDialog({ ...d, scope: o.id })} style={choiceStyle(d.scope === o.id)}>{o.text}</button>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Platz</label>
                  <select value={d.pitchId} onChange={(e) => setEditDialog({ ...d, pitchId: e.target.value })} style={{ ...inputStyle, margin: "4px 0 10px 0" }}>
                    {pitches.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                  </select>
                </div>
                {!(isSeries && d.scope === "series") && (
                  <div style={{ flex: 1 }}>
                    <label style={label}>Datum</label>
                    <input type="date" value={d.date} onChange={(e) => setEditDialog({ ...d, date: e.target.value })} style={{ ...inputStyle, margin: "4px 0 10px 0" }} />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Von</label>
                  <input type="time" value={d.startTime} onChange={(e) => setEditDialog({ ...d, startTime: e.target.value })} style={{ ...inputStyle, margin: "4px 0 10px 0" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Bis</label>
                  <input type="time" value={d.endTime} onChange={(e) => setEditDialog({ ...d, endTime: e.target.value })} style={{ ...inputStyle, margin: "4px 0 10px 0" }} />
                </div>
              </div>

              <label style={label}>Platzanteil</label>
              <div style={{ display: "flex", gap: "6px", margin: "4px 0 10px 0" }}>
                {[{ v: "Viertel", t: "¼ Platz" }, { v: "Halb", t: "½ Platz" }, { v: "Ganz", t: "Ganzer Platz" }].map(o => (
                  <button key={o.v} onClick={() => setEditDialog({ ...d, share: o.v })} style={choiceStyle(d.share === o.v)}>{o.t}</button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Mannschaft</label>
                  <select value={d.team} onChange={(e) => setEditDialog({ ...d, team: e.target.value })} style={{ ...inputStyle, margin: "4px 0 10px 0" }}>
                    {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Art</label>
                  <select value={d.type} onChange={(e) => setEditDialog({ ...d, type: e.target.value })} style={{ ...inputStyle, margin: "4px 0 10px 0" }}>
                    {(bookingTypes.includes(d.type) ? bookingTypes : [d.type, ...bookingTypes]).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <label style={label}>Notiz</label>
              <textarea value={d.notes} onChange={(e) => setEditDialog({ ...d, notes: e.target.value })} rows={2} style={{ ...inputStyle, margin: "4px 0 12px 0", fontFamily: "inherit" }} />

              {isSeries && d.scope === "series" && <p style={{ fontSize: "11px", color: "#888", margin: "0 0 12px 0" }}>Änderungen gelten für alle Termine der Serie ({(d.booking.days || []).join(", ")}, bis {formatDay(d.booking.endDate)}).</p>}

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button onClick={saveEdit} style={{ flex: "1 1 120px", padding: "11px", background: "#2146d0", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>💾 Speichern</button>
                <button onClick={() => setEditDialog(null)} style={{ flex: "1 1 80px", padding: "11px", background: "#eee", color: "#333", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Abbrechen</button>
                <button onClick={() => { setEditDialog(null); handleDeleteBooking(d.booking, d.fromDate); }} style={{ flex: "1 1 100%", padding: "9px", background: "white", color: "#c0392b", border: "1px solid #e6b0aa", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" }}>🗑️ Buchung löschen</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DIALOG: PLATZ SPERREN */}
      {closeDialog && (() => {
        const affected = closeDialog.date ? bookingsOnPitchDay(bookings, closeDialog.pitchId, closeDialog.date) : [];
        return (
          <div onClick={() => setCloseDialog(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "15px" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: "10px", padding: "18px", width: "100%", maxWidth: "420px", maxHeight: "90vh", overflowY: "auto", textAlign: "left", boxShadow: "0 6px 20px rgba(0,0,0,0.2)" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#c0392b" }}>🚫 {pitchName(closeDialog.pitchId)} sperren</h3>

              <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Datum</label>
              <input type="date" value={closeDialog.date} onChange={(e) => setCloseDialog({ ...closeDialog, date: e.target.value })} style={{ ...inputStyle, margin: "4px 0 10px 0" }} />

              <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Grund (optional)</label>
              <input type="text" placeholder="z. B. Platz unbespielbar" value={closeDialog.reason} onChange={(e) => setCloseDialog({ ...closeDialog, reason: e.target.value })} style={{ ...inputStyle, margin: "4px 0 10px 0" }} />

              <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Buchungen an diesem Tag</label>
              <select value={closeDialog.targetPitchId} onChange={(e) => setCloseDialog({ ...closeDialog, targetPitchId: e.target.value })} style={{ ...inputStyle, margin: "4px 0 10px 0" }}>
                {pitches.filter(pt => pt.id !== closeDialog.pitchId).map(pt => <option key={pt.id} value={pt.id}>↪ verlegen nach {pt.name}</option>)}
                <option value="">❌ alle absagen</option>
              </select>

              <div style={{ background: "#f8f9fa", border: "1px solid #eee", borderRadius: "6px", padding: "8px", fontSize: "12px", marginBottom: "12px" }}>
                {affected.length === 0 ? <span style={{ color: "#888" }}>Keine Buchungen an diesem Tag.</span> : (
                  <>
                    <strong>{affected.length} Buchung(en) betroffen:</strong>
                    {affected.map(b => {
                      const inWay = closeDialog.targetPitchId ? findMoveConflicts(bookings, { ...b, pitchId: closeDialog.targetPitchId }, closeDialog.targetPitchId, closeDialog.date) : [];
                      return (
                        <div key={b.id} style={{ marginTop: "3px" }}>
                          {b.startTime}–{b.endTime} {b.team}
                          {inWay.length > 0 && <span style={{ color: "#e67e22" }}> ⚠️ Überschneidung mit {[...new Set(inWay.map(c => c.team))].join(", ")}</span>}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={handleClosePitch} style={{ flex: 1, padding: "11px", background: "#c0392b", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Sperren{affected.length > 0 ? (closeDialog.targetPitchId ? " & umbuchen" : " & absagen") : ""}</button>
                <button onClick={() => setCloseDialog(null)} style={{ flex: 1, padding: "11px", background: "#eee", color: "#333", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Abbrechen</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB: DASHBOARD (MANNSCHAFTEN WIE AUF BILD 9) */}
      {activeTab === "dashboard" && (
        <div style={{ textAlign: "left" }}>
           <h3 style={{ fontSize: "1.4rem", margin: "0 0 20px 0", color: "#333" }}>Übersicht ({teams ? teams.length : 0} Mannschaften)</h3>
           <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
              {teams && teams.map(t => {
                 const tColor = getTeamColor(t);
                 const trainingDays = getTrainingDaysForTeam(t);
                 const coachName = teamCoaches[t] || "Noch nicht zugewiesen";

                 return (
                    <div key={t} style={{ background: "white", padding: "20px", borderRadius: "10px", border: "1px solid #ddd", boxShadow: "0 2px 5px rgba(0,0,0,0.03)" }}>
                       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                         <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "14px", height: "14px", background: tColor, borderRadius: "4px" }}></div>
                            <h4 style={{ margin: 0, fontSize: "18px", color: "#333" }}>{t}</h4>
                         </div>
                         {isAdmin && (
                           <button 
                             onClick={() => { setEditingCoachForTeam(t); setTempCoachName(teamCoaches[t] || ""); }}
                             style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer", fontSize: "14px" }}
                           >
                             ✏️
                           </button>
                         )}
                       </div>
                       
                       <div style={{ fontSize: "13px", color: "#555", marginBottom: "8px", display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ fontSize: "16px" }}>👤</span> Trainer: 
                          
                          {isAdmin && editingCoachForTeam === t ? (
                            <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                              <input 
                                type="text" 
                                value={tempCoachName} 
                                onChange={(e) => setTempCoachName(e.target.value)} 
                                style={{ padding: "4px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "12px", width: "120px" }}
                                placeholder="Name..."
                                autoFocus
                              />
                              <button onClick={() => { 
                                const updated = { ...teamCoaches, [t]: tempCoachName };
                                setTeamCoaches(updated);
                                syncCoaches(updated);
                                setEditingCoachForTeam(null);
                              }} style={{ background: "#27ae60", color: "white", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "11px" }}>OK</button>
                              <button onClick={() => setEditingCoachForTeam(null)} style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "11px" }}>X</button>
                            </div>
                          ) : (
                            <strong style={{ color: coachName === "Noch nicht zugewiesen" ? "#999" : "#333", fontStyle: coachName === "Noch nicht zugewiesen" ? "italic" : "normal" }}>
                              {coachName}
                            </strong>
                          )}
                       </div>

                       <div style={{ fontSize: "13px", color: "#555", display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ fontSize: "16px" }}>📅</span> Trainingstage: <strong style={{ color: trainingDays === "Keine Serie" ? "#999" : "#333" }}>{trainingDays}</strong>
                       </div>
                    </div>
                 )
              })}
           </div>
        </div>
      )}

      {/* TAB 3: BUCHEN FORMULAR */}
      {activeTab === "book" && (
        <div style={{ background: "white", padding: "20px", borderRadius: "10px", border: "1px solid #ddd", maxWidth: "600px", margin: "0 auto", textAlign: "left" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "1.4rem", margin: 0 }}>Buchen</h3>
            <div>
              <button onClick={() => setActiveTab("schedule")} style={{ background: "transparent", color: "#27ae60", border: "none", fontWeight: "bold", cursor: "pointer", marginRight: "10px" }}>Abbrechen</button>
              {isAdmin && <button onClick={() => setActiveTab("manage")} style={{ background: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "6px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>⚙️ Plätze anlegen</button>}
            </div>
          </div>

          {conflictBooking && (
            <div style={{ background: "#f8d7da", border: "1px solid #f5c6cb", padding: "15px", borderRadius: "8px", marginBottom: "15px" }}>
              <h4 style={{ color: "#721c24", margin: "0 0 5px 0" }}>⚠️ Platz überbucht!</h4>
              <p style={{ fontSize: "13px", color: "#721c24", marginBottom: "10px" }}>Der Platz ist zur gewünschten Zeit bereits durch <strong>{conflictBooking.team}</strong> belegt.</p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button onClick={sendConflictToJugendleitung} disabled={isSendingConflict} style={{ background: "#c0392b", color: "white", padding: "8px", border: "none", borderRadius: "6px", cursor: isSendingConflict ? "not-allowed" : "pointer", flex: "1 1 100%", fontSize: "12px", fontWeight: "bold" }}>{isSendingConflict ? "Wird gesendet..." : "📢 Vorstand & Jugendleitung informieren"}</button>
                <button onClick={shareConflictViaWhatsApp} style={{ background: "#25D366", color: "white", padding: "8px", border: "none", borderRadius: "6px", cursor: "pointer", flex: 1, fontSize: "12px", fontWeight: "bold" }}>💬 Trainer fragen</button>
                <button onClick={() => setConflictBooking(null)} style={{ background: "white", border: "1px solid #ccc", padding: "8px", borderRadius: "6px", cursor: "pointer", flex: 1, fontSize: "12px" }}>Abbrechen</button>
              </div>
            </div>
          )}

          <form onSubmit={handleAddBooking} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            
            <div>
              <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>Platz *</label>
              <select value={bookPitch} onChange={e => setBookPitch(e.target.value)} style={inputStyle} required>
                {pitches.length === 0 && <option value="">(Bitte erst einen Platz anlegen)</option>}
                {pitches.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>Mannschaft</label>
              <select value={bookTeam} onChange={e => setBookTeam(e.target.value)} style={inputStyle} required>
                {teams && teams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>Buchungstyp</label>
              <select value={bookType} onChange={e => setBookType(e.target.value)} style={inputStyle}>
                {bookingTypes.map(t => <option key={t} value={t}>{t === "Training" ? "🏋️ " : "🏆 "}{t}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>Wiederholung</label>
              <select value={repetition} onChange={e => setRepetition(e.target.value)} style={inputStyle}>
                <option value="Einmalig">Einmalig</option>
                <option value="Wöchentlich">Wöchentlich (Serie)</option>
              </select>
            </div>

            {repetition === "Einmalig" ? (
              <div>
                <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>Datum *</label>
                <input type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} style={inputStyle} required />
              </div>
            ) : (
              <div>
                <label style={{ fontSize: "12px", color: "#666", marginBottom: "6px", display: "block" }}>Wochentage * (Mehrfachauswahl)</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "15px" }}>
                  {daysOfWeek.map(day => {
                    const isSelected = bookDays.includes(day);
                    return (
                      <div 
                        key={day} 
                        onClick={() => toggleBookDay(day)}
                        style={{ padding: "6px 12px", borderRadius: "20px", border: `1px solid ${isSelected ? "#2146d0" : "#ccc"}`, background: isSelected ? "#eef2ff" : "white", color: isSelected ? "#2146d0" : "#555", fontSize: "13px", cursor: "pointer", fontWeight: isSelected ? "bold" : "normal" }}
                      >
                        {day.substring(0, 2)} {isSelected ? "✓" : ""}
                      </div>
                    );
                  })}
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>Serie beginnt am *</label>
                    <input type="date" value={seriesStartDate} onChange={e => setSeriesStartDate(e.target.value)} style={inputStyle} required />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>Serie endet am *</label>
                    <input type="date" value={seriesEndDate} onChange={e => setSeriesEndDate(e.target.value)} style={inputStyle} required />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>Startzeit *</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>Endzeit *</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} required />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>Platzbelegung</label>
              <div style={{ display: "flex", width: "100%" }}>
                <div onClick={() => setBookShare("Viertel")} style={shareBtnStyle("Viertel")}>◔ VIERTEL</div>
                <div onClick={() => setBookShare("Halb")} style={shareBtnStyle("Halb")}>◑ HALB</div>
                <div onClick={() => setBookShare("Ganz")} style={shareBtnStyle("Ganz")}>● GANZ</div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>Notiz</label>
              <textarea 
                value={bookNotes} 
                onChange={e => setBookNotes(e.target.value)} 
                rows="3" 
                style={{ ...inputStyle, resize: "vertical" }} 
                placeholder="Zusätzliche Infos..." 
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
              <button type="submit" disabled={pitches.length === 0} style={{ padding: "12px 24px", background: pitches.length === 0 ? "#ccc" : "#27ae60", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: pitches.length === 0 ? "not-allowed" : "pointer" }}>
                Buchen
              </button>
            </div>

          </form>
        </div>
      )}

      {/* TAB 4: PLÄTZE VERWALTEN */}
      {activeTab === "conflicts" && <PitchConflicts clubId={clubId} canDecide={isAdmin} />}

      {activeTab === "import" && isAdmin && <FussballImport clubId={clubId} teams={teams || []} pitches={pitches} bookings={bookings} />}

      {activeTab === "manage" && isAdmin && (
        <div style={{ background: "white", padding: "20px", borderRadius: "10px", border: "1px solid #ddd", maxWidth: "600px", margin: "0 auto", textAlign: "left" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "1.4rem", margin: 0 }}>Plätze verwalten</h3>
            <button onClick={() => setActiveTab("schedule")} style={{ background: "transparent", color: "#2146d0", border: "none", fontWeight: "bold", cursor: "pointer" }}>Zurück</button>
          </div>
          
          <form onSubmit={handleAddPitch} style={{ marginBottom: "25px", background: "#f8f9fa", padding: "15px", borderRadius: "8px", border: "1px solid #eee" }}>
            <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", display: "block" }}>Neuer Platzname</label>
            <input type="text" placeholder="z.B. Hauptplatz" value={newPitchName} onChange={e => setNewPitchName(e.target.value)} style={{ ...inputStyle, marginBottom: "15px" }} required />
            
            <div style={{ display: "flex", gap: "20px", marginBottom: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer" }}>
                <input type="checkbox" checked={hasFloodlight} onChange={e => setHasFloodlight(e.target.checked)} /> 💡 Flutlicht
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer" }}>
                <input type="checkbox" checked={hasCabin} onChange={e => setHasCabin(e.target.checked)} /> 🚿 Kabine
              </label>
            </div>
            <button type="submit" style={{ width: "100%", padding: "10px", background: "#333", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
              Platz anlegen
            </button>
          </form>

          <hr style={{ borderColor: "#ddd", margin: "20px 0" }} />
          
          <h4 style={{ margin: "0 0 10px 0", color: "#666" }}>Angelegte Plätze ({pitches.length})</h4>
          {pitches.length === 0 ? <p style={{ fontSize: "13px", color: "#999" }}>Noch keine Plätze vorhanden.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {pitches.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }}>
                  <div>
                    <strong style={{ fontSize: "15px" }}>{p.name}</strong>
                    <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
                      {p.hasFloodlight ? "💡 Flutlicht " : ""} {p.hasCabin ? "🚿 Kabine" : ""}
                    </div>
                  </div>
                  <button onClick={() => handleDeletePitch(p.id)} style={{ background: "#ffebee", color: "#c0392b", border: "1px solid #ffcdd2", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontWeight: "bold" }}>Löschen</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}