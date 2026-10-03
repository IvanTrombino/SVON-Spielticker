import React, { useState, useEffect } from "react";
import logo from "../assets/SVON-Wappen.png";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function PublicView({ onBackToAdmin }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("SVON");
  
  const [homeTeam, setHomeTeam] = useState("SVON");
  const [awayTeam, setAwayTeam] = useState("Gast");
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState([]);

  // Teams und Live-Daten aus Firebase abonnieren
  useEffect(() => {
    const unsubTeams = onSnapshot(doc(db, "ticker", "teams"), (snap) => {
      if (snap.exists() && snap.data().teamsList) {
        setTeams(snap.data().teamsList);
      }
    });

    const unsubLive = onSnapshot(doc(db, "ticker", "live_match"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHomeTeam(data.homeTeam || "SVON");
        setAwayTeam(data.awayTeam || "Gast");
        setHomeGoals(data.homeGoals || 0);
        setAwayGoals(data.awayGoals || 0);
        setHistory(data.history || []);
        if (data.time !== undefined) setTime(data.time);
        setIsRunning(data.isRunning || false);
      }
    });

    return () => {
      unsubTeams();
      unsubLive();
    };
  }, []);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const getEventIcon = (type) => {
    if (type === "goal") return "Tor";
    if (type === "yellow") return "Gelb";
    if (type === "red") return "Rot";
    return "Notiz";
  };

  return (
    <div style={{ padding: "15px", textAlign: "center", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
      
      {onBackToAdmin && (
        <button 
          onClick={onBackToAdmin} 
          style={{ marginBottom: "15px", padding: "8px 15px", background: "#7f8c8d", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>
          Zurueck zum Admin-Modus
        </button>
      )}

      <img src={logo} alt="SVON Logo" style={{ maxWidth: "70px", marginBottom: "10px" }} />
      <h2 style={{ color: "#2146d0", margin: "0 0 5px 0", fontSize: "1.5rem" }}>Live-Ticker</h2>
      <p style={{ color: "#666", fontSize: "13px", marginBottom: "15px" }}>Zuschaueransicht (Nur Lesen)</p>

      {/* --- MANNSCHAFTS-AUSWAHL DROPDOWN --- */}
      <div style={{ background: "white", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "20px", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
        <label style={{ display: "block", fontSize: "13px", color: "#555", marginBottom: "6px", fontWeight: "bold" }}>
          Mannschaft auswählen:
        </label>
        <select 
          value={selectedTeam} 
          onChange={(e) => setSelectedTeam(e.target.value)}
          style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "15px", background: "#f8f9fa" }}
        >
          <option value="SVON">Alle / SVON</option>
          {teams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* --- LIVE SPIELANZEIGE --- */}
      <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
        
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
          <p style={{ color: "#999", fontSize: "14px" }}>Bisher noch keine Ereignisse im Spiel.</p>
        ) : (
          <div style={{ textAlign: "left", padding: "10px", borderRadius: "8px", background: "white", border: "1px solid #ddd" }}>
            {[...history].reverse().map((event) => (
              <div key={event.id} style={{ padding: "8px 0", borderBottom: "1px solid #f5f5f5", display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontWeight: "bold", width: "35px", color: "#555" }}>{event.minute}'</span>
                <span style={{ fontSize: "1.1rem" }}>{getEventIcon(event.type)}</span>
                <span style={{ fontSize: "14px" }}><strong>{event.team === "home" ? homeTeam : awayTeam}</strong>: {event.player}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}