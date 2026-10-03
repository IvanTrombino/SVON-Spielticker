import { useState } from "react";
 
export default function TeamManager() {
const [teams, setTeams] = useState([]);
const [teamName, setTeamName] = useState("");
 
return (
<>
<h2>Mannschaften</h2>
 
<input
value={teamName}
onChange={(e) => setTeamName(e.target.value)}
placeholder="Neue Mannschaft"
/>
 
<button
onClick={() => {
if (teamName) {
setTeams([...teams, teamName]);
setTeamName("");
}
}}
>
➕ Hinzufügen
</button>
 
{teams.map((team) => (
<div
key={team}
style={{
border: "1px solid #ddd",
padding: "10px",
marginTop: "5px",
}}
>
{team}
</div>
))}
</>
);
}