import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { compareTeamNames, teamChannel } from "../teamOrder";

export default function TeamManager({ clubId }) {
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState("");

  // Hilfsfunktion: Sortiert die Teams nach deiner exakten Wunsch-Hierarchie
  const sortTeams = (teamList) => [...teamList].sort(compareTeamNames);

  // Teams für diesen Club in Echtzeit aus der Cloud laden und sofort sortieren
  useEffect(() => {
    if (!clubId) return;

    const docName = `${clubId}_teams`;
    const unsub = onSnapshot(doc(db, "ticker", docName), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const loadedTeams = data.teamsList || [];
        setTeams(sortTeams(loadedTeams));
      } else {
        if (clubId === "svon") {
          const defaultTeams = ["1. Mannschaft", "2. Mannschaft", "F-Jugend"];
          setTeams(sortTeams(defaultTeams));
        } else {
          setTeams(["1. Mannschaft"]);
        }
      }
    });
    
    return () => unsub();
  }, [clubId]);

  // Teams für diesen Club in die Cloud speichern
  const saveTeamsToCloud = async (updatedTeams) => {
    try {
      const docName = `${clubId}_teams`;
      await setDoc(doc(db, "ticker", docName), { teamsList: updatedTeams });
    } catch (error) {
      console.error("Fehler beim Cloud-Speichern der Teams:", error);
    }
  };

  const addTeam = () => {
    if (!newTeam.trim()) return;
    const trimmedTeam = newTeam.trim();
    if (teams.includes(trimmedTeam)) return;

    const updatedTeams = sortTeams([...teams, trimmedTeam]);
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
      <h2 style={{ color: "#2146d0", marginBottom: "5px" }}>👥 Mannschaftsverwaltung</h2>
      <p style={{ color: "#666", fontSize: "12px", marginBottom: "6px" }}>Aktiver Verein: <strong>{clubId.toUpperCase()}</strong></p>
      <p style={{ color: "#666", fontSize: "12px", marginBottom: "20px" }}>Mannschaften aus der Jugenddatenbank (Teams) erscheinen automatisch auch im Live-Ticker und in der Platzbelegung – hier nur zusätzliche Teams wie „F-Jugend Funino“ anlegen.</p>

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
            <span style={{ fontWeight: "bold", fontSize: "16px" }}>
              {team}
              <span style={{ display: "block", fontWeight: "normal", fontSize: "11px", color: "#888" }}>📣 Push-Kanal: {teamChannel(clubId, team)}</span>
            </span>

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