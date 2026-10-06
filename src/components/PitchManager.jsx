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

  // --- KONFLIKT-STATE ---
  const [conflictBooking, setConflictBooking] = useState(null);

  const daysOfWeek = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  const bookingTypes = ["Training", "Ligaspiel", "Pokalspiel", "Freundschaftsspiel"];

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
    if (window.confirm("Diesen Platz wirklich löschen? Alle Buchungen dafür bleiben (als verwaist) erhalten oder sollten gelöscht werden.")) {
      const updatedPitches = pitches.filter(p => p.id !== id);
      setPitches(updatedPitches);
      syncPitches(updatedPitches);
    }
  };

  // --- BUCHUNG VERWALTEN & KONFLIKT-CHECK ---
  const handleAddBooking = (e) => {
    e.preventDefault();
    setConflictBooking(null);

    // Zeit-Überschneidung prüfen
    const hasConflict = bookings.find(b => {
      if (b.pitchId !== bookPitch || b.day !== bookDay) return false;
      // String-Vergleich für Zeiten (z.B. "17:00" < "18:30" funktioniert in JS)
      return (startTime >= b.startTime && startTime < b.endTime) || 
             (endTime > b.startTime && endTime <= b.endTime) ||
             (startTime <= b.startTime && endTime >= b.endTime);
    });

    if (hasConflict) {
      setConflictBooking(hasConflict);
      return; // Buchung abbrechen und Konflikt anzeigen
    }

    const newBooking = {
      id: Date.now().toString(),
      team: bookTeam,
      type: bookType,
      day: bookDay,
      pitchId: bookPitch,
      startTime,
      endTime,
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
      
      // Nutzt den Ntfy-Kanal für die Jugendleitung (z.B. clubId + "jugendleitung")
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
    const text = `Hallo! Ich (${currentUserName || bookTeam}) bräuchte am ${bookDay} von ${startTime} bis ${endTime} den ${pitchName} für ein ${bookType}. Aktuell steht dort ${conflictBooking.team} im Plan. Können wir tauschen oder uns einigen?`;
    
    if (navigator.share) {
      navigator.share({
        title: "Platzbelegung Anfrage",
        text: text
      }).catch(console.error);
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
    <div style={{ padding: "10px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ color: "#2146d0", textAlign: "center", marginBottom: "15px" }}>🏟️ Platzbelegung</h2>

      {/* TABS */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "20px" }}>
        <button onClick={() => setActiveTab("schedule")} style={tabButtonStyle("schedule")}>📅 Wochenplan</button>
        <button onClick={() => setActiveTab("book")} style={tabButtonStyle("book")}>➕ Buchen</button>
        <button onClick={() => setActiveTab("manage")} style={tabButtonStyle("manage")}>⚙️ Plätze verwalten</button>
      </div>

      {/* TAB 1: WOCHENPLAN */}
      {activeTab === "schedule" && (
        <div style={{ textAlign: "left" }}>
          {pitches.length === 0 ? (
            <p style={{ color: "#666", textAlign: "center" }}>Noch keine Plätze angelegt. Bitte unter "Plätze verwalten" erstellen.</p>
          ) : (
            daysOfWeek.map(day => {
              // Buchungen für diesen Tag filtern und nach Startzeit sortieren
              const dayBookings = bookings.filter(b => b.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
              
              if (dayBookings.length === 0) return null; // Leere Tage ausblenden, um Platz zu sparen

              return (
                <div key={day} style={{ marginBottom: "15px", background: "white", borderRadius: "10px", border: "1px solid #ddd", overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                  <div style={{ background: "#2146d0", color: "white", padding: "8px 12px", fontWeight: "bold" }}>
                    {day}
                  </div>
                  <div style={{ padding: "10px" }}>
                    {dayBookings.map(b => {
                      const pitchName = pitches.find(p => p.id === b.pitchId)?.name || "Unbekannter Platz";
                      
                      // Farbe je nach Typ
                      let typeColor = "#3498db"; // Training: Blau
                      if (b.type === "Ligaspiel") typeColor = "#e74c3c"; // Rot
                      if (b.type === "Pokalspiel") typeColor = "#f1c40f"; // Gold/Gelb
                      if (b.type === "Freundschaftsspiel") typeColor = "#2ecc71"; // Grün

                      return (
                        <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", padding: "8px 0" }}>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#333" }}>{b.startTime} - {b.endTime} Uhr</div>
                            <div style={{ fontSize: "12px", color: "#666" }}>📍 {pitchName} | 👤 {b.team}</div>
                            <div style={{ display: "inline-block", background: typeColor, color: typeColor === "#f1c40f" ? "#333" : "white", fontSize: "10px", padding: "2px 6px", borderRadius: "4px", marginTop: "4px", fontWeight: "bold" }}>
                              {b.type}
                            </div>
                          </div>
                          <button onClick={() => handleDeleteBooking(b.id)} style={{ background: "transparent", border: "none", color: "#e74c3c", fontSize: "16px", cursor: "pointer" }}>🗑</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
          {bookings.length === 0 && pitches.length > 0 && <p style={{ textAlign: "center", color: "#666" }}>Noch keine Belegungen für diese Woche eingetragen.</p>}
        </div>
      )}

      {/* TAB 2: BUCHEN */}
      {activeTab === "book" && (
        <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "10px", border: "1px solid #ddd", textAlign: "left" }}>
          
          {/* KONFLIKT-ANZEIGE */}
          {conflictBooking ? (
            <div style={{ background: "#f8d7da", border: "1px solid #f5c6cb", padding: "15px", borderRadius: "8px", marginBottom: "15px" }}>
              <h3 style={{ color: "#721c24", margin: "0 0 10px 0" }}>⚠️ Platz bereits belegt!</h3>
              <p style={{ fontSize: "13px", color: "#721c24", marginBottom: "15px" }}>
                Der Platz ist zur gewünschten Zeit bereits durch <strong>{conflictBooking.team}</strong> ({conflictBooking.type}) blockiert.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button onClick={sendConflictToJugendleitung} style={{ background: "#dc3545", color: "white", padding: "10px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                  🚨 An Jugendleitung melden
                </button>
                <button onClick={shareConflictViaWhatsApp} style={{ background: "#25D366", color: "white", padding: "10px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                  💬 Mit Trainer klären (Teilen)
                </button>
                <button onClick={() => setConflictBooking(null)} style={{ background: "transparent", color: "#555", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer", marginTop: "5px" }}>
                  Abbrechen & andere Zeit wählen
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAddBooking}>
              <h3 style={{ fontSize: "1.2rem", margin: "0 0 15px 0", color: "#2146d0" }}>Neue Belegung eintragen</h3>
              
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Mannschaft</label>
                <select value={bookTeam} onChange={(e) => setBookTeam(e.target.value)} style={inputStyle} required>
                  <option value="" disabled>Bitte wählen...</option>
                  {teams && teams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Art</label>
                  <select value={bookType} onChange={(e) => setBookType(e.target.value)} style={inputStyle}>
                    {bookingTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Tag</label>
                  <select value={bookDay} onChange={(e) => setBookDay(e.target.value)} style={inputStyle}>
                    {daysOfWeek.map(day => <option key={day} value={day}>{day}</option>)}
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

      {/* TAB 3: PLÄTZE VERWALTEN (Admin / Orga) */}
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