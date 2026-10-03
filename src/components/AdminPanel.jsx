import { useState } from "react";
import TeamManager from "./TeamManager";
import PlayerManager from "./PlayerManager";
import Statistics from "./Statistics";

export default function AdminPanel({ teams, setTeams }) {
  const [tab, setTab] = useState("teams");

  return (
    <div>
      <button onClick={() => setTab("teams")}>Teams</button>
      <button onClick={() => setTab("players")}>Spieler</button>
      <button onClick={() => setTab("stats")}>Statistik</button>

      <div>
        {tab === "teams" && <TeamManager teams={teams} setTeams={setTeams} />}
        {tab === "players" && <PlayerManager />}
        {tab === "stats" && <Statistics />}
      </div>
    </div>
  );
}