import React, { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function PitchManager({ clubId, teams, currentUserName }) {
  // --- NAVIGATION & VIEW STATES ---
  const [activeTab, setActiveTab] = useState("schedule"); // "schedule", "book", "manage"
  const [viewDate, setViewDate] = useState(new Date());
  
  // --- FILTER STATES ---
  const [filterPitch, setFilterPitch] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  // --- CLOUD-STATE ---
  const [pitches, setPitches] = useState([]);
  const [bookings, setBookings] = useState([]);

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
  const [bookShare, setBookShare] = useState("Ganz"); // Ganz, Halb, Viertel
  const [repetition, setRepetition] = useState("Einmalig"); // Einmalig, Wöchentlich
  const [bookDate, setBookDate] = useState(new Date().toISOString().split("T")[0]); // Für Einmalig
  
  // NEU: Für Serien
  const [seriesStartDate, setSeriesStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [seriesEndDate, setSeriesEndDate] = useState("");
  const [bookDays, setBookDays] = useState([]); 
  const [bookNotes, setBookNotes] = useState("");

  // --- KONFLIKT-STATE (Für einmalige Buchungen) ---
  const [conflictBooking, setConflictBooking] = useState(null);

  const daysOfWeek = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  const bookingTypes = ["Training", "Ligaspiel", "Pokalspiel", "Freundschaftsspiel"];
  
  const [weekDates, setWeekDates] = useState([]);

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

    return () => {
      unsubPitches();
      unsubBookings();
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

  const getWeekDates = (date) => {
    const current = new Date(date);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diff));
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      week.push(d);
    }
    return week;
  };

  const getWeekNumber = (d) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  };

  const weekDatesCalc = getWeekDates(viewDate);
  const kw = getWeekNumber(weekDatesCalc[0]);
  const dateRangeStr = `${weekDatesCalc[0].getDate()}.${weekDatesCalc[0].getMonth()+1}. – ${weekDatesCalc[6].getDate()}.${weekDatesCalc[6].getMonth()+1}.${weekDatesCalc[6].getFullYear()}`;

  const changeWeek = (offset) => {
    const newDate = new Date(viewDate);
    newDate.setDate(viewDate.getDate() + (offset * 7));
    setViewDate(newDate);
  };

  const teamColors = ["#00838f", "#1976d2", "#388e3c", "#fbc02d", "#e64a19", "#d81b60", "#8e24aa", "#5d4037", "#455a64", "#2c3e50"];
  const getTeamColor = (teamName) => {
    let hash = 0;
    for (let i = 0; i < teamName.length; i++) hash = teamName.charCodeAt(i) + ((hash << 5) - hash);
    return teamColors[Math.abs(hash) % teamColors.length];
  };

  const toggleBookDay = (day) => {
    if (bookDays.includes(day)) setBookDays(bookDays.filter(d => d !== day));
    else setBookDays([...bookDays, day]);
  };

  // --- BUCHUNG VERWALTEN (Inkl. Serien & smarter Konfliktlösung) ---
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

    // Zu prüfende reale Tage ermitteln
    let datesToCheck = [];
    if (repetition === "Einmalig") {
      datesToCheck.push(bookDate);
    } else {
      let curr = new Date(seriesStartDate);
      let end = new Date(seriesEndDate);
      while (curr <= end) {
        const dayNameFull = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][curr.getDay()];
        if (bookDays.includes(dayNameFull)) {
          datesToCheck.push(curr.toISOString().split("T")[0]);
        }
        curr.setDate(curr.getDate() + 1);
      }
    }

    let conflicts = [];
    let validDates = [];

    // Jeden einzelnen Tag der Buchung auf Konflikte prüfen
    datesToCheck.forEach(dateStr => {
      const overlappingBookings = bookings.filter(b => {
        if (b.pitchId !== bookPitch) return false;
        
        // Prüfen ob die andere Buchung an "dateStr" stattfindet
        let occurs = false;
        if (b.repetition === "Einmalig") {
          occurs = (b.date === dateStr);
        } else {
          const d = new Date(dateStr);
          const dayNameFull = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][d.getDay()];
          if (dateStr >= b.startDate && dateStr <= b.endDate && b.days.includes(dayNameFull) && !(b.exceptions || []).includes(dateStr)) {
            occurs = true;
          }
        }

        if (!occurs) return false;
        // Zeit-Überschneidung prüfen
        return (startTime < b.endTime && endTime > b.startTime);
      });

      const currentTotalShare = overlappingBookings.reduce((sum, b) => sum + shareValues[b.share || "Ganz"], 0);

      if (currentTotalShare + requestedShareVal > 1) {
        conflicts.push({ date: dateStr, team: overlappingBookings[0].team });
      } else {
        validDates.push(dateStr);
      }
    });

    if (validDates.length === 0) {
      if (repetition === "Einmalig") {
         // Bei einmaligen Terminen sofort rotes Warn-Menü zeigen
         setConflictBooking({ team: conflicts[0].team, type: "einem Termin", share: "Platz" });
      } else {
         alert("Fehler: Alle Termine in diesem Zeitraum sind zu dieser Uhrzeit bereits belegt!");
      }
      return;
    }

    // Wenn es bei Serien zu einigen Konflikten kam -> Fragen ob wir diese überspringen sollen
    if (conflicts.length > 0 && repetition === "Wöchentlich") {
      const confirmMsg = `⚠️ Achtung: An ${conflicts.length} Terminen ist der Platz bereits voll belegt und wird übersprungen (z.B. am ${conflicts[0].date} durch ${conflicts[0].team}).\n\nMöchtest du die Serie für die restlichen ${validDates.length} freien Termine trotzdem buchen?`;
      if (!window.confirm(confirmMsg)) return;
    }

    // Konflikte werden automatisch zu "exceptions" (Ausnahmen) für diese Serie
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
      exceptions: autoExceptions, // Hier speichern wir alle stornierten/übersprungenen Einzeltage
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

  // --- EINZELNEN TAG ODER SERIE LÖSCHEN ---
  const handleDeleteBooking = (b, cellDateString) => {
    if (b.repetition === "Wöchentlich") {
      const choice = window.prompt("Diese Buchung ist Teil einer Serie.\nTippe '1' = NUR diesen Termin (Heute) stornieren.\nTippe '2' = Die KOMPLETTE Serie stornieren.");
      
      if (choice === "1") {
        const updatedBookings = bookings.map(bk => {
          if (bk.id === b.id) {
            return { ...bk, exceptions: [...(bk.exceptions || []), cellDateString] };
          }
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

  // --- LÖSCH-MENÜ (Globale Aktionen) ---
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

  // --- KONFLIKTLÖSUNG (NTFY & TEILEN) FÜR EINMALIGE BUCHUNGEN ---
  const sendConflictToJugendleitung = async () => {
    try {
      const pitchName = pitches.find(p => p.id === bookPitch)?.name || "Unbekannter Platz";
      const message = `${currentUserName || bookTeam} benötigt den ${pitchName} (${startTime}-${endTime}). Platz ist belegt durch ${conflictBooking.team}. Bitte klären!`;
      await fetch(`https://ntfy.sh/${clubId}jugendleitung`, { method: "POST", body: `🏟️ Platzkonflikt: ${message}`, headers: { "Priority": "high" } });
      alert("Jugendleitung wurde benachrichtigt!");
      setConflictBooking(null);
    } catch (error) { alert("Fehler beim Senden."); }
  };

  const shareConflictViaWhatsApp = () => {
    const pitchName = pitches.find(p => p.id === bookPitch)?.name || "Unbekannter Platz";
    const text = `Hallo! Ich (${currentUserName || bookTeam}) bräuchte von ${startTime} bis ${endTime} den ${pitchName} für ein ${bookType}. Aktuell steht dort ${conflictBooking.team} im Plan. Können wir uns einigen?`;
    if (navigator.share) navigator.share({ title: "Platzanfrage", text: text }).catch(() => {});
    else { navigator.clipboard.writeText(text); alert("Nachricht kopiert."); }
  };

  // --- PLATZ VERWALTEN ---
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

  // --- UI STYLES ---
  const inputStyle = { padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box", fontSize: "14px", color: "#333", background: "white" };
  const shareBtnStyle = (val) => ({
    flex: 1, padding: "12px", border: "1px solid #ccc", background: bookShare === val ? "#f0f0f0" : "white", cursor: "pointer",
    fontWeight: bookShare === val ? "bold" : "normal", textAlign: "center", fontSize: "12px",
    borderLeft: val !== "Viertel" ? "none" : "1px solid #ccc",
    borderTopLeftRadius: val === "Viertel" ? "8px" : "0", borderBottomLeftRadius: val === "Viertel" ? "8px" : "0",
    borderTopRightRadius: val === "Ganz" ? "8px" : "0", borderBottomRightRadius: val === "Ganz" ? "8px" : "0"
  });

  return (
    <div style={{ padding: "10px", fontFamily: "sans-serif", maxWidth: "1100px", margin: "0 auto", color: "#333" }}>
      
      {/* KOPFZEILE (GRID-HEADER) */}
      {activeTab === "schedule" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px", marginBottom: "20px", background: "white", padding: "12px 20px", borderRadius: "10px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button onClick={() => setViewDate(new Date())} style={{ padding: "6px 12px", background: "white", border: "1px solid #27ae60", color: "#27ae60", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>📅 Heute</button>
            <button onClick={() => changeWeek(-1)} style={{ background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", color: "#555" }}>&lt;</button>
            <button onClick={() => changeWeek(1)} style={{ background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", color: "#555" }}>&gt;</button>
            <strong style={{ fontSize: "18px", marginLeft: "10px" }}>KW {kw} · {dateRangeStr}</strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
            <select value={filterPitch} onChange={(e) => setFilterPitch(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", minWidth: "120px" }}>
              <option value="">Alle Plätze</option>
              {pitches.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            
            <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", minWidth: "120px" }}>
              <option value="">Alle Teams</option>
              {teams && teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <button onClick={() => setActiveTab("book")} style={{ background: "#27ae60", color: "white", padding: "8px 15px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
              ➕ Buchen
            </button>

            <button onClick={() => setShowMenu(!showMenu)} style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", padding: "0 5px" }}>⋮</button>

            {/* LÖSCH-MENÜ (Dropdown) */}
            {showMenu && (
              <div style={{ position: "absolute", top: "100%", right: "0", marginTop: "5px", background: "white", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 100, minWidth: "200px", overflow: "hidden" }}>
                <button onClick={() => handleBulkDelete("pitch")} disabled={!filterPitch} style={{ display: "block", width: "100%", padding: "12px", background: "white", border: "none", borderBottom: "1px solid #eee", textAlign: "left", cursor: filterPitch ? "pointer" : "not-allowed", opacity: filterPitch ? 1 : 0.5 }}>Platz komplett leeren</button>
                <button onClick={() => handleBulkDelete("team")} disabled={!filterTeam} style={{ display: "block", width: "100%", padding: "12px", background: "white", border: "none", borderBottom: "1px solid #eee", textAlign: "left", cursor: filterTeam ? "pointer" : "not-allowed", opacity: filterTeam ? 1 : 0.5 }}>Mannschaft stornieren</button>
                <button onClick={() => handleBulkDelete("all")} style={{ display: "block", width: "100%", padding: "12px", background: "white", color: "#e74c3c", border: "none", textAlign: "left", cursor: "pointer" }}>ALLE Buchungen stornieren</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KALENDER GRID */}
      {activeTab === "schedule" && (
        <div style={{ overflowX: "auto", paddingBottom: "20px" }}>
          {pitches.length === 0 ? (
            <p style={{ textAlign: "center", color: "#666" }}>Bitte wechsle auf "Buchen", um Plätze anzulegen.</p>
          ) : (
            <div style={{ minWidth: "900px", border: "1px solid #ddd", borderRadius: "10px", background: "#f8f9fa", overflow: "hidden" }}>
              {pitches.filter(p => filterPitch ? p.id === filterPitch : true).map((p, idx) => (
                <div key={p.id} style={{ borderBottom: idx < pitches.length - 1 ? "12px solid #edf2f7" : "none" }}>
                  
                  {/* Platz-Header */}
                  <div style={{ padding: "12px 15px", background: "white", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>🌱</span>
                    <strong style={{ fontSize: "15px", color: "#333" }}>{p.name}</strong>
                    <span style={{ fontSize: "12px", color: "#888" }}>
                      {p.hasFloodlight ? "· Flutlicht" : ""} {p.hasCabin ? "· Kabine" : ""}
                    </span>
                  </div>

                  {/* Wochentage & Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#e2e8f0", gap: "1px" }}>
                    
                    {/* Spaltenköpfe */}
                    {weekDatesCalc.map((dateObj, i) => {
                      const isToday = dateObj.toDateString() === new Date().toDateString();
                      const dayShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][dateObj.getDay()];
                      const dateStr = `${dateObj.getDate()}.${dateObj.getMonth() + 1}.`;

                      return (
                        <div key={`head-${i}`} style={{ background: isToday ? "#27ae60" : "white", color: isToday ? "white" : "#666", padding: "8px", textAlign: "center", fontSize: "12px" }}>
                          {dayShort} {dateStr}
                        </div>
                      );
                    })}

                    {/* Inhalts-Zellen */}
                    {weekDatesCalc.map((dateObj, i) => {
                      const dayNameFull = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][dateObj.getDay()];
                      const cellDateString = dateObj.toISOString().split("T")[0];

                      // Buchungen für diese Zelle filtern (Stornierte Tage aka "exceptions" ausblenden!)
                      const cellBookings = bookings.filter(b => {
                        if (b.pitchId !== p.id) return false;
                        if (filterTeam && b.team !== filterTeam) return false;
                        
                        if (b.repetition === "Einmalig") return b.date === cellDateString;
                        
                        if (cellDateString >= b.startDate && cellDateString <= b.endDate && b.days && b.days.includes(dayNameFull)) {
                          if (b.exceptions && b.exceptions.includes(cellDateString)) return false; // Stornierte Einzeltage ausblenden
                          return true;
                        }
                        return false;
                      }).sort((a, b) => a.startTime.localeCompare(b.startTime));

                      return (
                        <div key={`cell-${i}`} style={{ background: "white", padding: "4px", minHeight: "100px", display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px", width: "100%" }}>
                            {cellBookings.map(b => {
                              const shareWidth = b.share === "Halb" ? "calc(50% - 1px)" : b.share === "Viertel" ? "calc(25% - 1.5px)" : "100%";
                              const bColor = getTeamColor(b.team);

                              return (
                                <div key={b.id} style={{ width: shareWidth, background: bColor, color: "white", padding: "6px", borderRadius: "4px", position: "relative", boxSizing: "border-box" }}>
                                  <div style={{ fontSize: "11px", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: "10px" }}>
                                    {b.type === "Training" ? "⚽" : "🏆"} {b.team}
                                  </div>
                                  <div style={{ fontSize: "10px", opacity: 0.9, marginTop: "2px" }}>{b.startTime}–{b.endTime}</div>
                                  <button onClick={() => handleDeleteBooking(b, cellDateString)} style={{ position: "absolute", top: "2px", right: "2px", background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "10px", padding: 0 }}>✖</button>
                                </div>
                              );
                            })}
                          </div>
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

      {/* TAB 2: BUCHEN FORMULAR (Exakt wie auf deinem Bild) */}
      {activeTab === "book" && (
        <div style={{ background: "white", padding: "20px", borderRadius: "10px", border: "1px solid #ddd", maxWidth: "600px", margin: "0 auto", textAlign: "left" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "1.4rem", margin: 0 }}>Buchen</h3>
            <div>
              <button onClick={() => setActiveTab("schedule")} style={{ background: "transparent", color: "#27ae60", border: "none", fontWeight: "bold", cursor: "pointer", marginRight: "10px" }}>Abbrechen</button>
              <button onClick={() => setActiveTab("manage")} style={{ background: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "6px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>⚙️ Plätze anlegen</button>
            </div>
          </div>

          {conflictBooking && (
            <div style={{ background: "#f8d7da", border: "1px solid #f5c6cb", padding: "15px", borderRadius: "8px", marginBottom: "15px" }}>
              <h4 style={{ color: "#721c24", margin: "0 0 5px 0" }}>⚠️ Platz überbucht!</h4>
              <p style={{ fontSize: "13px", color: "#721c24", marginBottom: "10px" }}>Der Platz ist zur gewünschten Zeit bereits durch <strong>{conflictBooking.team}</strong> belegt.</p>
              <div style={{ display: "flex", gap: "8px" }}>
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

      {/* TAB 3: PLÄTZE VERWALTEN */}
      {activeTab === "manage" && (
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