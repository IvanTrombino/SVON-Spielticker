import { useState, useEffect } from "react";
// --- NEU: Firebase Imports ---
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function PlayerManager() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState({});

  // 1. Teams laden (vorerst noch lokal, bis wir gleich den TeamManager anpassen)
  useEffect(() => {
    const savedTeams = JSON.parse(localStorage.getItem("svon_teams")) || [];
    setTeams(savedTeams);

    if (savedTeams.length > 0) {
      setSelectedTeam(savedTeams[0]);
    }
  }, []);

  // 2. LIVE-DATEN: Spieler in Echtzeit aus der Cloud laden
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "ticker", "players"), (docSnap) => {
      if (docSnap.exists()) {
        setPlayers(docSnap.data());
      } else {
        // Falls das Dokument in der Cloud noch nicht existiert
        setPlayers({});
      }
    });
    return () => unsub(); // Aufräumen, wenn die Seite verlassen wird
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
      [selectedTeam]: [...currentPlayers, playerName],
    };

    setPlayers(newPlayers); // Schnelles Update für die Anzeige
    savePlayersToCloud(newPlayers); // Ab in die Cloud damit!
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
    <div>
      <h2>👤 Spielerverwaltung</h2>

      <select
        value={selectedTeam}
        onChange={(e) => setSelectedTeam(e.target.value)}
        style={{ padding: "8px", width: "100%", marginBottom: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
      >
        {teams.length === 0 && <option value="">Keine Teams vorhanden</option>}
        {teams.map((team) => (
          <option key={team} value={team}>
            {team}
          </option>
        ))}
      </select>

      <p>
        Mannschaft:
        <strong> {selectedTeam || "-"}</strong>
      </p>

      <input
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Spielername"
        style={{
          width: "100%",
          padding: "10px",
          marginTop: "10px",
          marginBottom: "10px",
          boxSizing: "border-box",
          borderRadius: "5px",
          border: "1px solid #ccc"
        }}
      />

      <button 
        onClick={addPlayer} 
        disabled={!selectedTeam}
        style={{ width: "100%", padding: "10px", background: "#2146d0", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}
      >
        ➕ Spieler hinzufügen
      </button>

      <hr style={{ margin: "20px 0", borderColor: "#eee" }} />

      {(players[selectedTeam] || []).length === 0 ? (
        <p style={{ color: "#777", fontSize: "14px" }}>Noch keine Spieler in dieser Mannschaft.</p>
      ) : (
        (players[selectedTeam] || []).map((player) => (
          <div
            key={player}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid #ddd",
              padding: "10px",
              marginTop: "5px",
              borderRadius: "5px",
              background: "white"
            }}
          >
            <span>{player}</span>

            <button 
              onClick={() => deletePlayer(player)} 
              style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "3px", padding: "5px 10px", cursor: "pointer" }}
            >
              ❌
            </button>
          </div>
        ))
      )}
    </div>
  );
}