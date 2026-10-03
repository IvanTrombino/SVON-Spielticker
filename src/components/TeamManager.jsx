import { useState, useEffect } from "react";
// --- NEU: Firebase Imports ---
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function TeamManager({ teams = [], setTeams }) {
  const [newTeam, setNewTeam] = useState("");

  // LIVE-DATEN: Teams in Echtzeit aus der Cloud laden
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "ticker", "teams"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (setTeams) setTeams(data.teamsList || []);
      } else {
        if (setTeams) setTeams([]);
      }
    });
    
    return () => unsub(); // Aufräumen, wenn die Seite verlassen wird
  }, [setTeams]);

  // Hilfsfunktion: Teams in die Cloud speichern
  const saveTeamsToCloud = async (updatedTeams) => {
    try {
      await setDoc(doc(db, "ticker", "teams"), { teamsList: updatedTeams });
    } catch (error) {
      console.error("Fehler beim Cloud-Speichern der Teams:", error);
    }
  };

  const addTeam = () => {
    if (!newTeam.trim()) return;
    if (teams.includes(newTeam)) return;

    const updatedTeams = [...teams, newTeam];
    
    if (setTeams) setTeams(updatedTeams); // Schnelles Update für die Anzeige
    saveTeamsToCloud(updatedTeams);       // Ab in die Cloud!
    
    setNewTeam("");
  };

  const deleteTeam = (team) => {
    const updatedTeams = teams.filter((t) => t !== team);
    
    if (setTeams) setTeams(updatedTeams);
    saveTeamsToCloud(updatedTeams);
  };

  return (
    <div style={{ padding: "15px", maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ color: "#2146d0", marginBottom: "20px" }}>👥 Mannschaftsverwaltung</h2>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "25px",
        }}
      >
        <input
          value={newTeam}
          onChange={(e) => setNewTeam(e.target.value)}
          placeholder="Neue Mannschaft"
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "16px"
          }}
        />

        <button 
          onClick={addTeam}
          style={{
            padding: "0 20px",
            background: "#2146d0",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "18px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          ➕
        </button>
      </div>

      {teams.length === 0 ? (
        <p style={{ color: "#777", textAlign: "center" }}>Noch keine Mannschaften angelegt.</p>
      ) : (
        teams.map((team) => (
          <div
            key={team}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid #ddd",
              background: "white",
              borderRadius: "8px",
              padding: "12px 15px",
              marginBottom: "10px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
            }}
          >
            <span style={{ fontWeight: "bold", fontSize: "16px" }}>{team}</span>

            <button
              onClick={() => deleteTeam(team)}
              style={{
                background: "#e74c3c",
                color: "white",
                border: "none",
                borderRadius: "5px",
                padding: "8px 12px",
                cursor: "pointer"
              }}
            >
              ❌
            </button>
          </div>
        ))
      )}
    </div>
  );
}