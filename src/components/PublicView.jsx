import React, { useState, useEffect, useRef } from "react";
import logo from "../assets/SVON-Wappen.png";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function PublicView({ onBackToAdmin }) {
  const [teams, setTeams] = useState([]);
  
  // Startseite ist standardmäßig immer die 1. Mannschaft
  const [selectedTeam, setSelectedTeam] = useState("1. Mannschaft");
  
  const [homeTeam, setHomeTeam] = useState("SVON");
  const [awayTeam, setAwayTeam] = useState("Gast");
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState([]);

  // Datum und Anstoßzeit
  const [matchDate, setMatchDate] = useState("");
  const [kickoffTime, setKickoffTime] = useState("");

  // Push-Benachrichtigungen
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    "Notification" in window && Notification.permission === "granted"
  );
  const historyLengthRef = useRef(0);

  // Teams laden
  useEffect(() => {
    const unsubTeams = onSnapshot(doc(db, "ticker", "teams"), (snap) => {
      if (snap.exists() && snap.data().teamsList) {
        setTeams(snap.data().teamsList);
      }
    });
    return () => unsubTeams();
  }, []);

  // Live-Daten dynamisch abonnieren
  useEffect(() => {
    if (!selectedTeam) return;

    const docName = `live_match_${selectedTeam}`;
    const unsubLive = onSnapshot(doc(db, "ticker", docName), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHomeTeam(data.homeTeam !== undefined ? data.homeTeam : selectedTeam);
        setAwayTeam(data.awayTeam !== undefined ? data.awayTeam : "Gast");
        setHomeGoals(data.homeGoals || 0);
        setAwayGoals(data.awayGoals || 0);
        setMatchDate(data.matchDate || "");
        setKickoffTime(data.kickoffTime || "");
        
        const newHistory = data.history || [];
        setHistory(newHistory);

        // Zeit berechnen (exakt wie in MatchView)
        if (data.isRunning) {
          if (data.startTime) {
            const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
            setTime(elapsed);
          } else if (data.time !== undefined) {
            setTime(data.time);
          }
          setIsRunning(true);
        } else {
          if (data.time !== undefined) setTime(data.time);
          setIsRunning(false);
        }

        // Benachrichtigungen auslösen, wenn ein NEUES Ereignis dazu kam
        if (newHistory.length > historyLengthRef.current && historyLengthRef.current !== 0) {
          const lastEvent = newHistory[newHistory.length - 1];
          triggerNotification(lastEvent, data.homeTeam || selectedTeam, data.awayTeam || "Gast");
        }
        historyLengthRef.current = newHistory.length;

      } else {
        setHomeTeam(selectedTeam);
        setAwayTeam("Gast");
        setHomeGoals(0);
        setAwayGoals(0);
        setHistory([]);
        setTime(0);
        setIsRunning(false);
        setMatchDate("");
        setKickoffTime("");
        historyLengthRef.current = 0;
      }
    });

    return () => unsubLive();
  }, [selectedTeam]);

  // Lokale Stoppuhr: Zählt die Zeit in der PublicView live mit!
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => setTime((prev) => prev + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const getEventIcon = (type) => {
    if (type === "goal") return "⚽";
    if (type === "yellow") return "🟨";
    if (type === "yellowred") return "🟨🟥";
    if (type === "red") return "🟥";
    return "📝";
  };

  // Funktion zum Anfragen der Benachrichtigungs-Rechte
  const requestNotifications = () => {
    if (!("Notification" in window)) {
      alert("Dein Browser unterstützt leider keine Live-Benachrichtigungen.");
      return;
    }
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        setNotificationsEnabled(true);
        new Notification("SVON Live-Ticker", {
          body: "Benachrichtigungen aktiviert! Du erfährst sofort, wenn ein Tor fällt.",
          icon: logo
        });
      }
    });
  };

  // Funktion zum Abfeuern der Benachrichtigung
  const triggerNotification = (event, currentHome, currentAway) => {
    if (Notification.permission === "granted") {
      let title = "SVON Live-Ticker";
      let body = "";
      const eventTeam = event.team === "home" ? currentHome : currentAway;

      if (event.type === "goal") {
        title = `⚽ TOOOOR für ${eventTeam}!`;
        body = `Torschütze: ${event.player} (Minute ${event.minute})`;
      } else if (event.type === "yellow") {
        title = `🟨 Gelbe Karte für ${eventTeam}`;
        body = `Spieler: ${event.player} (Minute ${event.minute})`;
      } else if (event.type === "yellowred") {
        title = `🟨🟥 Gelb-Rot für ${eventTeam}`;
        body = `Spieler: ${event.player} (Minute ${event.minute})`;
      } else if (event.type === "red") {
        title = `🟥 Rote Karte für ${eventTeam}`;
        body = `Spieler: ${event.player} (Minute ${event.minute})`;
      }

      new Notification(title, { body, icon: logo });
    }
  };

  // Datum formatieren
  const displayDate = matchDate ? new Date(matchDate).toLocaleDateString("de-DE") : "";

  return (
    <div style={{ padding: "15px", textAlign: "center", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
      
      {onBackToAdmin && (
        <button 
          onClick={onBackToAdmin} 
          style={{ marginBottom: "15px", padding: "8px 15px", background: "#7f8c8d", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>
          Zurück zum Admin-Modus
        </button>
      )}

      <img src={logo} alt="SVON Logo" style={{ maxWidth: "70px", marginBottom: "10px" }} />
      <h2 style={{ color: "#2146d0", margin: "0 0 5px 0", fontSize: "1.5rem" }}>Live-Ticker</h2>
      
      {/* Benachrichtigungs-Button */}
      {!notificationsEnabled ? (
        <button 
          onClick={requestNotifications}
          style={{ marginBottom: "15px", padding: "6px 12px", background: "#f39c12", color: "white", border: "none", borderRadius: "15px", cursor: "pointer", fontSize: "12px", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
          🔔 Live-Benachrichtigungen aktivieren
        </button>
      ) : (
        <p style={{ color: "#27ae60", fontSize: "12px", marginBottom: "15px", fontWeight: "bold" }}>🔔 Benachrichtigungen aktiv</p>
      )}

      {/* MANNSCHAFTS-AUSWAHL DROPDOWN */}
      <div style={{ background: "white", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "20px", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
        <label style={{ display: "block", fontSize: "13px", color: "#555", marginBottom: "6px", fontWeight: "bold" }}>
          Mannschaft auswählen:
        </label>
        <select 
          value={selectedTeam} 
          onChange={(e) => setSelectedTeam(e.target.value)}
          style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "15px", background: "#f8f9fa" }}
        >
          {/* Fallback falls 1. Mannschaft (noch) nicht im Teams-Array ist */}
          {!teams.includes("1. Mannschaft") && <option value="1. Mannschaft">1. Mannschaft</option>}
          {teams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* LIVE SPIELANZEIGE */}
      <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
        
        {/* Datum & Uhrzeit Anzeige */}
        {(displayDate || kickoffTime) && (
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "15px", background: "#eee", padding: "6px", borderRadius: "6px", display: "inline-block" }}>
            📅 {displayDate} {kickoffTime && `| ⏱ ${kickoffTime} Uhr`}
          </div>
        )}

        <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#333", marginBottom: "10px" }}>
          {homeTeam} vs {awayTeam}
        </div>

        <div style={{ fontSize: "3.5rem", fontWeight: "bold", margin: "10px 0", lineHeight: "1", color: "#2146d0" }}>
          {homeGoals} : {awayGoals}
        </div>

        <div style={{ fontSize: "1.5rem", fontFamily: "monospace", color: isRunning ? "#27ae60" : "#e74c3c", marginBottom: "15px", fontWeight: "bold" }}>
          {formatTime(time)} {isRunning ? "LIVE" : "Pause"}
        </div>

        <hr style={{ margin: "20px 0", borderColor: "#eee" }} />

        <h3 style={{ fontSize: "1.1rem", marginBottom: "10px" }}>Spielbericht</h3>
        {history.length === 0 ? (
          <p style={{ color: "#999", fontSize: "14px" }}>Bisher noch keine Ereignisse für dieses Team.</p>
        ) : (
          <div style={{ textAlign: "left", padding: "10px", borderRadius: "8px", background: "white", border: "1px solid #ddd" }}>
            {[...history].reverse().map((event) => (
              <div key={event.id} style={{ padding: "8px 0", borderBottom: "1px solid #f5f5f5", display: "flex", gap: "12px", alignItems: "center" }}>
                <span style={{ fontWeight: "bold", width: "35px", color: "#555" }}>{event.minute}'</span>
                <span style={{ fontSize: "1.4rem" }}>{getEventIcon(event.type)}</span>
                <span style={{ fontSize: "14px" }}><strong>{event.team === "home" ? homeTeam : awayTeam}</strong>: {event.player}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}