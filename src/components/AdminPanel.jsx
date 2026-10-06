import { useState, useEffect } from "react";
import TeamManager from "./TeamManager";
import PlayerManager from "./PlayerManager";
import Statistics from "./Statistics";
import YouthAdminPage from "./YouthAdminPage";
import PitchManager from "./PitchManager"; // <-- 1. NEU: Import für die Platzbelegung

export default function AdminPanel({ clubId, teams, setTeams, userRole }) {
  // Start-Reiter: Für Trainer "players", für Admins "teams"
  const [tab, setTab] = useState(userRole === "trainer" ? "players" : "teams");

  useEffect(() => {
    // Falls ein Trainer auf einen Admin-Reiter wechselt, abfangen
    if (userRole === "trainer" && (tab === "teams" || tab === "youth")) {
      setTab("players");
    }
  }, [userRole, tab]);

  // Dynamische Button-Styles je nach Anzahl der sichtbaren Tabs
  const getButtonStyle = (currentTab) => {
    // <-- 2. NEU: Die Anzahl der Buttons um 1 erhöht, damit das Design nicht zerschossen wird
    const totalButtons = userRole === "admin" ? 5 : 3; 
    return {
      flex: `1 1 calc(${100 / totalButtons}% - 8px)`,
      padding: "12px 5px",
      background: tab === currentTab ? "#2146d0" : "#e0e0e0",
      color: tab === currentTab ? "white" : "#333",
      border: "none",
      borderRadius: "8px",
      fontSize: "13px",
      fontWeight: "bold",
      cursor: "pointer",
      boxShadow: tab === currentTab ? "0 4px 6px rgba(33, 70, 208, 0.3)" : "none",
      transition: "all 0.2s"
    };
  };

  return (
    <div style={{ padding: "15px", maxWidth: "650px", margin: "0 auto", fontFamily: "sans-serif", textAlign: "center" }}>
      <h2 style={{ color: "#2146d0", marginBottom: "5px" }}>⚙ Administration</h2>
      <p style={{ color: "#666", fontSize: "12px", marginBottom: "20px" }}>
        Aktiver Verein: <strong>{clubId.toUpperCase()}</strong> | Rolle: <strong>{userRole?.toUpperCase()}</strong>
      </p>

      {/* --- NAVIGATION --- */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "25px",
          justifyContent: "center"
        }}
      >
        {/* NUR FÜR ADMIN */}
        {userRole === "admin" && (
          <>
            <button onClick={() => setTab("teams")} style={getButtonStyle("teams")}>
              👥 Teams
            </button>
            <button onClick={() => setTab("youth")} style={getButtonStyle("youth")}>
              👦 Jugend
            </button>
          </>
        )}

        <button onClick={() => setTab("players")} style={getButtonStyle("players")}>
          👤 Spieler
        </button>

        <button onClick={() => setTab("stats")} style={getButtonStyle("stats")}>
          🏆 Statistik
        </button>

        {/* <-- 3. NEU: PLATZBELEGUNG BUTTON FÜR ALLE TRAINER & ADMINS */}
        <button onClick={() => setTab("pitches")} style={getButtonStyle("pitches")}>
          🏟 Plätze
        </button>
      </div>

      {/* --- INHALTSBEREICH --- */}
      <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
        {tab === "teams" && userRole === "admin" && (
          <TeamManager clubId={clubId} teams={teams} setTeams={setTeams} />
        )}

        {tab === "players" && (
          <PlayerManager clubId={clubId} teams={teams} />
        )}

        {tab === "youth" && userRole === "admin" && (
          <YouthAdminPage clubId={clubId} />
        )}

        {tab === "stats" && (
          <Statistics clubId={clubId} teams={teams} />
        )}

        {/* <-- 4. NEU: PLATZBELEGUNG MODUL RENDERN */}
        {tab === "pitches" && (
          <PitchManager clubId={clubId} teams={teams} />
        )}
      </div>
    </div>
  );
}