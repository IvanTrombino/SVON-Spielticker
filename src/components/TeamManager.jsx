import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function TeamManager() {
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState("");

  // Teams in Echtzeit direkt aus der Cloud laden
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "ticker", "teams"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTeams(data.teamsList || []);
      } else {
        setTeams([]);
      }
    });
    
    return () => unsub();
  }, []);

  // Teams in die Cloud speichern
  const saveTeamsToCloud = async (updatedTeams) => {
    try {
      await setDoc(doc(db, "ticker", "teams"), { teamsList: updatedTeams });
    } catch (error) {
      console.error("Fehler beim Cloud-Speichern der Teams:", error);
    }
  };

  const addTeam = () => {
    if (!newTeam.trim()) return;
    const trimmedTeam = newTeam.trim();
    if (teams.includes(trimmedTeam)) return;

    const updatedTeams = [...teams, trimmedTeam];
    setTeams(updatedTeams);
    saveTeamsToCloud(updatedTeams);
    setNewTeam("");
  };

  const deleteTeam = (teamToDelete) => {
    const updatedTeams = teams.filter((t) => t !== teamToDelete);
    setTeams(updatedTeams);
    saveTeamsToCloud(updatedTeams);
  };

  return (
    <div style={{ padding: "15px", maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ color: "#2146d0", marginBottom: "20px" }}>👥 Mannschaftsverwaltung</h2>

      <div style={{ display: "flex", gap: "10px", marginBottom: "25px" }}>
        <input
          value={newTeam}
          onChange={(e) => setNewTeam(e.target.value)}
          placeholder="Neue Mannschaft eingeben..."
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "16px",
            boxSizing: "border-box"
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