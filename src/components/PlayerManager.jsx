import { useState, useEffect } from "react";
 
export default function PlayerManager() {
const [teams, setTeams] = useState([]);
const [selectedTeam, setSelectedTeam] = useState("");
 
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
onChange={(e) =>
setSelectedTeam(e.target.value)
}
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
</div>
);
}