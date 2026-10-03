import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function PlayerManager() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState({});

  // 1. Teams in Echtzeit aus Firebase laden
  useEffect(() => {
    const unsubTeams = onSnapshot(doc(db, "ticker", "teams"), (docSnap) => {
      if (docSnap.exists()) {
        const teamsList = docSnap.data().teamsList || [];
        setTeams(teamsList);
        if (teamsList.length > 0 && (!selectedTeam || !teamsList.includes(selectedTeam))) {
          setSelectedTeam(teamsList[0]);
        }
      }
    });
    return () => unsubTeams();
  }, []);

  // 2. Spieler in Echtzeit aus der Cloud laden
  useEffect(() => {
    const unsubPlayers = onSnapshot(doc(db, "ticker", "players"), (docSnap) => {
      if (docSnap.exists()) {
        setPlayers(docSnap.data() || {});
      } else {
        setPlayers({});
      }
    });
    return () => unsubPlayers();
  }, []);

  // Hilfsfunktion: Neue Spielerliste in die Cloud speichern
  const savePlayersToCloud = async (newPlayers) => {
    try {
      await setDoc(doc(db, "ticker", "players"), newPlayers);
    } catch (error) {
      console.error("Fehler beim Cloud-Speichern der Spieler:", error);
    }
  };

  const addPlayer = () => {
    if (!playerName.trim()) return;
    if (!selectedTeam) return;

    const currentPlayers = players[selectedTeam] || [];
    const newPlayers = {
      ...players,
      [selectedTeam]: [...currentPlayers, playerName.trim()],
    };

    setPlayers(newPlayers);
    savePlayersToCloud(newPlayers);
    setPlayerName("");
  };

  const deletePlayer = (player) => {
    const currentPlayers = players[selectedTeam] || [];
    const newPlayers = {
      ...players,
      [selectedTeam]: currentPlayers.filter((p) => p !== player),
    };

    setPlayers(newPlayers);
    savePlayersToCloud(newPlayers);
  };

  return (
    <div style={{ padding: "15px", maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ color: "#2146d0", marginBottom: "20px" }}>👤 Spielerverwaltung</h2>

      <select
        value={selectedTeam}
        onChange={(e) => setSelectedTeam(e.target.value)}
        style={{ padding: "10px", width: "100%", marginBottom: "15px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "15px", background: "#f8f9fa" }}
      >
        {teams.length === 0 && <option value="">Keine Teams vorhanden</option>}
        {teams.map((team) => (
          <option key={team} value={team}>
            {team}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Spielername eingeben..."
          style={{
            flex: 1,
            padding: "10px",
            boxSizing: "border-box",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "15px"
          }}
        />

        <button 
          onClick={addPlayer} 
          disabled={!selectedTeam}
          style={{ padding: "0 20px", background: "#2146d0", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "16px" }}
        >
          ➕
        </button>
      </div>

      <hr style={{ margin: "20px 0", borderColor: "#eee" }} />

      {(players[selectedTeam] || []).length === 0 ? (
        <p style={{ color: "#777", fontSize: "14px", textAlign: "center" }}>Noch keine Spieler in dieser Mannschaft.</p>
      ) : (
        (players[selectedTeam] || []).map((player) => (
          <div
            key={player}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid #ddd",
              padding: "10px 15px",
              marginTop: "8px",
              borderRadius: "8px",
              background: "white",
              boxShadow: "0 2px 4px rgba(0,0,0,0.03)"
            }}
          >
            <span style={{ fontWeight: "bold" }}>{player}</span>

            <button 
              onClick={() => deletePlayer(player)} 
              style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "5px", padding: "6px 10px", cursor: "pointer" }}
            >
              ❌
            </button>
          </div>
        ))
      )}
    </div>
  );
}