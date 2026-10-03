import { useState, useEffect } from "react";
 
export default function PlayerManager() {
const [teams, setTeams] = useState([]);
const [selectedTeam, setSelectedTeam] = useState("");
const [playerName, setPlayerName] = useState("");
const [players, setPlayers] = useState([]);
 
useEffect(() => {
const savedTeams =
JSON.parse(localStorage.getItem("svon_teams")) || [];
 
setTeams(savedTeams);
 
if (savedTeams.length > 0) {
setSelectedTeam(savedTeams[0]);
}
}, []);
 
return (
<div>
<h2>👤 Spielerverwaltung</h2>
 
<select
value={selectedTeam}
onChange={(e) => setSelectedTeam(e.target.value)}
>
{teams.map((team) => (
<option key={team} value={team}>
{team}
</option>
))}
</select>
 
<p>
Mannschaft:
<strong> {selectedTeam}</strong>
</p>
 
<input
value={playerName}
onChange={(e) => setPlayerName(e.target.value)}
placeholder="Spielername"
style={{
width: "100%",
padding: "10px",
marginTop: "10px",
}}
/>
 
<button
onClick={() => {
if (!playerName.trim()) return;
 
setPlayers([...players, playerName]);
setPlayerName("");
}}
>
➕ Spieler hinzufügen
</button>
 
<hr />
 
{players.map((player) => (
<div
key={player}
style={{
display: "flex",
justifyContent: "space-between",
border: "1px solid #ddd",
padding: "8px",
marginTop: "5px",
}}
>
<span>{player}</span>
 
<button
onClick={() =>
setPlayers(
players.filter((p) => p !== player)
)
}
>
❌
</button>
</div>
))}
</div>
);
}