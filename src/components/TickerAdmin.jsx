import { useState } from "react";
import PlayerManager from "./PlayerManager";
import Statistics from "./Statistics";
import TeamManager from "./TeamManager";

// Live-Ticker-Verwaltung: Spieler & Spielstatistik, Mannschaften nur für Admins
export default function TickerAdmin({ clubId, teams, canManageTeams = false }) {
  const [tab, setTab] = useState("players");

  const tabs = [
    { id: "players", label: "👤 Spieler" },
    { id: "stats", label: "🏆 Spielstatistik" },
    ...(canManageTeams ? [{ id: "teams", label: "👥 Teams" }] : [])
  ];

  return (
    <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "15px", flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "10px", border: "none", borderRadius: "8px", background: tab === t.id ? "#2146d0" : "#e0e7ff", color: tab === t.id ? "white" : "#3730a3", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "teams" && canManageTeams && <TeamManager clubId={clubId} />}

      {tab !== "teams" && (teams.length === 0 ? (
        <p style={{ color: "#777", textAlign: "center", margin: "20px 0" }}>Für deine Mannschaften gibt es noch kein Team im Live-Ticker.</p>
      ) : (
        <>
          {tab === "players" && <PlayerManager clubId={clubId} teams={teams} />}
          {tab === "stats" && <Statistics clubId={clubId} teams={teams} />}
        </>
      ))}
    </div>
  );
}
