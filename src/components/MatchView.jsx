import { useState, useEffect } from "react";
import logo from "../assets/SVON-Wappen.png";

export default function MatchView() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState({});
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [scorers, setScorers] = useState(() => JSON.parse(localStorage.getItem("svon_scorers")) || {});

  const [isSvonAway, setIsSvonAway] = useState(() => localStorage.getItem("ticker_isAway") === "true");
  const [homeTeam, setHomeTeam] = useState(() => localStorage.getItem("ticker_home") || "SVON");
  const [awayTeam, setAwayTeam] = useState(() => localStorage.getItem("ticker_away") || "Gast");
  const [homeGoals, setHomeGoals] = useState(() => Number(localStorage.getItem("ticker_homeG")) || 0);
  const [awayGoals, setAwayGoals] = useState(() => Number(localStorage.getItem("ticker_awayG")) || 0);
  
  const [time, setTime] = useState(() => Number(localStorage.getItem("ticker_time")) || 0);
  const [isRunning, setIsRunning] = useState(false);
  
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("ticker_history")) || []);
  const [savedMatches, setSavedMatches] = useState(() => JSON.parse(localStorage.getItem("svon_matches")) || []);

  useEffect(() => {
    const savedTeams = JSON.parse(localStorage.getItem("svon_teams")) || [];
    setTeams(savedTeams);
    if (savedTeams.length > 0 && !localStorage.getItem("ticker_home") && !localStorage.getItem("ticker_away")) {
      setHomeTeam(savedTeams[0]);
    }
    const savedPlayers = JSON.parse(localStorage.getItem("svon_players")) || {};
    setPlayers(savedPlayers);
  }, []);

  useEffect(() => {
    localStorage.setItem("ticker_isAway", isSvonAway);
    localStorage.setItem("ticker_home", homeTeam);
    localStorage.setItem("ticker_away", awayTeam);
    localStorage.setItem("ticker_homeG", homeGoals);
    localStorage.setItem("ticker_awayG", awayGoals);
    localStorage.setItem("ticker_time", time);
    localStorage.setItem("ticker_history", JSON.stringify(history));
    localStorage.setItem("svon_scorers", JSON.stringify(scorers));
    localStorage.setItem("svon_matches", JSON.stringify(savedMatches));
  }, [isSvonAway, homeTeam, awayTeam, homeGoals, awayGoals, time, history, scorers, savedMatches]);

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

  const ourTeamName = isSvonAway ? awayTeam : homeTeam;
  const availablePlayers = players[ourTeamName] || [];

  const toggleHomeAway = () => {
    if (history.length > 0) {
      if (!window.confirm("Spiel läuft bereits! Heimrecht trotzdem tauschen? (Tore werden mitgetauscht)")) {
        return;
      }
    }
    setIsSvonAway(!isSvonAway);
    setHomeTeam(awayTeam);
    setAwayTeam(homeTeam);
    setHomeGoals(awayGoals);
    setAwayGoals(homeGoals);
  };

  const addEvent = (team, type) => {
    const isHomeEvent = team === "home";
    const isOurEvent = isSvonAway ? !isHomeEvent : isHomeEvent;
    
    const playerName = (isOurEvent && selectedPlayer) ? selectedPlayer : (isOurEvent ? "Unbekannt" : "Gegner");
    const minute = Math.floor(time / 60) + 1;

    const newEvent = { id: Date.now(), team, type, player: playerName, minute };
    
    if (type === "goal") {
      if (isHomeEvent) {
        setHomeGoals((prev) => prev + 1);
      } else {
        setAwayGoals((prev) => prev + 1);
      }
      
      if (isOurEvent && selectedPlayer) {
        const teamScorers = scorers[ourTeamName] || {};
        const pGoals = teamScorers[selectedPlayer] || 0;
        setScorers({ ...scorers, [ourTeamName]: { ...teamScorers, [selectedPlayer]: pGoals + 1 } });
      }
    }
    setHistory([...history, newEvent]);
    setSelectedPlayer("");
  };

  const undoLastEvent = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const lastEvent = newHistory.pop();

    const isHomeEvent = lastEvent.team === "home";
    const isOurEvent = isSvonAway ? !isHomeEvent : isHomeEvent;

    if (lastEvent.type === "goal") {
      if (isHomeEvent) setHomeGoals((prev) => Math.max(0, prev - 1));
      else setAwayGoals((prev) => Math.max(0, prev - 1));

      if (isOurEvent && lastEvent.player !== "Unbekannt" && lastEvent.player !== "Gegner") {
        const teamScorers = scorers[ourTeamName] || {};
        const pGoals = teamScorers[lastEvent.player] || 0;
        setScorers({ ...scorers, [ourTeamName]: { ...teamScorers, [lastEvent.player]: Math.max(0, pGoals - 1) } });
      }
    }
    setHistory(newHistory);
  };

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
      
      setSavedMatches([newMatch, ...savedMatches]);
      
      setHomeGoals(0);
      setAwayGoals(0);
      setTime(0);
      setIsRunning(false);
      setHistory([]);
      setSelectedPlayer("");
    }
  };

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

  const generatePDF = () => {
    window.print();
  };

  // Smartphone-optimierte Base-Styles für Inputs/Selects
  const inputStyle = {
    padding: "10px", 
    borderRadius: "8px", 
    border: "1px solid #ccc",
    width: "100%",
    boxSizing: "border-box",
    fontSize: "16px" // Wichtig: Verhindert Auto-Zoom auf iOS!
  };

  // Style für die Action-Buttons (Tore, Karten)
  const actionButtonStyle = {
    padding: "12px 8px", 
    border: "none", 
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "bold",
    color: "white",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
  };

  return (
    <div style={{ padding: "15px", textAlign: "center", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            body { background: white; }
          }
        `}
      </style>

      <img src={logo} alt="SVON Logo" style={{ maxWidth: "70px", marginBottom: "10px" }} />
      <h2 style={{ color: "#2146d0", margin: "0 0 15px 0", fontSize: "1.5rem" }}>⚽ Live-Ticker</h2>

      <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
        
        {/* Responsive Team-Auswahl */}
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "15px", width: "100%" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", textAlign: "left" }}>Heimteam</label>
            {!isSvonAway ? (
              <select value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} style={inputStyle}>
                {teams.length === 0 && <option value="SVON">SVON</option>}
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} placeholder="Gegner..." style={{...inputStyle, textAlign: "center"}} />
            )}
          </div>

          <button onClick={toggleHomeAway} title="Heimrecht tauschen" style={{ padding: "10px", cursor: "pointer", background: "#e0e0e0", border: "none", borderRadius: "8px", fontSize: "18px", marginTop: "18px", flexShrink: 0 }}>
            🔄
          </button>

          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", textAlign: "right" }}>Gastteam</label>
            {isSvonAway ? (
              <select value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} style={inputStyle}>
                {teams.length === 0 && <option value="SVON">SVON</option>}
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} placeholder="Gegner..." style={{...inputStyle, textAlign: "center"}} />
            )}
          </div>
        </div>

        <div style={{ display: "none" }} className="print-only">
           <h3>{homeTeam} vs {awayTeam}</h3>
        </div>

        {/* Dynamischer Spielstand für kleine Screens */}
        <div style={{ fontSize: "clamp(3rem, 12vw, 4.5rem)", fontWeight: "bold", margin: "10px 0", lineHeight: "1" }}>
          {homeGoals} : {awayGoals}
        </div>

        {/* Spieluhr */}
        <div className="no-print" style={{ marginBottom: "25px" }}>
          <div style={{ fontSize: "2rem", fontFamily: "monospace", marginBottom: "12px" }}>
            {formatTime(time)}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
            <button onClick={() => setIsRunning(!isRunning)} style={{ flex: 1, maxWidth: "140px", padding: "12px", backgroundColor: isRunning ? "#e74c3c" : "#2ecc71", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "bold" }}>
              {isRunning ? "⏸ Pause" : "▶️ Start"}
            </button>
            <button onClick={() => { setIsRunning(false); setTime(45 * 60); }} style={{ flex: 1, maxWidth: "140px", padding: "12px", backgroundColor: "#f39c12", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "bold" }}>
              ⏱ Halbzeit
            </button>
          </div>
        </div>

        <hr className="no-print" style={{ margin: "20px 0", borderColor: "#eee" }} />

        {/* Ereignis erfassen */}
        <div className="no-print">
          <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)} style={{ ...inputStyle, marginBottom: "15px" }}>
            <option value="">-- {ourTeamName} Spieler wählen --</option>
            {availablePlayers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "25px" }}>
            <button onClick={() => addEvent("home", "goal")} style={{...actionButtonStyle, background: "#2146d0"}}>⚽ Tor {homeTeam}</button>
            <button onClick={() => addEvent("away", "goal")} style={{...actionButtonStyle, background: "#333"}}>⚽ Tor {awayTeam}</button>
            
            <button onClick={() => addEvent("home", "yellow")} style={{...actionButtonStyle, background: "#f1c40f", color: "#333"}}>🟨 {homeTeam}</button>
            <button onClick={() => addEvent("away", "yellow")} style={{...actionButtonStyle, background: "#f1c40f", color: "#333"}}>🟨 {awayTeam}</button>
            
            <button onClick={() => addEvent("home", "red")} style={{...actionButtonStyle, background: "#e74c3c"}}>🟥 {homeTeam}</button>
            <button onClick={() => addEvent("away", "red")} style={{...actionButtonStyle, background: "#e74c3c"}}>🟥 {awayTeam}</button>
          </div>
        </div>

        {/* Responsive Admin Buttons (Flex Wrap für Mobile) */}
        <div className="no-print" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px" }}>
          <button onClick={undoLastEvent} disabled={history.length === 0} style={{ flex: "1 1 calc(50% - 8px)", padding: "10px", backgroundColor: "#7f8c8d", color: "white", border: "none", borderRadius: "8px" }}>↩️ Zurück</button>
          <button onClick={resetGame} style={{ flex: "1 1 calc(50% - 8px)", padding: "10px", backgroundColor: "#c0392b", color: "white", border: "none", borderRadius: "8px" }}>🗑️ Verwerfen</button>
          <button onClick={finishMatch} style={{ flex: "1 1 100%", padding: "12px", backgroundColor: "#27ae60", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "16px" }}>💾 Spiel beenden & Speichern</button>
          <button onClick={generatePDF} style={{ flex: "1 1 100%", padding: "12px", backgroundColor: "#2980b9", color: "white", border: "none", borderRadius: "8px", fontSize: "16px" }}>🖨️ PDF Bericht</button>
        </div>

        <hr style={{ margin: "25px 0", borderColor: "#eee" }} />

        {/* Spielbericht Timeline */}
        <h3 style={{ fontSize: "1.2rem", marginBottom: "10px" }}>📝 Spielbericht</h3>
        {history.length === 0 ? (
          <p style={{ color: "#999", fontSize: "14px" }}>Noch keine Ereignisse.</p>
        ) : (
          <div style={{ textAlign: "left", padding: "12px", borderRadius: "10px", background: "white", border: "1px solid #ddd" }}>
            {[...history].reverse().map((event) => (
              <div key={event.id} style={{ padding: "8px 0", borderBottom: "1px solid #f5f5f5", display: "flex", gap: "12px", alignItems: "center" }}>
                <span style={{ fontWeight: "bold", width: "35px", color: "#555" }}>{event.minute}'</span>
                <span style={{ fontSize: "1.4rem" }}>{getEventIcon(event.type)}</span>
                <span style={{ fontSize: "14px" }}><strong>{event.team === "home" ? homeTeam : awayTeam}</strong>: {event.player}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- TABELLE: LETZTE SPIELE (Scrollbar auf Mobile) --- */}
      <div className="no-print" style={{ marginTop: "40px" }}>
        <h3 style={{ fontSize: "1.2rem", marginBottom: "15px" }}>🏆 Letzte Spiele</h3>
        {savedMatches.length === 0 ? (
          <p style={{ color: "#999", fontSize: "14px" }}>Noch keine Spiele gespeichert.</p>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "white", minWidth: "400px" }}>
              <thead>
                <tr style={{ background: "#2146d0", color: "white", textAlign: "left" }}>
                  <th style={{ padding: "12px 10px", fontSize: "14px" }}>Datum</th>
                  <th style={{ padding: "12px 10px", fontSize: "14px" }}>Begegnung</th>
                  <th style={{ padding: "12px 10px", fontSize: "14px", textAlign: "center" }}>Ergebnis</th>
                </tr>
              </thead>
              <tbody>
                {savedMatches.map((match) => (
                  <tr key={match.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "12px 10px", fontSize: "14px", color: "#555" }}>{match.date}</td>
                    <td style={{ padding: "12px 10px", fontSize: "14px" }}>{match.homeTeam} vs {match.awayTeam}</td>
                    <td style={{ padding: "12px 10px", fontWeight: "bold", fontSize: "16px", textAlign: "center" }}>
                      {match.homeGoals} : {match.awayGoals}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}