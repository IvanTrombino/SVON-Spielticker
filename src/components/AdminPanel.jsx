import { useState, useEffect } from "react";
import TeamManager from "./TeamManager";
import PlayerManager from "./PlayerManager";
import Statistics from "./Statistics";

export default function AdminPanel({ clubId, teams, setTeams, userRole }) {
  // Wenn Trainer, starte direkt bei "players", ansonsten bei "teams"
  const [tab, setTab] = useState(userRole === "trainer" ? "players" : "teams");

  // Falls ein Trainer eingeloggt ist und versucht, "teams" aufzurufen, erzwinge "players"
  useEffect(() => {
    if (userRole === "trainer" && tab === "teams") {
      setTab("players");
    }
  }, [userRole, tab]);

  // Hilfsfunktion für schicke, dynamische Buttons
  const getButtonStyle = (currentTab) => ({
    flex: userRole === "trainer" ? "1 1 calc(50% - 8px)" : "1 1 calc(33% - 8px)",
    padding: "12px 5px",
    background: tab === currentTab ? "#2146d0" : "#e0e0e0",
    color: tab === currentTab ? "white" : "#333",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: tab === currentTab ? "0 4px 6px rgba(33, 70, 208, 0.3)" : "none",
    transition: "all 0.2s"
  });

  return (
    <div style={{ padding: "15px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif", textAlign: "center" }}>
      <h2 style={{ color: "#2146d0", marginBottom: "5px" }}>⚙ Administration</h2>
      <p style={{ color: "#666", fontSize: "12px", marginBottom: "20px" }}>Aktiver Verein: <strong>{clubId.toUpperCase()}</strong></p>

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
        {/* TEAMS: NUR FÜR ADMIN SICHTBAR */}
        {userRole === "admin" && (
          <button onClick={() => setTab("teams")} style={getButtonStyle("teams")}>
            👥 Teams
          </button>
        )}

        <button onClick={() => setTab("players")} style={getButtonStyle("players")}>
          👤 Spieler
        </button>

        <button onClick={() => setTab("stats")} style={getButtonStyle("stats")}>
          🏆 Statistik
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

        {tab === "stats" && (
          <Statistics clubId={clubId} teams={teams} />
        )}
      </div>
    </div>
  );
}