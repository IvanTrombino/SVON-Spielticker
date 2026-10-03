import { useState, useEffect } from "react";
 
export default function Statistics() {
const [scorers, setScorers] = useState({});
const [teams, setTeams] = useState([]);
const [selectedTeam, setSelectedTeam] = useState("");
 
useEffect(() => {
const savedScorers =
JSON.parse(
localStorage.getItem("svon_scorers")
) || {};
 
setScorers(savedScorers);
 
const savedTeams =
JSON.parse(
localStorage.getItem("svon_teams")
) || [];
 
setTeams(savedTeams);
 
if (savedTeams.length > 0) {
setSelectedTeam(savedTeams[0]);
}
}, []);
 
return (
<div>
<h2>🏆 Torschützenstatistik</h2>
 
<select
value={selectedTeam}
onChange={(e) =>
setSelectedTeam(e.target.value)
}
>
{teams.map((team) => (
<option
key={team}
value={team}
>
{team}
</option>
))}
</select>
 
<hr />
 
{Object.entries(
scorers[selectedTeam] || {}
).map(([player, goals]) => (
<div
key={player}
style={{
display: "flex",
justifyContent:
"space-between",
border: "1px solid #ddd",
padding: "8px",
marginTop: "5px",
}}
>
<span>{player}</span>
<strong>{goals}</strong>
</div>
))}
</div>
);
}