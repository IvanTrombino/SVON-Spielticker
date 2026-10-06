import React, { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function PitchManager({ clubId, teams, currentUserName }) {
  // --- NAVIGATION (TABS) ---
  const [activeTab, setActiveTab] = useState("schedule"); // "schedule", "book", "manage"

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
  const [bookDay, setBookDay] = useState("Montag");
  const [bookPitch, setBookPitch] = useState("");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:30");
  const [bookShare, setBookShare] = useState("Ganz"); // Ganz, Halb, Viertel

  // --- KONFLIKT-STATE ---
  const [conflictBooking, setConflictBooking] = useState(null);

  const daysOfWeek = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  const bookingTypes = ["Training", "Ligaspiel", "Pokalspiel", "Freundschaftsspiel"];
  
  // Dynamische Kalender-Wochendaten für den Header
  const [weekDates, setWeekDates] = useState([]);

  // --- DATEN AUS FIREBASE LADEN ---
  useEffect(() => {
    if (!clubId) return;

    // Plätze laden
    const unsubPitches = onSnapshot(doc(db, "ticker", `${clubId}_pitches`), (snap) => {
      if (snap.exists()) {
        setPitches(snap.data().list || []);
      } else {
        setPitches([]);
      }
    });

    // Buchungen laden
    const unsubBookings = onSnapshot(doc(db, "ticker", `${clubId}_bookings`), (snap) => {
      if (snap.exists()) {
        setBookings(snap.data().list || []);
      } else {
        setBookings([]);
      }
    });

    return () => {
      unsubPitches();
      unsubBookings();
    };
  }, [clubId]);

  // Wochendaten berechnen (immer aktueller Montag bis Sonntag)
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    setWeekDates(dates);
  }, []);

  // Wenn Plätze geladen wurden und noch keiner vorausgewählt ist, den ersten nehmen
  useEffect(() => {
    if (pitches.length > 0 && !bookPitch) {
      setBookPitch(pitches[0].id);
    }
  }, [pitches, bookPitch]);

  // --- HILFSFUNKTIONEN ---
  const syncPitches = async (newList) => {
    try {
      await setDoc(doc(db, "ticker", `${clubId}_pitches`), { list: newList });
    } catch (error) {
      console.error("Fehler beim Speichern der Plätze:", error);
    }
  };

  const syncBookings = async (newList) => {
    try {
      await setDoc(doc(db, "ticker", `${clubId}_bookings`), { list: newList });
    } catch (error) {
      console.error("Fehler beim Speichern der Buchungen:", error);
    }
  };

  // Automatische Farbzuteilung je Mannschaft für das Grid
  const teamColors = ["#00838f", "#1976d2", "#388e3c", "#fbc02d", "#e64a19", "#d81b60", "#8e24aa", "#5d4037", "#455a64", "#2c3e50"];
  const getTeamColor = (teamName) => {
    let hash = 0;
    for (let i = 0; i < teamName.length; i++) hash = teamName.charCodeAt(i) + ((hash << 5) - hash);
    return teamColors[Math.abs(hash) % teamColors.length];
  };

  // --- PLATZ VERWALTEN ---
  const handleAddPitch = (e) => {
    e.preventDefault();
    if (!newPitchName.trim()) return;

    const newPitch = {
      id: Date.now().toString(),
      name: newPitchName.trim(),
      hasFloodlight,
      hasCabin
    };

    const updatedPitches = [...pitches, newPitch];
    setPitches(updatedPitches);
    syncPitches(updatedPitches);

    setNewPitchName("");
    setHasFloodlight(false);
    setHasCabin(false);
  };

  const handleDeletePitch = (id) => {
    if (window.confirm("Diesen Platz wirklich löschen?")) {
      const updatedPitches = pitches.filter(p => p.id !== id);
      setPitches(updatedPitches);
      syncPitches(updatedPitches);
    }
  };

  // --- BUCHUNG VERWALTEN & SMARTER KONFLIKT-CHECK ---
  const handleAddBooking = (e) => {
    e.preventDefault();
    setConflictBooking(null);

    const shareValues = { "Ganz": 1, "Halb": 0.5, "Viertel": 0.25 };
    const requestedShareVal = shareValues[bookShare];

    // Finden aller Buchungen, die sich mit der gewünschten Zeit überschneiden
    const overlappingBookings = bookings.filter(b => {
      if (b.pitchId !== bookPitch || b.day !== bookDay) return false;
      return (startTime < b.endTime && endTime > b.startTime);
    });

    // Rechnerische Auslastung des Platzes prüfen
    const currentTotalShare = overlappingBookings.reduce((sum, b) => sum + shareValues[b.share || "Ganz"], 0);

    if (currentTotalShare + requestedShareVal > 1) {
      // Konflikt gefunden! (Platz über 100% belegt)
      setConflictBooking(overlappingBookings[0]); 
      return; 
    }

    const newBooking = {
      id: Date.now().toString(),
      team: bookTeam,
      type: bookType,
      day: bookDay,
      pitchId: bookPitch,
      startTime,
      endTime,
      share: bookShare, // Neu: Platzanteil mitspeichern
      bookedBy: currentUserName || "Ein Trainer"
    };

    const updatedBookings = [...bookings, newBooking];
    setBookings(updatedBookings);
    syncBookings(updatedBookings);
    alert("✅ Platz erfolgreich gebucht!");
    setActiveTab("schedule");
  };

  const handleDeleteBooking = (id) => {
    if (window.confirm("Diese Platzbelegung wirklich löschen?")) {
      const updatedBookings = bookings.filter(b => b.id !== id);
      setBookings(updatedBookings);
      syncBookings(updatedBookings);
    }
  };

  // --- KONFLIKTLÖSUNG (NTFY & TEILEN) ---
  const sendConflictToJugendleitung = async () => {
    try {
      const pitchName = pitches.find(p => p.id === bookPitch)?.name || "Unbekannter Platz";
      const message = `${currentUserName || bookTeam} benötigt den ${pitchName} am ${bookDay} (${startTime}-${endTime}). Platz ist aktuell belegt durch ${conflictBooking.team}. Bitte klären!`;
      
      await fetch(`https://ntfy.sh/${clubId}jugendleitung`, {
        method: "POST",
        body: `🏟️ Platzkonflikt: ${message}`,
        headers: { "Priority": "high" }
      });
      alert("Jugendleitung wurde benachrichtigt!");
      setConflictBooking(null);
    } catch (error) {
      alert("Fehler beim Senden.");
    }
  };

  const shareConflictViaWhatsApp = () => {
    const pitchName = pitches.find(p => p.id === bookPitch)?.name || "Unbekannter Platz";
    const text = `Hallo! Ich (${currentUserName || bookTeam}) bräuchte am ${bookDay} von ${startTime} bis ${endTime} den ${pitchName} für ein ${bookType}. Aktuell steht dort ${conflictBooking.team} im Plan. Können wir uns den Platz vielleicht teilen oder uns einigen?`;
    
    if (navigator.share) {
      navigator.share({ title: "Platzbelegung Anfrage", text: text }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text);
      alert("Nachricht in die Zwischenablage kopiert! Du kannst sie jetzt in WhatsApp einfügen.");
    }
  };

  // --- UI STYLES ---
  const tabButtonStyle = (tabName) => ({
    flex: 1, padding: "10px",
    background: activeTab === tabName ? "#2146d0" : "#e0e0e0",
    color: activeTab === tabName ? "white" : "#333",
    border: "none", borderRadius: "8px", fontWeight: "bold",
    cursor: "pointer", fontSize: "13px"
  });

  const inputStyle = { padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box", fontSize: "14px" };

  return (
    <div style={{ padding: "10px", fontFamily: "sans-serif", maxWidth: "1000px", margin: "0 auto" }}>
      <h2 style={{ color: "#2146d0", textAlign: "center", marginBottom: "15px" }}>🏟 Platzbelegung</h2>

      {/* TABS */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button onClick={() => setActiveTab("schedule")} style={tabButtonStyle("schedule")}>📅 Wochenplan</button>
        <button onClick={() => setActiveTab("book")} style={tabButtonStyle("book")}>➕ Buchen</button>
        <button onClick={() => setActiveTab("manage")} style={tabButtonStyle("manage")}>⚙️ Plätze verwalten</button>
      </div>

      {/* TAB 1: WOCHENPLAN (GRID-ANSICHT WIE AUF SCREENSHOT) */}
      {activeTab === "schedule" && (
        <div style={{ textAlign: "left", overflowX: "auto" }}>
          {pitches.length === 0 ? (
            <p style={{ color: "#666", textAlign: "center" }}>Noch keine Plätze angelegt. Bitte unter "Plätze verwalten" erstellen.</p>
          ) : (
            <div style={{ minWidth: "800px" }}> {/* Zwingt Grid zu bleiben auf kleinen Screens */}
              
              {/* Header über allem (Optional für aktuelle KW) */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", background: "white", padding: "10px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#333" }}>
                  📅 Aktuelle Kalenderwoche
                </div>
              </div>

              {pitches.map(p => (
                <div key={p.id} style={{ marginBottom: "20px", background: "white", borderRadius: "10px", border: "1px solid #ddd", overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                  
                  {/* Platz-Header */}
                  <div style={{ padding: "12px 15px", borderBottom: "1px solid #ddd", background: "#f8f9fa", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>🌱</span>
                    <strong style={{ fontSize: "15px", color: "#333" }}>{p.name}</strong>
                    <span style={{ fontSize: "12px", color: "#888" }}>
                      {p.hasFloodlight ? "· Flutlicht" : ""} {p.hasCabin ? "· Kabine" : ""}
                    </span>
                  </div>

                  {/* Kalender-Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#eee", gap: "1px" }}>
                    
                    {/* Wochentag-Spaltenköpfe */}
                    {weekDates.length > 0 && daysOfWeek.map((dayNameFull, idx) => {
                      const dateObj = weekDates[idx];
                      const isToday = dateObj.toDateString() === new Date().toDateString();
                      const dayShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][dateObj.getDay()];
                      const dateStr = `${dateObj.getDate()}.${dateObj.getMonth() + 1}.`;

                      return (
                        <div key={idx} style={{ background: isToday ? "#27ae60" : "white", color: isToday ? "white" : "#666", padding: "10px 5px", textAlign: "center", fontSize: "12px", fontWeight: "bold" }}>
                          {dayShort} {dateStr}
                        </div>
                      );
                    })}

                    {/* Buchungs-Zellen pro Tag */}
                    {daysOfWeek.map((dayNameFull, idx) => {
                      const dayBookings = bookings.filter(b => b.pitchId === p.id && b.day === dayNameFull).sort((a, b) => a.startTime.localeCompare(b.startTime));
                      
                      return (
                        <div key={idx} style={{ background: "white", padding: "4px", minHeight: "120px", display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px", width: "100%" }}>
                            {dayBookings.map(b => {
                              // Breite berechnen für Neben-/Untereinander-Darstellung
                              const shareWidth = b.share === "Halb" ? "calc(50% - 1px)" : b.share === "Viertel" ? "calc(25% - 1.5px)" : "100%";
                              const bColor = getTeamColor(b.team);

                              return (
                                <div key={b.id} style={{ width: shareWidth, background: bColor, color: "white", padding: "6px 4px", borderRadius: "4px", position: "relative", boxSizing: "border-box", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)" }}>
                                  <div style={{ fontSize: "11px", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: "12px" }}>
                                    {b.team}
                                  </div>
                                  <div style={{ fontSize: "10px", opacity: 0.9 }}>
                                    {b.startTime}-{b.endTime}
                                  </div>
                                  <button onClick={() => handleDeleteBooking(b.id)} style={{ position: "absolute", top: "2px", right: "2px", background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "10px", padding: 0 }}>✖</button>
                                </div>
                              )
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

      {/* TAB 2: BUCHEN */}
      {activeTab === "book" && (
        <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "10px", border: "1px solid #ddd", textAlign: "left" }}>
          
          {/* KONFLIKT-ANZEIGE */}
          {conflictBooking ? (
            <div style={{ background: "#f8d7da", border: "1px solid #f5c6cb", padding: "15px", borderRadius: "8px", marginBottom: "15px" }}>
              <h3 style={{ color: "#721c24", margin: "0 0 10px 0" }}>⚠️ Platz überbucht!</h3>
              <p style={{ fontSize: "13px", color: "#721c24", marginBottom: "15px" }}>
                Der Platz ist zur gewünschten Zeit bereits durch <strong>{conflictBooking.team}</strong> ({conflictBooking.share || "Ganz"}) belegt und bietet nicht mehr genug Fläche für deine Buchung.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button onClick={sendConflictToJugendleitung} style={{ background: "#dc3545", color: "white", padding: "10px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                  🚨 An Jugendleitung melden
                </button>
                <button onClick={shareConflictViaWhatsApp} style={{ background: "#25D366", color: "white", padding: "10px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                  💬 Mit Trainer klären (Teilen)
                </button>
                <button onClick={() => setConflictBooking(null)} style={{ background: "transparent", color: "#555", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer", marginTop: "5px" }}>
                  Abbrechen & Zeit/Anteil anpassen
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAddBooking}>
              <h3 style={{ fontSize: "1.2rem", margin: "0 0 15px 0", color: "#2146d0" }}>Neue Belegung eintragen</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Mannschaft</label>
                  <select value={bookTeam} onChange={(e) => setBookTeam(e.target.value)} style={inputStyle} required>
                    <option value="" disabled>Bitte wählen...</option>
                    {teams && teams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Art</label>
                  <select value={bookType} onChange={(e) => setBookType(e.target.value)} style={inputStyle}>
                    {bookingTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Tag</label>
                  <select value={bookDay} onChange={(e) => setBookDay(e.target.value)} style={inputStyle}>
                    {daysOfWeek.map(day => <option key={day} value={day}>{day}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Platzanteil</label>
                  <select value={bookShare} onChange={(e) => setBookShare(e.target.value)} style={inputStyle}>
                    <option value="Ganz">Ganz (100%)</option>
                    <option value="Halb">Halb (50%)</option>
                    <option value="Viertel">Viertel (25%)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Platz wählen</label>
                <select value={bookPitch} onChange={(e) => setBookPitch(e.target.value)} style={inputStyle} required>
                  {pitches.length === 0 && <option value="">Keine Plätze vorhanden</option>}
                  {pitches.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.hasFloodlight ? "💡" : ""} {p.hasCabin ? "🚿" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Startzeit</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Endzeit</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} required />
                </div>
              </div>

              <button type="submit" disabled={pitches.length === 0} style={{ width: "100%", padding: "12px", background: pitches.length === 0 ? "#ccc" : "#27ae60", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "14px", cursor: pitches.length === 0 ? "not-allowed" : "pointer" }}>
                💾 Platz Buchen
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 3: PLÄTZE VERWALTEN */}
      {activeTab === "manage" && (
        <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "10px", border: "1px solid #ddd", textAlign: "left" }}>
          <h3 style={{ fontSize: "1.2rem", margin: "0 0 15px 0", color: "#2146d0" }}>Neuen Platz anlegen</h3>
          
          <form onSubmit={handleAddPitch} style={{ marginBottom: "20px" }}>
            <input 
              type="text" 
              placeholder="Name (z.B. Hauptplatz, Kunstrasen...)" 
              value={newPitchName} 
              onChange={(e) => setNewPitchName(e.target.value)} 
              style={{ ...inputStyle, marginBottom: "10px" }} 
              required 
            />
            <div style={{ display: "flex", gap: "15px", marginBottom: "15px", fontSize: "14px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                <input type="checkbox" checked={hasFloodlight} onChange={(e) => setHasFloodlight(e.target.checked)} />
                💡 Flutlicht
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                <input type="checkbox" checked={hasCabin} onChange={(e) => setHasCabin(e.target.checked)} />
                🚿 Kabine
              </label>
            </div>
            <button type="submit" style={{ width: "100%", padding: "10px", background: "#2146d0", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
              ➕ Platz speichern
            </button>
          </form>

          <hr style={{ borderColor: "#ddd", margin: "20px 0" }} />
          
          <h4 style={{ margin: "0 0 10px 0" }}>Bestehende Plätze</h4>
          {pitches.length === 0 ? (
            <p style={{ color: "#666", fontSize: "13px" }}>Noch keine Plätze vorhanden.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {pitches.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}>
                  <div>
                    <strong style={{ fontSize: "14px", color: "#333" }}>{p.name}</strong>
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                      {p.hasFloodlight ? "💡 Flutlicht " : ""} 
                      {p.hasCabin ? "🚿 Kabine" : ""}
                    </div>
                  </div>
                  <button onClick={() => handleDeletePitch(p.id)} style={{ background: "transparent", border: "none", color: "#e74c3c", fontSize: "18px", cursor: "pointer" }}>🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}