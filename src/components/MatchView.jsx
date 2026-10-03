import { useState, useEffect } from "react";
import logo from "../assets/SVON-Wappen.png";

export default function MatchView() {
  // --- STATE: TEAMS & SPIELER (aus Spielerverwaltung) ---
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState({});
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [scorers, setScorers] = useState(() => JSON.parse(localStorage.getItem("svon_scorers")) || {});

  // --- STATE: AKTUELL LÄUFENDES SPIEL (mit Auto-Save) ---
  const [homeTeam, setHomeTeam] = useState(() => localStorage.getItem("ticker_home") || "SVON");
  const [awayTeam, setAwayTeam] = useState(() => localStorage.getItem("ticker_away") || "Gast");
  const [homeGoals, setHomeGoals] = useState(() => Number(localStorage.getItem("ticker_homeG")) || 0);
  const [awayGoals, setAwayGoals] = useState(() => Number(localStorage.getItem("ticker_awayG")) || 0);
  
  const [time, setTime] = useState(() => Number(localStorage.getItem("ticker_time")) || 0);
  const [isRunning, setIsRunning] = useState(false);
  
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("ticker_history")) || []);

  // --- STATE: GESPEICHERTE SPIELE (Letzte Spiele) ---
  const [savedMatches, setSavedMatches] = useState(() => JSON.parse(localStorage.getItem("svon_matches")) || []);

  // Daten beim Start laden
  useEffect(() => {
    const savedTeams = JSON.parse(localStorage.getItem("svon_teams")) || [];
    setTeams(savedTeams);
    if (savedTeams.length > 0 && !localStorage.getItem("ticker_home")) {
      setHomeTeam(savedTeams[0]); // Standardmäßig erstes Team wählen
    }
    const savedPlayers = JSON.parse(localStorage.getItem("svon_players")) || {};
    setPlayers(savedPlayers);
  }, []);

  // Spieldaten fortlaufend speichern (Wiederherstellung)
  useEffect(() => {
    localStorage.setItem("ticker_home", homeTeam);
    localStorage.setItem("ticker_away", awayTeam);
    localStorage.setItem("ticker_homeG", homeGoals);
    localStorage.setItem("ticker_awayG", awayGoals);
    localStorage.setItem("ticker_time", time);
    localStorage.setItem("ticker_history", JSON.stringify(history));
    localStorage.setItem("svon_scorers", JSON.stringify(scorers));
    localStorage.setItem("svon_matches", JSON.stringify(savedMatches));
  }, [homeTeam, awayTeam, homeGoals, awayGoals, time, history, scorers, savedMatches]);

  // Spieluhr
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => setTime((prev) => prev + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const availablePlayers = players[homeTeam] || [];

  // --- AKTIONEN: TORE & KARTEN ---
  const addEvent = (team, type) => {
    const isHome = team === "home";
    const playerName = (isHome && selectedPlayer) ? selectedPlayer : (isHome ? "Unbekannt" : "Gegner");
    const minute = Math.floor(time / 60) + 1;

    const newEvent = { id: Date.now(), team, type, player: playerName, minute };
    
    if (type === "goal") {
      if (isHome) {
        setHomeGoals((prev) => prev + 1);
        if (selectedPlayer) {
          const teamScorers = scorers[homeTeam] || {};
          const pGoals = teamScorers[selectedPlayer] || 0;
          setScorers({ ...scorers, [homeTeam]: { ...teamScorers, [selectedPlayer]: pGoals + 1 } });
        }
      } else {
        setAwayGoals((prev) => prev + 1);
      }
    }
    setHistory([...history, newEvent]);
    setSelectedPlayer("");
  };

  const undoLastEvent = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const lastEvent = newHistory.pop();

    if (lastEvent.type === "goal") {
      if (lastEvent.team === "home") {
        setHomeGoals((prev) => prev - 1);
        if (lastEvent.player !== "Unbekannt") {
          const teamScorers = scorers[homeTeam] || {};
          const pGoals = teamScorers[lastEvent.player] || 0;
          setScorers({ ...scorers, [homeTeam]: { ...teamScorers, [lastEvent.player]: Math.max(0, pGoals - 1) } });
        }
      } else {
        setAwayGoals((prev) => prev - 1);
      }
    }
    setHistory(newHistory);
  };

  // --- SPIEL BEENDEN & SPEICHERN ---
  const finishMatch = () => {
    if (window.confirm("Spiel beenden und in 'Letzte Spiele' speichern?")) {
      const newMatch = {
        id: Date.now(),
        date: new Date().toLocaleDateString("de-DE"),
        homeTeam,
        awayTeam,
        homeGoals,
        awayGoals,
        history
      };
      
      setSavedMatches([newMatch, ...savedMatches]); // Oben hinzufügen
      
      // Ticker zurücksetzen
      setHomeGoals(0);
      setAwayGoals(0);
      setTime(0);
      setIsRunning(false);
      setHistory([]);
      setSelectedPlayer("");
    }
  };

  // Spiel abbrechen ohne zu speichern
  const resetGame = () => {
    if (window.confirm("Aktuelles Spiel wirklich verwerfen?")) {
      setHomeGoals(0);
      setAwayGoals(0);
      setTime(0);
      setIsRunning(false);
      setHistory([]);
      setSelectedPlayer("");
    }
  };

  const getEventIcon = (type) => {
    if (type === "goal") return "⚽";
    if (type === "yellow") return "🟨";
    if (type === "red") return "🟥";
    return "📝";
  };

  // Drucken (PDF generieren)
  const generatePDF = () => {
    window.print();
  };

  return (
    <div style={{ padding: "20px", textAlign: "center", fontFamily: "sans-serif", maxWidth: "700px", margin: "0 auto" }}>
      {/* CSS, um Buttons beim Drucken als PDF auszublenden */}
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            body { background: white; }
          }
        `}
      </style>

      <img src={logo} alt="SVON Logo" style={{ maxWidth: "80px", marginBottom: "10px" }} />
      <h2 style={{ color: "#2146d0", margin: "0 0 20px 0" }}>⚽ Live-Ticker & Spielbericht</h2>

      {/* --- SPIEL BEREICH --- */}
      <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "10px", border: "1px solid #ddd" }}>
        
        {/* Team-Auswahl */}
        <div className="no-print" style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "15px" }}>
          <select value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} style={{ padding: "8px", width: "40%" }}>
            {teams.length === 0 && <option value="SVON">SVON</option>}
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span style={{ alignSelf: "center", fontWeight: "bold" }}>vs</span>
          <input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} placeholder="Gastteam" style={{ padding: "8px", width: "40%", textAlign: "center" }} />
        </div>

        {/* Druck-Ansicht Teamnamen */}
        <div style={{ display: "none" }} className="print-only">
           <h3>{homeTeam} vs {awayTeam}</h3>
        </div>

        {/* Spielstand */}
        <div style={{ fontSize: "64px", fontWeight: "bold", margin: "10px 0" }}>
          {homeGoals} : {awayGoals}
        </div>

        {/* Spieluhr */}
        <div className="no-print" style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "32px", fontFamily: "monospace", marginBottom: "10px" }}>
            {formatTime(time)}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
            <button onClick={() => setIsRunning(!isRunning)} style={{ padding: "10px 15px", backgroundColor: isRunning ? "#e74c3c" : "#2ecc71", color: "white", border: "none", borderRadius: "5px" }}>
              {isRunning ? "⏸ Pause" : "▶️ Start"}
            </button>
            <button onClick={() => { setIsRunning(false); setTime(45 * 60); }} style={{ padding: "10px 15px", backgroundColor: "#f39c12", color: "white", border: "none", borderRadius: "5px" }}>
              ⏱ Halbzeit
            </button>
          </div>
        </div>

        <hr className="no-print" style={{ margin: "20px 0" }} />

        {/* Ereignis erfassen */}
        <div className="no-print">
          <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)} style={{ padding: "10px", width: "80%", marginBottom: "15px" }}>
            <option value="">-- {homeTeam} Spieler wählen --</option>
            {availablePlayers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
            <button onClick={() => addEvent("home", "goal")} style={{ padding: "10px", background: "#2146d0", color: "white", border: "none", borderRadius: "5px" }}>⚽ Tor Heim</button>
            <button onClick={() => addEvent("away", "goal")} style={{ padding: "10px", background: "#333", color: "white", border: "none", borderRadius: "5px" }}>⚽ Tor Gast</button>
            <button onClick={() => addEvent("home", "yellow")} style={{ padding: "8px", background: "#f1c40f", border: "none", borderRadius: "5px" }}>🟨 Karte Heim</button>
            <button onClick={() => addEvent("away", "yellow")} style={{ padding: "8px", background: "#f1c40f", border: "none", borderRadius: "5px" }}>🟨 Karte Gast</button>
            <button onClick={() => addEvent("home", "red")} style={{ padding: "8px", background: "#e74c3c", color: "white", border: "none", borderRadius: "5px" }}>🟥 Karte Heim</button>
            <button onClick={() => addEvent("away", "red")} style={{ padding: "8px", background: "#e74c3c", color: "white", border: "none", borderRadius: "5px" }}>🟥 Karte Gast</button>
          </div>
        </div>

        {/* Admin Buttons */}
        <div className="no-print" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px" }}>
          <button onClick={undoLastEvent} disabled={history.length === 0} style={{ padding: "8px", backgroundColor: "#7f8c8d", color: "white", border: "none", borderRadius: "5px" }}>↩️ Zurück</button>
          <button onClick={finishMatch} style={{ padding: "8px", backgroundColor: "#27ae60", color: "white", border: "none", borderRadius: "5px", fontWeight: "bold" }}>💾 Spiel beenden & Speichern</button>
          <button onClick={resetGame} style={{ padding: "8px", backgroundColor: "#c0392b", color: "white", border: "none", borderRadius: "5px" }}>🗑️ Verwerfen</button>
          <button onClick={generatePDF} style={{ padding: "8px", backgroundColor: "#2980b9", color: "white", border: "none", borderRadius: "5px" }}>🖨️ PDF / Drucken</button>
        </div>

        <hr style={{ margin: "20px 0" }} />

        {/* Spielbericht Timeline */}
        <h3>📝 Spielbericht Timeline</h3>
        {history.length === 0 ? (
          <p style={{ color: "#777" }}>Noch keine Ereignisse.</p>
        ) : (
          <div style={{ textAlign: "left", padding: "10px", borderRadius: "8px", background: "white" }}>
            {[...history].reverse().map((event) => (
              <div key={event.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee", display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontWeight: "bold", width: "35px" }}>{event.minute}'</span>
                <span style={{ fontSize: "1.2rem" }}>{getEventIcon(event.type)}</span>
                <span><strong>{event.team === "home" ? homeTeam : awayTeam}</strong>: {event.player}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- TABELLE: LETZTE SPIELE --- */}
      <div className="no-print" style={{ marginTop: "40px" }}>
        <h3>🏆 Letzte Spiele</h3>
        {savedMatches.length === 0 ? (
          <p>Noch keine Spiele gespeichert.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
            <thead>
              <tr style={{ background: "#2146d0", color: "white" }}>
                <th style={{ padding: "10px" }}>Datum</th>
                <th style={{ padding: "10px" }}>Begegnung</th>
                <th style={{ padding: "10px" }}>Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {savedMatches.map((match) => (
                <tr key={match.id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "10px" }}>{match.date}</td>
                  <td style={{ padding: "10px" }}>{match.homeTeam} vs {match.awayTeam}</td>
                  <td style={{ padding: "10px", fontWeight: "bold", fontSize: "18px" }}>
                    {match.homeGoals} : {match.awayGoals}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}