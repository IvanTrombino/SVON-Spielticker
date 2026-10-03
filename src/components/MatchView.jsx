import { useState, useEffect } from "react";
import logo from "../assets/SVON-Wappen.png";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase"; 

export default function MatchView() {
  // --- CLOUD-STATE: Metadaten (aus anderen Menüs) ---
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState({});
  const [scorers, setScorers] = useState({});
  const [savedMatches, setSavedMatches] = useState([]);

  // --- CLOUD-STATE: Live-Spiel ---
  const [isSvonAway, setIsSvonAway] = useState(false);
  const [homeTeam, setHomeTeam] = useState("SVON");
  const [awayTeam, setAwayTeam] = useState("Gast");
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState([]);

  // --- LOKALER-STATE: UI-Bedienung ---
  const [selectedPlayer, setSelectedPlayer] = useState("");

  // 1. GLOBALE DATEN AUS DER CLOUD LADEN (Teams, Spieler, Torschützen, Alte Spiele)
  useEffect(() => {
    const unsubTeams = onSnapshot(doc(db, "ticker", "teams"), (snap) => {
      if (snap.exists()) setTeams(snap.data().teamsList || []);
    });
    
    const unsubPlayers = onSnapshot(doc(db, "ticker", "players"), (snap) => {
      if (snap.exists()) setPlayers(snap.data());
    });
    
    const unsubScorers = onSnapshot(doc(db, "ticker", "scorers"), (snap) => {
      if (snap.exists()) setScorers(snap.data());
    });
    
    const unsubMatches = onSnapshot(doc(db, "ticker", "matches"), (snap) => {
      if (snap.exists()) setSavedMatches(snap.data().matchesList || []);
    });

    return () => {
      unsubTeams();
      unsubPlayers();
      unsubScorers();
      unsubMatches();
    };
  }, []);

  // 2. LIVE-TICKER AUS DER CLOUD LADEN & ABONNIEREN
  useEffect(() => {
    const unsubLive = onSnapshot(doc(db, "ticker", "live_match"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsSvonAway(data.isSvonAway || false);
        setHomeTeam(data.homeTeam || "SVON");
        setAwayTeam(data.awayTeam || "Gast");
        setHomeGoals(data.homeGoals || 0);
        setAwayGoals(data.awayGoals || 0);
        setHistory(data.history || []);
        
        // Verhindern, dass die Zeit springt, wenn sie lokal schon weiter ist
        if (!isRunning && data.time) setTime(data.time);
      }
    });
    return () => unsubLive(); 
  }, [isRunning]);

  // Hilfsfunktion: Live-Updates in die Cloud feuern
  const syncLiveMatch = async (updates) => {
    try {
      await setDoc(doc(db, "ticker", "live_match"), updates, { merge: true });
    } catch (error) {
      console.error("Fehler beim Cloud-Speichern:", error);
    }
  };

  // Spieluhr (läuft lokal, speichert beim Pausieren)
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => setTime((prev) => prev + 1), 1000);
    } else {
      clearInterval(interval);
      syncLiveMatch({ time }); 
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
      if (!window.confirm("Spiel läuft bereits! Heimrecht trotzdem tauschen?")) return;
    }
    const newIsAway = !isSvonAway;
    const newHome = awayTeam;
    const newAway = homeTeam;
    const newHomeG = awayGoals;
    const newAwayG = homeGoals;

    setIsSvonAway(newIsAway);
    setHomeTeam(newHome);
    setAwayTeam(newAway);
    setHomeGoals(newHomeG);
    setAwayGoals(newAwayG);

    syncLiveMatch({
      isSvonAway: newIsAway,
      homeTeam: newHome,
      awayTeam: newAway,
      homeGoals: newHomeG,
      awayGoals: newAwayG
    });
  };

  const addEvent = (team, type) => {
    const isHomeEvent = team === "home";
    const isOurEvent = isSvonAway ? !isHomeEvent : isHomeEvent;
    
    const playerName = (isOurEvent && selectedPlayer) ? selectedPlayer : (isOurEvent ? "Unbekannt" : "Gegner");
    const minute = Math.floor(time / 60) + 1;
    const newEvent = { id: Date.now(), team, type, player: playerName, minute };
    
    let newHomeGoals = homeGoals;
    let newAwayGoals = awayGoals;

    if (type === "goal") {
      if (isHomeEvent) newHomeGoals++;
      else newAwayGoals++;
      
      // Torschützen in die Cloud aktualisieren
      if (isOurEvent && selectedPlayer) {
        const teamScorers = scorers[ourTeamName] || {};
        const pGoals = teamScorers[selectedPlayer] || 0;
        const newScorers = { ...scorers, [ourTeamName]: { ...teamScorers, [selectedPlayer]: pGoals + 1 } };
        
        setScorers(newScorers); // Lokales Update für schnelle UI
        setDoc(doc(db, "ticker", "scorers"), newScorers); // Cloud Update
      }
    }
    
    const newHistory = [...history, newEvent];
    
    setHomeGoals(newHomeGoals);
    setAwayGoals(newAwayGoals);
    setHistory(newHistory);
    setSelectedPlayer("");

    syncLiveMatch({
      homeGoals: newHomeGoals,
      awayGoals: newAwayGoals,
      history: newHistory,
      time: time
    });
  };

  const undoLastEvent = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const lastEvent = newHistory.pop();

    const isHomeEvent = lastEvent.team === "home";
    const isOurEvent = isSvonAway ? !isHomeEvent : isHomeEvent;
    
    let newHomeGoals = homeGoals;
    let newAwayGoals = awayGoals;

    if (lastEvent.type === "goal") {
      if (isHomeEvent) newHomeGoals = Math.max(0, newHomeGoals - 1);
      else newAwayGoals = Math.max(0, newAwayGoals - 1);

      if (isOurEvent && lastEvent.player !== "Unbekannt" && lastEvent.player !== "Gegner") {
        const teamScorers = scorers[ourTeamName] || {};
        const pGoals = teamScorers[lastEvent.player] || 0;
        const newScorers = { ...scorers, [ourTeamName]: { ...teamScorers, [lastEvent.player]: Math.max(0, pGoals - 1) } };
        
        setScorers(newScorers);
        setDoc(doc(db, "ticker", "scorers"), newScorers); 
      }
    }
    
    setHomeGoals(newHomeGoals);
    setAwayGoals(newAwayGoals);
    setHistory(newHistory);

    syncLiveMatch({
      homeGoals: newHomeGoals,
      awayGoals: newAwayGoals,
      history: newHistory
    });
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
      
      const newSavedMatches = [newMatch, ...savedMatches];
      setSavedMatches(newSavedMatches);
      
      // Gespeicherte Spiele in die Cloud laden
      setDoc(doc(db, "ticker", "matches"), { matchesList: newSavedMatches });
      
      // Live-Ticker in der Cloud zurücksetzen
      const resetData = {
        homeGoals: 0,
        awayGoals: 0,
        time: 0,
        isRunning: false,
        history: []
      };
      
      setHomeGoals(0);
      setAwayGoals(0);
      setTime(0);
      setIsRunning(false);
      setHistory([]);
      setSelectedPlayer("");

      syncLiveMatch(resetData);
    }
  };

  const resetGame = () => {
    if (window.confirm("Aktuelles Spiel wirklich verwerfen?")) {
      const resetData = { homeGoals: 0, awayGoals: 0, time: 0, isRunning: false, history: [] };
      setHomeGoals(0); setAwayGoals(0); setTime(0); setIsRunning(false); setHistory([]); setSelectedPlayer("");
      syncLiveMatch(resetData);
    }
  };

  const generatePDF = () => {
    window.print();
  };

  const getEventIcon = (type) => {
    if (type === "goal") return "⚽";
    if (type === "yellow") return "🟨";
    if (type === "red") return "🟥";
    return "📝";
  };

  const inputStyle = {
    padding: "10px", borderRadius: "8px", border: "1px solid #ccc",
    width: "100%", boxSizing: "border-box", fontSize: "16px"
  };

  const actionButtonStyle = {
    padding: "12px 8px", border: "none", borderRadius: "8px",
    fontSize: "15px", fontWeight: "bold", color: "white",
    cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
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
        
        {/* --- KOPFBEREICH: TEAMS --- */}
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "15px", width: "100%" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", textAlign: "left" }}>Heimteam</label>
            {!isSvonAway ? (
              <select value={homeTeam} onChange={(e) => { setHomeTeam(e.target.value); syncLiveMatch({ homeTeam: e.target.value }); }} style={inputStyle}>
                {teams.length === 0 && <option value="SVON">SVON</option>}
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <input value={homeTeam} onChange={(e) => { setHomeTeam(e.target.value); syncLiveMatch({ homeTeam: e.target.value }); }} placeholder="Gegner..." style={{...inputStyle, textAlign: "center"}} />
            )}
          </div>

          <button onClick={toggleHomeAway} title="Heimrecht tauschen" style={{ padding: "10px", cursor: "pointer", background: "#e0e0e0", border: "none", borderRadius: "8px", fontSize: "18px", marginTop: "18px", flexShrink: 0 }}>
            🔄
          </button>

          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: "12px", color: "#666", marginBottom: "4px", textAlign: "right" }}>Gastteam</label>
            {isSvonAway ? (
              <select value={awayTeam} onChange={(e) => { setAwayTeam(e.target.value); syncLiveMatch({ awayTeam: e.target.value }); }} style={inputStyle}>
                {teams.length === 0 && <option value="SVON">SVON</option>}
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <input value={awayTeam} onChange={(e) => { setAwayTeam(e.target.value); syncLiveMatch({ awayTeam: e.target.value }); }} placeholder="Gegner..." style={{...inputStyle, textAlign: "center"}} />
            )}
          </div>
        </div>

        <div style={{ display: "none" }} className="print-only">
           <h3>{homeTeam} vs {awayTeam}</h3>
        </div>

        {/* --- SPIELSTAND --- */}
        <div style={{ fontSize: "clamp(3rem, 12vw, 4.5rem)", fontWeight: "bold", margin: "10px 0", lineHeight: "1" }}>
          {homeGoals} : {awayGoals}
        </div>

        {/* --- UHRZEIT & STEUERUNG --- */}
        <div className="no-print" style={{ marginBottom: "25px" }}>
          <div style={{ fontSize: "2rem", fontFamily: "monospace", marginBottom: "12px" }}>
            {formatTime(time)}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
            <button onClick={() => { setIsRunning(!isRunning); syncLiveMatch({ isRunning: !isRunning }); }} style={{ flex: 1, maxWidth: "140px", padding: "12px", backgroundColor: isRunning ? "#e74c3c" : "#2ecc71", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "bold" }}>
              {isRunning ? "⏸ Pause" : "▶️ Start"}
            </button>
            <button onClick={() => { setIsRunning(false); setTime(45 * 60); syncLiveMatch({ isRunning: false, time: 45 * 60 }); }} style={{ flex: 1, maxWidth: "140px", padding: "12px", backgroundColor: "#f39c12", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "bold" }}>
              ⏱ Halbzeit
            </button>
          </div>
        </div>

        <hr className="no-print" style={{ margin: "20px 0", borderColor: "#eee" }} />

        {/* --- AKTIONEN: TORE & KARTEN --- */}
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

        {/* --- ADMIN & PDF --- */}
        <div className="no-print" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px" }}>
          <button onClick={undoLastEvent} disabled={history.length === 0} style={{ flex: "1 1 calc(50% - 8px)", padding: "10px", backgroundColor: "#7f8c8d", color: "white", border: "none", borderRadius: "8px" }}>↩️ Zurück</button>
          <button onClick={resetGame} style={{ flex: "1 1 calc(50% - 8px)", padding: "10px", backgroundColor: "#c0392b", color: "white", border: "none", borderRadius: "8px" }}>🗑️ Verwerfen</button>
          <button onClick={finishMatch} style={{ flex: "1 1 100%", padding: "12px", backgroundColor: "#27ae60", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "16px" }}>💾 Spiel beenden & Speichern</button>
          <button onClick={generatePDF} style={{ flex: "1 1 100%", padding: "12px", backgroundColor: "#2980b9", color: "white", border: "none", borderRadius: "8px", fontSize: "16px" }}>🖨️ PDF Bericht</button>
        </div>

        <hr style={{ margin: "25px 0", borderColor: "#eee" }} />

        {/* --- SPIELBERICHT (TIMELINE) --- */}
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

      {/* --- TABELLE: LETZTE SPIELE (Gespeichert in der Cloud) --- */}
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