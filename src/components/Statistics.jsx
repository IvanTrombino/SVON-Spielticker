import { useState, useEffect } from "react";
// --- NEU: Firebase Imports ---
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function Statistics() {
  const [scorers, setScorers] = useState({});
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");

  useEffect(() => {
    // 1. Teams in Echtzeit aus der Cloud laden
    const unsubTeams = onSnapshot(doc(db, "ticker", "teams"), (docSnap) => {
      if (docSnap.exists()) {
        const loadedTeams = docSnap.data().teamsList || [];
        setTeams(loadedTeams);
        
        // Erstes Team standardmäßig auswählen, falls noch keines gewählt ist
        if (loadedTeams.length > 0 && !selectedTeam) {
          setSelectedTeam(loadedTeams[0]);
        }
      }
    });

    // 2. Torschützen in Echtzeit aus der Cloud laden
    const unsubScorers = onSnapshot(doc(db, "ticker", "scorers"), (docSnap) => {
      if (docSnap.exists()) {
        setScorers(docSnap.data());
      }
    });

    return () => {
      unsubTeams();
      unsubScorers();
    };
  }, [selectedTeam]);

  // Bonus: Torschützen nach Anzahl der Tore absteigend sortieren
  const currentScorers = Object.entries(scorers[selectedTeam] || {})
    .sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ padding: "15px", maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ color: "#2146d0", marginBottom: "20px" }}>🏆 Torschützenstatistik</h2>

      <select
        value={selectedTeam}
        onChange={(e) => setSelectedTeam(e.target.value)}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          fontSize: "16px",
          marginBottom: "20px"
        }}
      >
        {teams.length === 0 && <option value="">Keine Teams vorhanden</option>}
        {teams.map((team) => (
          <option key={team} value={team}>
            {team}
          </option>
        ))}
      </select>

      <hr style={{ margin: "20px 0", borderColor: "#eee" }} />

      {currentScorers.length === 0 ? (
        <p style={{ color: "#777", textAlign: "center" }}>Noch keine Torschützen erfasst.</p>
      ) : (
        currentScorers.map(([player, goals]) => (
          <div
            key={player}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid #ddd",
              background: "white",
              padding: "12px 15px",
              marginTop: "8px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
            }}
          >
            <span style={{ fontSize: "16px" }}>{player}</span>
            <strong style={{ fontSize: "18px", color: "#2146d0" }}>{goals} ⚽</strong>
          </div>
        ))
      )}
    </div>
  );
}