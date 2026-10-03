import { useEffect, useState } from "react";
import AdminPanel from "./components/AdminPanel";
import MatchView from "./components/MatchView";
 
export default function App() {
const [view, setView] = useState("match");
 
const [teams, setTeams] = useState(() => {
const saved = localStorage.getItem("svon_teams");
return saved ? JSON.parse(saved) : [];
});
 
useEffect(() => {
localStorage.setItem(
"svon_teams",
JSON.stringify(teams)
);
}, [teams]);
 
return (
<div>
<div
style={{
display: "flex",
justifyContent: "center",
gap: "10px",
padding: "15px",
background: "#2146d0",
}}
>
<button
onClick={() => setView("match")}
style={{
padding: "10px 15px",
borderRadius: "8px",
border: 0,
}}
>
⚽ Spiel
</button>
 
<button
onClick={() => setView("admin")}
style={{
padding: "10px 15px",
borderRadius: "8px",
border: 0,
}}
>
⚙ Administration
</button>
</div>
 
{view === "match" ? (
<MatchView teams={teams} />
) : (
<AdminPanel
teams={teams}
setTeams={setTeams}
/>
)}
</div>
);
}