import { useState } from "react";
import TeamManager from "./TeamManager";
import PlayerManager from "./PlayerManager";
import Statistics from "./Statistics";

export default function AdminPanel({ teams, setTeams }) {
  const [tab, setTab] = useState("teams");

  // Hilfsfunktion für schicke, dynamische Buttons
  const getButtonStyle = (currentTab) => ({
    flex: "1 1 calc(33% - 8px)", // Die Buttons teilen sich den Platz auf
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
      <h2 style={{ color: "#2146d0", marginBottom: "20px" }}>⚙ Administration</h2>

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
        <button onClick={() => setTab("teams")} style={getButtonStyle("teams")}>
          👥 Teams
        </button>

        <button onClick={() => setTab("players")} style={getButtonStyle("players")}>
          👤 Spieler
        </button>

        <button onClick={() => setTab("stats")} style={getButtonStyle("stats")}>
          🏆 Statistik
        </button>
      </div>

      {/* --- INHALTSBEREICH --- */}
      <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
        {tab === "teams" && (
          <TeamManager teams={teams} setTeams={setTeams} />
        )}

        {tab === "players" && (
          <PlayerManager />
        )}

        {tab === "stats" && (
          <Statistics />
        )}
      </div>
    </div>
  );
}