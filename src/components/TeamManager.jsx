import { useState } from "react";
 
export default function TeamManager({
teams,
setTeams,
}) {
const [newTeam, setNewTeam] =
useState("");
 
const addTeam = () => {
if (!newTeam.trim()) return;
 
if (teams.includes(newTeam)) return;
 
const updatedTeams = [...teams, newTeam];
 
setTeams(updatedTeams);
 
localStorage.setItem(
"svon_teams",
JSON.stringify(updatedTeams)
);
 
setNewTeam("");
};
 
const deleteTeam = (team) => {
setTeams(
teams.filter((t) => t !== team)
);
};
 
return (
<div>
<h2>👥 Mannschaftsverwaltung</h2>
 
<div
style={{
display: "flex",
gap: "10px",
marginBottom: "20px",
}}
>
<input
value={newTeam}
onChange={(e) =>
setNewTeam(e.target.value)
}
placeholder="Neue Mannschaft"
style={{
flex: 1,
padding: "10px",
}}
/>
 
<button onClick={addTeam}>
➕
</button>
</div>
 
{teams.map((team) => (
<div
key={team}
style={{
display: "flex",
justifyContent:
"space-between",
alignItems: "center",
border: "1px solid #ddd",
borderRadius: "10px",
padding: "10px",
marginBottom: "8px",
}}
>
<span>{team}</span>
 
<button
onClick={() =>
deleteTeam(team)
}
>
❌
</button>
</div>
))}
</div>
);
}