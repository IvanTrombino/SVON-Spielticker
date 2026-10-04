import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function PlayerManager() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("1. Mannschaft");
  const [playerName, setPlayerName] = useState("");
  const [playersData, setPlayersData] = useState({});

  // Mehrfachauswahl States
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [targetTeam, setTargetTeam] = useState("");

  // --- NEU: States für die Namens-Bearbeitung ---
  const [editingPlayer, setEditingPlayer] = useState(null); // Welcher Spieler wird bearbeitet?
  const [editedName, setEditedName] = useState(""); // Der neue Text im Eingabefeld

  // Feste Vereins-Hierarchie für die Team-Sortierung
  const sortTeams = (teamList) => {
    const customOrder = [
      "1. Mannschaft", 
      "2. Mannschaft", 
      "3. Mannschaft", 
      "Damen",
      "A-Jugend", 
      "B-Jugend", 
      "C-Jugend", 
      "D-Jugend", 
      "E-Jugend",
      "E-Jugend Funino", 
      "F-Jugend", 
      "F-Jugend Funino", 
      "G-Jugend"
    ];

    return [...teamList].sort((a, b) => {
      const indexA = customOrder.indexOf(a);
      const indexB = customOrder.indexOf(b);
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  };

  // 1. Teams aus Firebase laden und sortieren
  useEffect(() => {
    const unsubTeams = onSnapshot(doc(db, "ticker", "teams"), (docSnap) => {
      if (docSnap.exists()) {
        const teamsList = docSnap.data().teamsList || [];
        const sorted = sortTeams(teamsList);
        setTeams(sorted);
        
        if (sorted.length > 0 && !sorted.includes(selectedTeam)) {
          setSelectedTeam(sorted[0]);
        }
      }
    });
    return () => unsubTeams();
  }, []);

  // 2. Zentrale Spieler-Daten aus der Cloud laden
  useEffect(() => {
    const unsubPlayers = onSnapshot(doc(db, "ticker", "players"), (docSnap) => {
      if (docSnap.exists()) {
        setPlayersData(docSnap.data() || {});
      } else {
        setPlayersData({});
      }
    });
    return () => unsubPlayers();
  }, []);

  const savePlayersToCloud = async (newPlayersObj) => {
    try {
      await setDoc(doc(db, "ticker", "players"), newPlayersObj);
    } catch (error) {
      console.error("Fehler beim Cloud-Speichern der Spieler:", error);
    }
  };

  const addPlayer = () => {
    if (!playerName.trim() || !selectedTeam) return;
    const trimmedName = playerName.trim();
    const currentList = playersData[selectedTeam] || [];
    
    if (currentList.includes(trimmedName)) {
      alert("Dieser Spieler existiert bereits in dieser Mannschaft!");
      return;
    }

    const updatedList = [...currentList, trimmedName].sort((a, b) => a.localeCompare(b));
    const newPlayersObj = {
      ...playersData,
      [selectedTeam]: updatedList
    };

    setPlayersData(newPlayersObj);
    savePlayersToCloud(newPlayersObj);
    setPlayerName("");
  };

  const deletePlayer = (playerToDelete) => {
    const currentList = playersData[selectedTeam] || [];
    const updatedList = currentList.filter((p) => p !== playerToDelete);
    const newPlayersObj = {
      ...playersData,
      [selectedTeam]: updatedList
    };

    setPlayersData(newPlayersObj);
    savePlayersToCloud(newPlayersObj);
  };

  // --- NEU: Spieler-Namen in der gesamten App aktualisieren ---
  const saveEditedPlayerName = (oldName) => {
    const newName = editedName.trim();
    if (!newName) {
      alert("Der Name darf nicht leer sein!");
      return;
    }
    if (oldName === newName) {
      setEditingPlayer(null);
      return;
    }

    // Gehe alle Mannschaften in playersData durch und ersetze den Namen überall
    const updatedPlayersData = { ...playersData };

    Object.keys(updatedPlayersData).forEach((teamKey) => {
      const teamList = updatedPlayersData[teamKey] || [];
      if (teamList.includes(oldName)) {
        // Alten Namen raus, neuen Namen rein & alphabetisch sortieren
        const filtered = teamList.filter((p) => p !== oldName);
        if (!filtered.includes(newName)) {
          filtered.push(newName);
        }
        filtered.sort((a, b) => a.localeCompare(b));
        updatedPlayersData[teamKey] = filtered;
      }
    });

    setPlayersData(updatedPlayersData);
    savePlayersToCloud(updatedPlayersData);
    setEditingPlayer(null);
    setEditedName("");
  };

  // Mehrfachauswahl Logik
  const toggleSelectPlayer = (player) => {
    if (selectedPlayers.includes(player)) {
      setSelectedPlayers(selectedPlayers.filter(p => p !== player));
    } else {
      setSelectedPlayers([...selectedPlayers, player]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedPlayers.length === currentTeamPlayers.length) {
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers([...currentTeamPlayers]);
    }
  };

  const copySelectedPlayers = () => {
    if (!targetTeam) {
      alert("Bitte wähle eine Ziel-Mannschaft aus.");
      return;
    }
    if (selectedPlayers.length === 0) {
      alert("Du hast keine Spieler ausgewählt.");
      return;
    }

    const targetList = [...(playersData[targetTeam] || [])];
    let addedCount = 0;

    selectedPlayers.forEach(player => {
      if (!targetList.includes(player)) {
        targetList.push(player);
        addedCount++;
      }
    });

    targetList.sort((a, b) => a.localeCompare(b));

    const newPlayersObj = {
      ...playersData,
      [targetTeam]: targetList
    };

    setPlayersData(newPlayersObj);
    savePlayersToCloud(newPlayersObj);

    setSelectedPlayers([]);
    setIsMultiSelectMode(false);
    alert(`${addedCount} Spieler wurden erfolgreich zur "${targetTeam}" kopiert!`);
  };

  const currentTeamPlayers = [...(playersData[selectedTeam] || [])].sort((a, b) => 
    a.localeCompare(b)
  );

  const otherTeams = teams.filter((t) => t !== selectedTeam);

  return (
    <div style={{ padding: "15px", maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ color: "#2146d0", marginBottom: "20px" }}>👤 Spielerverwaltung</h2>

      <select
        value={selectedTeam}
        onChange={(e) => {
          setSelectedTeam(e.target.value);
          setSelectedPlayers([]);
          setIsMultiSelectMode(false);
          setEditingPlayer(null);
        }}
        style={{ padding: "10px", width: "100%", marginBottom: "15px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "15px", background: "#f8f9fa" }}
      >
        {!teams.includes("1. Mannschaft") && <option value="1. Mannschaft">1. Mannschaft</option>}
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

      {currentTeamPlayers.length > 0 && (
        <div style={{ marginBottom: "15px", background: "#eef2ff", padding: "10px", borderRadius: "8px", border: "1px solid #c7d2fe" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                setSelectedPlayers([]);
              }}
              style={{ background: isMultiSelectMode ? "#4f46e5" : "#e0e7ff", color: isMultiSelectMode ? "white" : "#3730a3", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
            >
              {isMultiSelectMode ? "✖ Mehrfachauswahl beenden" : "☑ Mehrfachauswahl (Gruppen-Kopie)"}
            </button>

            {isMultiSelectMode && (
              <button
                onClick={toggleSelectAll}
                style={{ background: "transparent", border: "none", color: "#4f46e5", cursor: "pointer", fontSize: "13px", fontWeight: "bold", textDecoration: "underline" }}
              >
                {selectedPlayers.length === currentTeamPlayers.length ? "Keine auswählen" : "Alle auswählen"}
              </button>
            )}
          </div>

          {isMultiSelectMode && (
            <div style={{ marginTop: "10px", display: "flex", gap: "8px", alignItems: "center", borderTop: "1px solid #c7d2fe", paddingTop: "10px" }}>
              <select
                value={targetTeam}
                onChange={(e) => setTargetTeam(e.target.value)}
                style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", background: "white" }}
              >
                <option value="">-- Ziel-Mannschaft wählen --</option>
                {otherTeams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <button
                onClick={copySelectedPlayers}
                disabled={selectedPlayers.length === 0 || !targetTeam}
                style={{ background: selectedPlayers.length > 0 && targetTeam ? "#27ae60" : "#95a3a6", color: "white", border: "none", borderRadius: "6px", padding: "8px 12px", cursor: selectedPlayers.length > 0 && targetTeam ? "pointer" : "not-allowed", fontWeight: "bold", fontSize: "13px" }}
              >
                📋 ({selectedPlayers.length}) kopieren
              </button>
            </div>
          )}
        </div>
      )}

      <hr style={{ margin: "20px 0", borderColor: "#eee" }} />

      {currentTeamPlayers.length === 0 ? (
        <p style={{ color: "#777", fontSize: "14px", textAlign: "center" }}>Noch keine Spieler in dieser Mannschaft.</p>
      ) : (
        currentTeamPlayers.map((player) => {
          const isSelected = selectedPlayers.includes(player);
          const isEditing = editingPlayer === player;

          return (
            <div
              key={player}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: isMultiSelectMode && isSelected ? "1px solid #4f46e5" : "1px solid #ddd",
                padding: "10px 15px",
                marginTop: "8px",
                borderRadius: "8px",
                background: isMultiSelectMode && isSelected ? "#eef2ff" : "white",
                boxShadow: "0 2px 4px rgba(0,0,0,0.03)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                {isMultiSelectMode && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectPlayer(player)}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                )}

                {/* --- BEARBEITUNGS-MODUS ODER NORMALER TEXT --- */}
                {isEditing ? (
                  <div style={{ display: "flex", gap: "6px", flex: 1, marginRight: "10px" }}>
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      style={{ flex: 1, padding: "5px", borderRadius: "4px", border: "1px solid #2980b9", fontSize: "14px" }}
                      autoFocus
                    />
                    <button
                      onClick={() => saveEditedPlayerName(player)}
                      style={{ background: "#27ae60", color: "white", border: "none", borderRadius: "4px", padding: "5px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}
                    >
                      Speichern
                    </button>
                    <button
                      onClick={() => setEditingPlayer(null)}
                      style={{ background: "#95a3a6", color: "white", border: "none", borderRadius: "4px", padding: "5px 8px", cursor: "pointer", fontSize: "12px" }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <span style={{ fontWeight: "bold" }}>{player}</span>
                )}
              </div>

              {/* Aktions-Buttons (Bearbeiten & Löschen) */}
              {!isEditing && (
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => {
                      setEditingPlayer(player);
                      setEditedName(player);
                    }}
                    title="Spieler umbenennen"
                    style={{ background: "#f39c12", color: "white", border: "none", borderRadius: "5px", padding: "6px 10px", cursor: "pointer" }}
                  >
                    ✏️
                  </button>

                  <button 
                    onClick={() => deletePlayer(player)} 
                    title="Spieler löschen"
                    style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "5px", padding: "6px 10px", cursor: "pointer" }}
                  >
                    ❌
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}