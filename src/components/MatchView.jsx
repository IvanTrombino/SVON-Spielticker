import { useEffect, useState } from "react";
import logo from "../assets/SVON-Wappen.png";

export default function MatchView() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");

  const [players, setPlayers] = useState({});
  const [selectedPlayer, setSelectedPlayer] = useState("");

  const [scorers, setScorers] = useState(() => {
    return JSON.parse(localStorage.getItem("svon_scorers")) || {};
  });

  useEffect(() => {
    const savedTeams = JSON.parse(localStorage.getItem("svon_teams")) || [];
    setTeams(savedTeams);

    if (savedTeams.length > 0) {
      setSelectedTeam(savedTeams[0]);
    }

    const savedPlayers = JSON.parse(localStorage.getItem("svon_players")) || {};
    setPlayers(savedPlayers);
  }, []);

  useEffect(() => {
    localStorage.setItem("svon_scorers", JSON.stringify(scorers));
  }, [scorers]);

  const addGoal = () => {
    if (!selectedTeam || !selectedPlayer) return;

    const teamScorers = scorers[selectedTeam] || {};
    const currentGoals = teamScorers[selectedPlayer] || 0;

    setScorers({
      ...scorers,
      [selectedTeam]: {
        ...teamScorers,
        [selectedPlayer]: currentGoals + 1,
      },
    });
  };

  return (
    <div
      style={{
        padding: "20px",
        textAlign: "center",
      }}
    >
      {/* Korrekte Einbindung des Logos */}
      <img src={logo} alt="SVON Logo" style={{ maxWidth: "150px" }} />

      <h1
        style={{
          color: "#2146d0",
        }}
      >
        ⚽ SVON Spielticker
      </h1>

      <h2>Tore erfassen</h2>

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

      <br />
      <br />

      <select
        value={selectedPlayer}
        onChange={(e) => setSelectedPlayer(e.target.value)}
      >
        <option value="">Spieler wählen</option>

        {(players[selectedTeam] || []).map((player) => (
          <option key={player} value={player}>
            {player}
          </option>
        ))}
      </select>

      <br />
      <br />

      <button onClick={addGoal}>⚽ Tor hinzufügen</button>

      <hr />

      <h3>Aktuelle Torschützen</h3>

      {Object.entries(scorers[selectedTeam] || {}).map(([player, goals]) => (
        <div key={player}>
          {player}: <strong>{goals}</strong>
        </div>
      ))}
    </div>
  );
}