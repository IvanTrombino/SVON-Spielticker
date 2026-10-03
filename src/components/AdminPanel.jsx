import { useState } from "react";
import TeamManager from "./TeamManager";
import PlayerManager from "./PlayerManager";
import Statistics from "./Statistics";
 
export default function AdminPanel({
teams,
setTeams,
}) {
const [tab, setTab] = useState("teams");
 
return (
<div style={{ padding: "20px" }}>
<h1>⚙ Administration</h1>
 
<div
style={{
display: "flex",
gap: "10px",
flexWrap: "wrap",
marginBottom: "20px",
}}
>
<button onClick={() => setTab("teams")}>
👥 Mannschaften
</button>
 
<button onClick={() => setTab("players")}>
👤 Spieler
</button>
 
<button onClick={() => setTab("stats")}>
🏆 Statistik
</button>
</div>
 
{tab === "teams" && (
<TeamManager
teams={teams}
setTeams={setTeams}
/>
)}
 
{tab === "players" && (
<PlayerManager />
)}
 
{tab === "stats" && (
<Statistics />
)}
</div>
);
}