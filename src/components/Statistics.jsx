import React, { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function Statistics() {
  const [teams, setTeams] = useState([]);
  
  // Startseite ist standardmäßig die 1. Mannschaft
  const [selectedTeam, setSelectedTeam] = useState("1. Mannschaft");
  
  const [matches, setMatches] = useState([]);
  const [liveMatchHistory, setLiveMatchHistory] = useState([]);

  // 1. Teams in Echtzeit aus der Cloud laden
  useEffect(() => {
    const unsubTeams = onSnapshot(doc(db, "ticker", "teams"), (snap) => {
      if (snap.exists() && snap.data().teamsList) {
        const teamsList = snap.data().teamsList;
        setTeams(teamsList);
        
        // Falls "1. Mannschaft" nicht existiert, nimm das erste verfügbare Team
        if (teamsList.length > 0 && !teamsList.includes(selectedTeam)) {
          setSelectedTeam(teamsList[0]);
        }
      }
    });
    return () => unsubTeams();
  }, [selectedTeam]);

  // 2. Beendete Spiele (Historie) laden
  useEffect(() => {
    const unsubMatches = onSnapshot(doc(db, "ticker", "matches"), (snap) => {
      if (snap.exists()) {
        setMatches(snap.data().matchesList || []);
      }
    });
    return () => unsubMatches();
  }, []);

  // 3. Aktuelles Live-Spiel für dieses Team laden (damit Live-Tore sofort zählen)
  useEffect(() => {
    if (!selectedTeam) return;
    const docName = `live_match_${selectedTeam}`;
    const unsubLive = onSnapshot(doc(db, "ticker", docName), (snap) => {
      if (snap.exists() && snap.data().history) {
        setLiveMatchHistory(snap.data().history);
      } else {
        setLiveMatchHistory([]);
      }
    });
    return () => unsubLive();
  }, [selectedTeam]);

  // --- STATISTIK DYNAMISCH BERECHNEN ---
  const calculateStats = () => {
    const stats = {};

    // Ereignisse aus den beendeten Spielen DIESES Teams filtern
    const teamMatches = matches.filter((m) => m.team === selectedTeam);
    const allEvents = [];

    teamMatches.forEach((match) => {
      if (match.history) allEvents.push(...match.history);
    });
    
    // Live-Ereignisse anhängen
    allEvents.push(...liveMatchHistory);

    // Zusammenzählen
    allEvents.forEach((event) => {
      // Gegner oder unbekannte Spieler ignorieren
      if (!event.player || event.player === "Unbekannt" || event.player === "Gegner") return;

      if (!stats[event.player]) {
        stats[event.player] = { goals: 0, yellow: 0, yellowred: 0, red: 0 };
      }

      if (event.type === "goal") stats[event.player].goals += 1;
      if (event.type === "yellow") stats[event.player].yellow += 1;
      if (event.type === "yellowred") stats[event.player].yellowred += 1;
      if (event.type === "red") stats[event.player].red += 1;
    });

    // Aus dem Objekt eine sortierte Liste machen (nach Toren absteigend sortiert)
    return Object.entries(stats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
  };

  const playerStats = calculateStats();

  return (
    <div style={{ padding: "15px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h2 style={{ color: "#2146d0", marginBottom: "20px", textAlign: "center" }}>📊 Spielerstatistik</h2>

      {/* TEAM-AUSWAHL */}
      <div style={{ background: "white", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "20px", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
        <label style={{ display: "block", fontSize: "13px", color: "#555", marginBottom: "6px", fontWeight: "bold" }}>
          Mannschaft auswählen:
        </label>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "15px", background: "#f8f9fa" }}
        >
          {!teams.includes("1. Mannschaft") && <option value="1. Mannschaft">1. Mannschaft</option>}
          {teams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <hr style={{ margin: "20px 0", borderColor: "#eee" }} />

      {/* STATISTIK-TABELLE */}
      {playerStats.length === 0 ? (
        <p style={{ color: "#777", textAlign: "center", marginTop: "20px" }}>
          Bisher keine Ereignisse (Tore oder Karten) für diese Mannschaft erfasst.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: "10px", overflow: "hidden", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
            <thead style={{ background: "#2146d0", color: "white" }}>
              <tr>
                <th style={{ padding: "12px", textAlign: "left" }}>Spieler</th>
                <th style={{ padding: "12px", textAlign: "center", fontSize: "1.2rem" }}>⚽</th>
                <th style={{ padding: "12px", textAlign: "center", fontSize: "1.2rem" }}>🟨</th>
                <th style={{ padding: "12px", textAlign: "center", fontSize: "1.2rem" }}>🟨🟥</th>
                <th style={{ padding: "12px", textAlign: "center", fontSize: "1.2rem" }}>🟥</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map((stat, index) => (
                <tr key={stat.name} style={{ borderBottom: "1px solid #eee", background: index % 2 === 0 ? "white" : "#f8f9fa" }}>
                  <td style={{ padding: "12px", fontWeight: "bold", color: "#333", textAlign: "left" }}>
                    {stat.name}
                  </td>
                  <td style={{ padding: "12px", textAlign: "center", fontWeight: "bold", color: "#27ae60" }}>
                    {stat.goals > 0 ? stat.goals : "-"}
                  </td>
                  <td style={{ padding: "12px", textAlign: "center", fontWeight: "bold", color: "#f1c40f" }}>
                    {stat.yellow > 0 ? stat.yellow : "-"}
                  </td>
                  <td style={{ padding: "12px", textAlign: "center", fontWeight: "bold", color: "#e67e22" }}>
                    {stat.yellowred > 0 ? stat.yellowred : "-"}
                  </td>
                  <td style={{ padding: "12px", textAlign: "center", fontWeight: "bold", color: "#e74c3c" }}>
                    {stat.red > 0 ? stat.red : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}