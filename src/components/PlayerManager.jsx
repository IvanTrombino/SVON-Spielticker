import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function PlayerManager() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState([]);

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

  // 2. Spieler für das ausgewählte Team in Echtzeit laden (eigenes Dokument pro Team)
  useEffect(() => {
    if (!selectedTeam) {
      setPlayers([]);
      return;
    }

    const docName = `players_${selectedTeam}`;
    const unsubPlayers = onSnapshot(doc(db, "ticker", docName), (docSnap) => {
      if (docSnap.exists()) {
        setPlayers(docSnap.data().playersList || []);
      } else {
        setPlayers([]);
      }
    });

    return () => unsubPlayers();
  }, [selectedTeam]);

  // Hilfsfunktion: Spieler in ein eigenes Team-Dokument in Firebase speichern
  const savePlayersToCloud = async (updatedList) => {
    if (!selectedTeam) return;
    try {
      const docName = `players_${selectedTeam}`;
      await setDoc(doc(db, "ticker", docName), { playersList: updatedList });
    } catch (error) {
      console.error("Fehler beim Cloud-Speichern der Spieler:", error);
    }
  };

  const addPlayer = () => {
    if (!playerName.trim() || !selectedTeam) return;
    if (players.includes(playerName.trim())) return;

    const updatedList = [...players, playerName.trim()];
    setPlayers(updatedList);
    savePlayersToCloud(updatedList);
    setPlayerName("");
  };

  const deletePlayer = (playerToDelete) => {
    const updatedList = players.filter((p) => p !== playerToDelete);
    setPlayers(updatedList);
    savePlayersToCloud(updatedList);
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

      {players.length === 0 ? (
        <p style={{ color: "#777", fontSize: "14px", textAlign: "center" }}>Noch keine Spieler in dieser Mannschaft.</p>
      ) : (
        players.map((player) => (
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