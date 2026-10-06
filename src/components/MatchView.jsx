import { useState, useEffect } from "react";
import logo from "../assets/SVON-Wappen.png";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase"; 

export default function MatchView({ clubId, teams }) {
  // --- NAVIGATION & TEAM-AUSWAHL ---
  const [activeTab, setActiveTab] = useState("ticker");
  const [selectedTeam, setSelectedTeam] = useState(teams && teams.length > 0 ? teams[0] : "1. Mannschaft");

  // --- CLOUD-STATE: Metadaten ---
  const [players, setPlayers] = useState([]); 
  const [scorers, setScorers] = useState({});
  const [savedMatches, setSavedMatches] = useState([]);
  const [lineups, setLineups] = useState({});
  const [nextMatches, setNextMatches] = useState({});

  // --- LOKALER-STATE FÜR NÄCHSTE SPIELE (Admin-Eingabe) ---
  const [nextOpponent, setNextOpponent] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("");
  const [nextIsHome, setNextIsHome] = useState(true); 
  const [nextLocation, setNextLocation] = useState(""); 

  // --- CLOUD-STATE: Live-Spiel ---
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split("T")[0]);
  const [kickoffTime, setKickoffTime] = useState("");
  const [isSvonAway, setIsSvonAway] = useState(false);
  const [homeTeam, setHomeTeam] = useState("Heim");
  const [awayTeam, setAwayTeam] = useState("Gast");
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState([]);

  // --- NEU: LOCKING LOGIK (SPERRE) ---
  const [editorName, setEditorName] = useState(() => localStorage.getItem("tickerEditorName") || "");
  const [tempEditorName, setTempEditorName] = useState(""); // Für das Eingabefeld
  const [activeEditor, setActiveEditor] = useState("");
  const [lockTimestamp, setLockTimestamp] = useState(0);

  // --- LOKALER-STATE: UI-Bedienung ---
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editHomeGoals, setEditHomeGoals] = useState(0);
  const [editAwayGoals, setEditAwayGoals] = useState(0);
  const [expandedMatchId, setExpandedMatchId] = useState(null);

  // --- LOCK STATUS BERECHNEN ---
  const LOCK_TIMEOUT_MS = 120000; // 2 Minuten Inaktivität = Lock verfällt
  const isLockActive = activeEditor !== "" && lockTimestamp > 0 && (Date.now() - lockTimestamp < LOCK_TIMEOUT_MS);
  const iAmEditor = activeEditor === editorName && editorName !== "";
  // Man darf bearbeiten, wenn der Ticker frei ist, oder man selbst der Editor ist
  const canEdit = (!isLockActive || iAmEditor) && editorName !== "";

  useEffect(() => {
    if (teams && teams.length > 0 && !teams.includes(selectedTeam)) {
      setSelectedTeam(teams[0]);
    }
  }, [teams, selectedTeam]);

  useEffect(() => {
    const currentNext = nextMatches[selectedTeam] || {};
    setNextOpponent(currentNext.opponent || "");
    setNextDate(currentNext.date || "");
    setNextTime(currentNext.time || "");
    setNextIsHome(currentNext.isHome !== undefined ? currentNext.isHome : true);
    setNextLocation(currentNext.location || "");
  }, [selectedTeam, nextMatches]);

  const sendNtfyPush = async (eventTitle, eventMessage) => {
    try {
      const safeChannelName = `${clubId}${selectedTeam.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      await fetch(`https://ntfy.sh/${safeChannelName}`, {
        method: "POST",
        body: `${eventTitle}: ${eventMessage}`,
        headers: { "Priority": "urgent" }
      });
    } catch (error) {
      console.error("Push-Fehler:", error);
    }
  };

  useEffect(() => {
    if (!clubId) return;
    const unsubScorers = onSnapshot(doc(db, "ticker", `${clubId}_scorers`), (snap) => { if (snap.exists()) setScorers(snap.data()); });
    const unsubMatches = onSnapshot(doc(db, "ticker", `${clubId}_matches`), (snap) => { if (snap.exists()) setSavedMatches(snap.data().matchesList || []); });
    const unsubLineups = onSnapshot(doc(db, "ticker", `${clubId}_lineups`), (snap) => { if (snap.exists()) setLineups(snap.data() || {}); });
    const unsubNext = onSnapshot(doc(db, "ticker", `${clubId}_next_matches`), (snap) => { if (snap.exists()) setNextMatches(snap.data() || {}); });

    return () => { unsubScorers(); unsubMatches(); unsubLineups(); unsubNext(); };
  }, [clubId]);

  useEffect(() => {
    setSelectedPlayer("");
    if (!clubId || !selectedTeam) return;
    const unsubPlayers = onSnapshot(doc(db, "ticker", `${clubId}_players`), (snap) => {
      if (snap.exists()) {
        const allPlayersObj = snap.data() || {};
        const teamPlayers = allPlayersObj[selectedTeam] || [];
        setPlayers([...teamPlayers].sort((a, b) => a.localeCompare(b)));
      } else setPlayers([]);
    });
    return () => unsubPlayers();
  }, [clubId, selectedTeam]);

  // LIVE-TICKER & LOCKING LADEN
  useEffect(() => {
    if (!clubId || !selectedTeam) return;

    const docName = `${clubId}_live_match_${selectedTeam}`;
    const unsubLive = onSnapshot(doc(db, "ticker", docName), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        setIsSvonAway(data.isSvonAway || false);
        setHomeTeam(data.homeTeam !== undefined ? data.homeTeam : selectedTeam);
        setAwayTeam(data.awayTeam !== undefined ? data.awayTeam : "Gast");
        setHomeGoals(data.homeGoals || 0);
        setAwayGoals(data.awayGoals || 0);
        setHistory(data.history || []);
        if (data.matchDate) setMatchDate(data.matchDate);
        if (data.kickoffTime !== undefined) setKickoffTime(data.kickoffTime);
        
        // Locking Updates
        setActiveEditor(data.activeEditor || "");
        setLockTimestamp(data.lockTimestamp || 0);

        if (data.isRunning) {
          if (data.startTime) {
            const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
            setTime(elapsed);
          } else if (data.time !== undefined) setTime(data.time);
          setIsRunning(true);
        } else {
          if (data.time !== undefined) setTime(data.time);
          setIsRunning(false);
        }
      } else {
        setIsSvonAway(false); setHomeTeam(selectedTeam); setAwayTeam("Gast"); setHomeGoals(0); setAwayGoals(0);
        setTime(0); setIsRunning(false); setHistory([]); setMatchDate(new Date().toISOString().split("T")[0]); setKickoffTime("");
        setActiveEditor(""); setLockTimestamp(0);
      }
    });

    return () => unsubLive(); 
  }, [clubId, selectedTeam]);

  // --- HEARTBEAT FÜR LOCKING (Sendet alle 30 Sekunden ein Lebenszeichen) ---
  useEffect(() => {
    let heartbeat;
    if (iAmEditor && isLockActive) {
      heartbeat = setInterval(() => {
        syncLiveMatch({ lockTimestamp: Date.now() });
      }, 30000); // 30 Sekunden
    }
    return () => clearInterval(heartbeat);
  }, [iAmEditor, isLockActive, selectedTeam]);

  // Sperre sichern
  const claimLock = () => {
    if (!editorName) return alert("Bitte gib zuerst deinen Namen ein.");
    syncLiveMatch({ activeEditor: editorName, lockTimestamp: Date.now() });
  };

  // Sperre aufheben
  const releaseLock = () => {
    syncLiveMatch({ activeEditor: "", lockTimestamp: 0 });
  };

  const syncLiveMatch = async (updates) => {
    if (!clubId || !selectedTeam) return;
    try {
      const docName = `${clubId}_live_match_${selectedTeam}`;
      await setDoc(doc(db, "ticker", docName), updates, { merge: true });
    } catch (error) {
      console.error("Fehler beim Cloud-Speichern:", error);
    }
  };

  const saveMatchesToCloud = async (newMatchesList) => {
    try {
      await setDoc(doc(db, "ticker", `${clubId}_matches`), { matchesList: newMatchesList });
    } catch (error) {
      console.error("Fehler beim Speichern der Historie:", error);
    }
  };

  const saveNextMatchToCloud = async (e) => {
    e.preventDefault();
    const updatedNextMatches = {
      ...nextMatches,
      [selectedTeam]: { opponent: nextOpponent, date: nextDate, time: nextTime, isHome: nextIsHome, location: nextLocation }
    };
    setNextMatches(updatedNextMatches);
    try {
      await setDoc(doc(db, "ticker", `${clubId}_next_matches`), updatedNextMatches);
      alert(`✅ Nächstes Spiel für ${selectedTeam} gespeichert!`);
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
    }
  };

  const togglePlayerInLineup = async (player) => {
    const currentTeamLineup = lineups[selectedTeam] || [];
    let updatedLineup;
    if (currentTeamLineup.includes(player)) updatedLineup = currentTeamLineup.filter(p => p !== player);
    else updatedLineup = [...currentTeamLineup, player];
    
    const newLineups = { ...lineups, [selectedTeam]: updatedLineup };
    setLineups(newLineups);
    try {
      await setDoc(doc(db, "ticker", `${clubId}_lineups`), newLineups);
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
    }
  };

  // Stoppuhr
  useEffect(() => {
    let interval;
    if (isRunning) interval = setInterval(() => setTime((prev) => prev + 1), 1000);
    else clearInterval(interval);
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (isRunning && time >= 130 * 60) {
      setIsRunning(false);
      syncLiveMatch({ isRunning: false, time: time });
      alert("⏰ Automatischer Stopp: Das Spiel hat 130 Minuten erreicht und wurde pausiert.");
    }
  }, [time, isRunning]);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const toggleHomeAway = () => {
    if (history.length > 0 && !window.confirm("Spiel läuft bereits! Heimrecht trotzdem tauschen?")) return;
    const newIsAway = !isSvonAway;
    setIsSvonAway(newIsAway); setHomeTeam(awayTeam); setAwayTeam(homeTeam);
    setHomeGoals(awayGoals); setAwayGoals(homeGoals);

    syncLiveMatch({
      isSvonAway: newIsAway, homeTeam: awayTeam, awayTeam: homeTeam,
      homeGoals: awayGoals, awayGoals: homeGoals
    });
  };

  const addEvent = (team, type) => {
    if (!canEdit) return;
    const isHomeEvent = team === "home";
    const isOurEvent = isSvonAway ? !isHomeEvent : isHomeEvent;
    const playerName = (isOurEvent && selectedPlayer) ? selectedPlayer : (isOurEvent ? "Unbekannt" : "Gegner");
    const minute = Math.floor(time / 60) + 1;
    const newEvent = { id: Date.now(), team, type, player: playerName, minute };
    
    let newHomeGoals = homeGoals;
    let newAwayGoals = awayGoals;
    const eventingTeamName = isHomeEvent ? homeTeam : awayTeam;

    if (type === "goal") {
      if (isHomeEvent) newHomeGoals++; else newAwayGoals++;
      sendNtfyPush(`⚽ TOOOOR für ${eventingTeamName} (${selectedTeam})`, `${minute}. Minute - ${playerName} (${newHomeGoals}:${newAwayGoals})`);

      if (isOurEvent && selectedPlayer) {
        const teamScorers = scorers[selectedTeam] || {};
        const pGoals = teamScorers[selectedPlayer] || 0;
        const newScorers = { ...scorers, [selectedTeam]: { ...teamScorers, [selectedPlayer]: pGoals + 1 } };
        setScorers(newScorers);
        setDoc(doc(db, "ticker", `${clubId}_scorers`), newScorers);
      }
    } else if (type === "yellow") sendNtfyPush(`🟨 Gelbe Karte (${eventingTeamName})`, `${minute}. Minute - ${playerName}`);
    else if (type === "yellowred") sendNtfyPush(`🟨🟥 Gelb-Rote Karte (${eventingTeamName})`, `${minute}. Minute - ${playerName}`);
    else if (type === "red") sendNtfyPush(`🟥 Rote Karte (${eventingTeamName})`, `${minute}. Minute - ${playerName}`);
    
    const newHistory = [...history, newEvent];
    setHomeGoals(newHomeGoals); setAwayGoals(newAwayGoals); setHistory(newHistory); setSelectedPlayer("");

    syncLiveMatch({ homeGoals: newHomeGoals, awayGoals: newAwayGoals, history: newHistory, time: time, lockTimestamp: Date.now() });
  };

  const undoLastEvent = () => {
    if (!canEdit || history.length === 0) return;
    const newHistory = [...history];
    const lastEvent = newHistory.pop();
    const isHomeEvent = lastEvent.team === "home";
    const isOurEvent = isSvonAway ? !isHomeEvent : isHomeEvent;
    
    let newHomeGoals = homeGoals; let newAwayGoals = awayGoals;

    if (lastEvent.type === "goal") {
      if (isHomeEvent) newHomeGoals = Math.max(0, newHomeGoals - 1);
      else newAwayGoals = Math.max(0, newAwayGoals - 1);

      if (isOurEvent && lastEvent.player !== "Unbekannt" && lastEvent.player !== "Gegner") {
        const teamScorers = scorers[selectedTeam] || {};
        const pGoals = teamScorers[lastEvent.player] || 0;
        const newScorers = { ...scorers, [selectedTeam]: { ...teamScorers, [lastEvent.player]: Math.max(0, pGoals - 1) } };
        setScorers(newScorers);
        setDoc(doc(db, "ticker", `${clubId}_scorers`), newScorers); 
      }
    }
    setHomeGoals(newHomeGoals); setAwayGoals(newAwayGoals); setHistory(newHistory);
    syncLiveMatch({ homeGoals: newHomeGoals, awayGoals: newAwayGoals, history: newHistory, lockTimestamp: Date.now() });
  };

  const finishMatch = () => {
    if (!canEdit) return;
    if (window.confirm("Spiel beenden und in 'Letzte Spiele' speichern?")) {
      const formattedDate = new Date(matchDate).toLocaleDateString("de-DE");
      const displayDate = kickoffTime ? `${formattedDate} ${kickoffTime} Uhr` : formattedDate;

      sendNtfyPush(`🏁 Spiel beendet (${homeTeam} vs ${awayTeam})`, `Endstand: ${homeGoals} : ${awayGoals}`);

      const newMatch = { id: Date.now(), date: displayDate, team: selectedTeam, homeTeam, awayTeam, homeGoals, awayGoals, history };
      const newSavedMatches = [newMatch, ...savedMatches];
      
      setSavedMatches(newSavedMatches);
      saveMatchesToCloud(newSavedMatches);

      if (window.confirm("Möchtest du das Spielergebnis und die Highlights jetzt per WhatsApp / Social Media teilen?")) shareMatchToSocialMedia(newMatch);
      
      const resetData = {
        homeGoals: 0, awayGoals: 0, time: 0, isRunning: false, history: [], startTime: null,
        homeTeam: isSvonAway ? "Gast" : selectedTeam, awayTeam: isSvonAway ? selectedTeam : "Gast",
        matchDate: new Date().toISOString().split("T")[0], kickoffTime: "", activeEditor: "", lockTimestamp: 0
      };
      
      setHomeGoals(0); setAwayGoals(0); setTime(0); setIsRunning(false); setHistory([]); setSelectedPlayer("");
      setHomeTeam(resetData.homeTeam); setAwayTeam(resetData.awayTeam);
      setMatchDate(resetData.matchDate); setKickoffTime("");

      syncLiveMatch(resetData);
    }
  };

  const shareMatchToSocialMedia = (match) => {
    let text = `⚽ Spielbericht (${match.team || selectedTeam})\n📅 ${match.date}\n\n🏆 ${match.homeTeam} vs ${match.awayTeam}\n👉 Endstand: ${match.homeGoals} : ${match.awayGoals}\n\n`;
    if (match.history && match.history.length > 0) {
      text += `📝 Highlights & Verlauf:\n`;
      [...match.history].reverse().forEach((event) => {
        let icon = event.type === "goal" ? "⚽" : (event.type === "yellow" ? "🟨" : (event.type === "yellowred" ? "🟨🟥" : (event.type === "red" ? "🟥" : "📝")));
        text += `${event.minute}' ${icon} ${event.player}\n`;
      });
    } else text += `Keine Ereignisse aufgezeichnet.\n`;

    if (navigator.share) navigator.share({ title: "Spielbericht", text: text }).catch(() => {});
    else { navigator.clipboard.writeText(text); alert("Spielbericht kopiert!"); }
  };

  const resetGame = () => {
    if (!canEdit) return;
    if (window.confirm("Spiel wirklich zurücksetzen? (Datum, Uhrzeit und Gegner bleiben erhalten)")) {
      setHomeGoals(0); setAwayGoals(0); setTime(0); setIsRunning(false); setHistory([]); setSelectedPlayer("");
      syncLiveMatch({ homeGoals: 0, awayGoals: 0, time: 0, isRunning: false, history: [], startTime: null, lockTimestamp: Date.now() });
    }
  };

  const deleteSavedMatch = (id) => {
    if (window.confirm("Dieses gespeicherte Spiel wirklich löschen?")) {
      const updated = savedMatches.filter(m => m.id !== id);
      setSavedMatches(updated); saveMatchesToCloud(updated);
    }
  };

  const startEditingMatch = (match) => { setEditingMatchId(match.id); setEditHomeGoals(match.homeGoals); setEditAwayGoals(match.awayGoals); };
  const saveEditedMatch = (id) => {
    const updated = savedMatches.map(m => m.id === id ? { ...m, homeGoals: Number(editHomeGoals), awayGoals: Number(editAwayGoals) } : m);
    setSavedMatches(updated); saveMatchesToCloud(updated); setEditingMatchId(null);
  };

  const getEventIcon = (type) => {
    if (type === "goal") return "⚽"; if (type === "yellow") return "🟨"; if (type === "yellowred") return "🟨🟥"; if (type === "red") return "🟥"; return "📝";
  };

  // --- MOBIL-OPTIMIERTE STYLES ---
  const inputStyle = { padding: "8px", borderRadius: "8px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box", fontSize: "14px", color: "#333", backgroundColor: "#fff", WebkitAppearance: "none", opacity: canEdit ? 1 : 0.6 };
  const actionButtonStyle = { padding: "12px 6px", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "bold", color: "white", cursor: canEdit ? "pointer" : "not-allowed", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", opacity: canEdit ? 1 : 0.5 };
  const tabButtonStyle = (tabName) => ({ flex: 1, padding: "8px 4px", background: activeTab === tabName ? "#2146d0" : "#e0e0e0", color: activeTab === tabName ? "white" : "#333", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" });

  const filteredMatches = savedMatches.filter(m => (m.team || (teams && teams[0]) || "1. Mannschaft") === selectedTeam);
  const currentLineup = lineups[selectedTeam] || [];

  return (
    <div style={{ padding: "10px", textAlign: "center", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto", boxSizing: "border-box" }}>
      <img src={logo} alt="Logo" style={{ maxWidth: "60px", marginBottom: "5px" }} />
      <h2 style={{ color: "#2146d0", margin: "0 0 10px 0", fontSize: "1.3rem" }}>⚽ Live-Ticker ({clubId.toUpperCase()})</h2>

      <div style={{ background: "white", padding: "10px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
        <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px", fontWeight: "bold", textAlign: "left" }}>
          Zu steuernde Mannschaft:
        </label>
        <select 
          value={selectedTeam} 
          onChange={(e) => setSelectedTeam(e.target.value)}
          style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "14px", background: "#f8f9fa", color: "#333", boxSizing: "border-box" }}
        >
          {(!teams || teams.length === 0) && <option value="1. Mannschaft">1. Mannschaft</option>}
          {teams && teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: "5px", marginBottom: "15px" }}>
        <button onClick={() => setActiveTab("ticker")} style={tabButtonStyle("ticker")}>⏱️ Ticker</button>
        <button onClick={() => setActiveTab("next")} style={tabButtonStyle("next")}>📅 Nächstes Spiel</button>
        <button onClick={() => setActiveTab("lineup")} style={tabButtonStyle("lineup")}>📋 Kader ({currentLineup.length})</button>
        <button onClick={() => setActiveTab("history")} style={tabButtonStyle("history")}>📜 Spiele ({filteredMatches.length})</button>
      </div>

      {activeTab === "ticker" && (
        <div style={{ background: "#f8f9fa", padding: "12px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
          
          {/* --- NAMENS-EINGABE & SPERR-BANNER --- */}
          {!editorName ? (
            <div style={{ padding: "15px", background: "#e8f4f8", borderRadius: "8px", marginBottom: "15px", border: "1px solid #bce8f1" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#31708f" }}>Wer bedient den Ticker?</h4>
              <input 
                type="text" 
                placeholder="Dein Name (z.B. Ivan)" 
                value={tempEditorName} 
                onChange={(e) => setTempEditorName(e.target.value)} 
                style={{...inputStyle, marginBottom: "10px", opacity: 1}}
              />
              <button 
                onClick={() => {
                  if(tempEditorName.trim() !== "") {
                    localStorage.setItem("tickerEditorName", tempEditorName.trim());
                    setEditorName(tempEditorName.trim());
                  }
                }} 
                style={{ padding: "10px", width: "100%", background: "#2146d0", color: "white", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer" }}
              >
                Namen speichern & Loslegen
              </button>
            </div>
          ) : (
            <div style={{ padding: "10px 15px", borderRadius: "8px", marginBottom: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid", background: canEdit ? (iAmEditor ? "#d4edda" : "#e2e3e5") : "#f8d7da", borderColor: canEdit ? (iAmEditor ? "#c3e6cb" : "#d6d8db") : "#f5c6cb" }}>
              <span style={{ fontSize: "13px", fontWeight: "bold", color: canEdit ? (iAmEditor ? "#155724" : "#383d41") : "#721c24" }}>
                {canEdit ? (iAmEditor ? "✏️ Du bedienst den Ticker." : "🔓 Ticker ist frei.") : `🔒 Gesperrt durch: ${activeEditor}`}
              </span>
              {canEdit ? (
                iAmEditor ? (
                  <button onClick={releaseLock} style={{ background: "#dc3545", color: "white", border: "none", borderRadius: "6px", padding: "6px 10px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>Freigeben</button>
                ) : (
                  <button onClick={claimLock} style={{ background: "#28a745", color: "white", border: "none", borderRadius: "6px", padding: "6px 10px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>Bedienen</button>
                )
              ) : (
                <button onClick={claimLock} style={{ background: "#ffc107", color: "#333", border: "none", borderRadius: "6px", padding: "6px 10px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>Übernehmen</button>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <div style={{ flex: 1, textAlign: "left" }}>
              <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "2px" }}>Datum</label>
              <input type="date" disabled={!canEdit} value={matchDate} onChange={(e) => { setMatchDate(e.target.value); syncLiveMatch({ matchDate: e.target.value }); }} style={inputStyle} />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "2px" }}>Anstoßzeit</label>
              <input type="time" disabled={!canEdit} value={kickoffTime} onChange={(e) => { setKickoffTime(e.target.value); syncLiveMatch({ kickoffTime: e.target.value }); }} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "12px", width: "100%" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: "11px", color: "#666", marginBottom: "2px", textAlign: "left" }}>Heimteam</label>
              <input value={homeTeam} disabled={!isSvonAway || !canEdit} onChange={(e) => { setHomeTeam(e.target.value); syncLiveMatch({ homeTeam: e.target.value }); }} placeholder="Heim..." style={{...inputStyle, textAlign: "center", fontSize: "13px", padding: "8px 4px", backgroundColor: !isSvonAway ? "#eee" : "white", fontWeight: !isSvonAway ? "bold" : "normal"}} />
            </div>
            <button onClick={toggleHomeAway} disabled={!canEdit} title="Heimrecht tauschen" style={{ padding: "8px", cursor: canEdit ? "pointer" : "not-allowed", background: "#e0e0e0", color: "#333", border: "none", borderRadius: "8px", fontSize: "15px", marginTop: "16px", flexShrink: 0, opacity: canEdit ? 1 : 0.5 }}>🔄</button>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: "11px", color: "#666", marginBottom: "2px", textAlign: "right" }}>Gastteam</label>
              <input value={awayTeam} disabled={isSvonAway || !canEdit} onChange={(e) => { setAwayTeam(e.target.value); syncLiveMatch({ awayTeam: e.target.value }); }} placeholder="Gast..." style={{...inputStyle, textAlign: "center", fontSize: "13px", padding: "8px 4px", backgroundColor: isSvonAway ? "#eee" : "white", fontWeight: isSvonAway ? "bold" : "normal"}} />
            </div>
          </div>

          <div style={{ fontSize: "clamp(2.5rem, 10vw, 4rem)", fontWeight: "bold", margin: "8px 0", lineHeight: "1" }}>
            {homeGoals} : {awayGoals}
          </div>

          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "1.8rem", fontFamily: "monospace", marginBottom: "10px" }}>{formatTime(time)}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
              <button disabled={!canEdit} onClick={() => { 
                  if (isRunning) { setIsRunning(false); syncLiveMatch({ isRunning: false, time: time, lockTimestamp: Date.now() }); } 
                  else {
                    const newStartTime = Date.now() - (time * 1000);
                    setIsRunning(true);
                    if (time === 0) sendNtfyPush("▶ Anpfiff", `Das Spiel ${homeTeam} vs ${awayTeam} hat begonnen!`);
                    syncLiveMatch({ isRunning: true, startTime: newStartTime, time: time, lockTimestamp: Date.now() });
                  }
                }} 
                style={{ flex: 1, maxWidth: "130px", padding: "10px", backgroundColor: isRunning ? "#e74c3c" : "#2ecc71", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "bold", opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed" }}>
                {isRunning ? "⏸ Pause" : "▶ Start"}
              </button>
              <button disabled={!canEdit} onClick={() => { 
                  setIsRunning(false); setTime(45 * 60); 
                  sendNtfyPush("⏱ Halbzeit", `Spielstand: ${homeTeam} ${homeGoals} : ${awayGoals} ${awayTeam}`);
                  syncLiveMatch({ isRunning: false, time: 45 * 60, startTime: null, lockTimestamp: Date.now() }); 
                }} 
                style={{ flex: 1, maxWidth: "130px", padding: "10px", backgroundColor: "#f39c12", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "bold", opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed" }}>
                ⏱ Halbzeit
              </button>
            </div>
          </div>

          <hr style={{ margin: "15px 0", borderColor: "#eee" }} />

          {/* --- SPIELER-SCHNELL-AUSWAHL --- */}
          <div style={{ marginBottom: "15px", textAlign: "left", opacity: canEdit ? 1 : 0.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label style={{ fontSize: "12px", color: "#555", fontWeight: "bold" }}>
                Torschütze: <span style={{ color: "#2146d0" }}>{selectedPlayer || "Keiner ausgewählt"}</span>
              </label>
              {selectedPlayer && canEdit && (
                <button onClick={() => setSelectedPlayer("")} style={{ background: "transparent", border: "none", color: "#e74c3c", fontSize: "11px", cursor: "pointer", textDecoration: "underline" }}>Aufheben</button>
              )}
            </div>

            {currentLineup.length === 0 ? (
              <div style={{ background: "white", padding: "10px", borderRadius: "8px", border: "1px dashed #ccc", textAlign: "center" }}>
                <p style={{ margin: "0 0 6px 0", fontSize: "12px", color: "#666" }}>Kein Kader für {selectedTeam} hinterlegt.</p>
                <button onClick={() => setActiveTab("lineup")} style={{ background: "#2980b9", color: "white", border: "none", borderRadius: "6px", padding: "5px 10px", fontSize: "11px", cursor: "pointer", fontWeight: "bold" }}>📋 Kader zusammenstellen</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", background: "white", padding: "8px", borderRadius: "8px", border: "1px solid #ccc" }}>
                {currentLineup.map((p) => (
                  <button key={p} disabled={!canEdit} onClick={() => setSelectedPlayer(p)}
                    style={{ padding: "5px 8px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: "bold", cursor: canEdit ? "pointer" : "not-allowed", background: selectedPlayer === p ? "#2146d0" : "#e8f4f8", color: selectedPlayer === p ? "white" : "#2c3e50", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                    {p} {selectedPlayer === p && "✓"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "20px" }}>
            <button disabled={!canEdit} onClick={() => addEvent("home", "goal")} style={{...actionButtonStyle, background: "#2146d0"}}>⚽ Tor {homeTeam}</button>
            <button disabled={!canEdit} onClick={() => addEvent("away", "goal")} style={{...actionButtonStyle, background: "#333"}}>⚽ Tor {awayTeam}</button>
            <button disabled={!canEdit} onClick={() => addEvent("home", "yellow")} style={{...actionButtonStyle, background: "#f1c40f", color: "#333"}}>🟨 {homeTeam}</button>
            <button disabled={!canEdit} onClick={() => addEvent("away", "yellow")} style={{...actionButtonStyle, background: "#f1c40f", color: "#333"}}>🟨 {awayTeam}</button>
            <button disabled={!canEdit} onClick={() => addEvent("home", "yellowred")} style={{...actionButtonStyle, background: "#e67e22", color: "white"}}>🟨🟥 {homeTeam}</button>
            <button disabled={!canEdit} onClick={() => addEvent("away", "yellowred")} style={{...actionButtonStyle, background: "#e67e22", color: "white"}}>🟨🟥 {awayTeam}</button>
            <button disabled={!canEdit} onClick={() => addEvent("home", "red")} style={{...actionButtonStyle, background: "#e74c3c"}}>🟥 {homeTeam}</button>
            <button disabled={!canEdit} onClick={() => addEvent("away", "red")} style={{...actionButtonStyle, background: "#e74c3c"}}>🟥 {awayTeam}</button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px" }}>
            <button disabled={!canEdit || history.length === 0} onClick={undoLastEvent} style={{ flex: "1 1 calc(50% - 6px)", padding: "8px", backgroundColor: "#7f8c8d", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", opacity: (!canEdit || history.length === 0) ? 0.5 : 1, cursor: (!canEdit || history.length === 0) ? "not-allowed" : "pointer" }}>↩ Zurück</button>
            <button disabled={!canEdit} onClick={resetGame} style={{ flex: "1 1 calc(50% - 6px)", padding: "8px", backgroundColor: "#c0392b", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed" }}>🗑 Zurücksetzen</button>
            <button disabled={!canEdit} onClick={finishMatch} style={{ flex: "1 1 100%", padding: "10px", backgroundColor: "#27ae60", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "14px", opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed" }}>💾 Spiel beenden & Speichern</button>
          </div>

          <hr style={{ margin: "20px 0", borderColor: "#eee" }} />

          <h3 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>📝 Spielbericht</h3>
          {history.length === 0 ? (
            <p style={{ color: "#999", fontSize: "13px" }}>Noch keine Ereignisse.</p>
          ) : (
            <div style={{ textAlign: "left", padding: "10px", borderRadius: "8px", background: "white", border: "1px solid #ddd" }}>
              {[...history].reverse().map((event) => (
                <div key={event.id} style={{ padding: "6px 0", borderBottom: "1px solid #f5f5f5", display: "flex", gap: "10px", alignItems: "center" }}>
                  <span style={{ fontWeight: "bold", width: "30px", color: "#555", fontSize: "13px" }}>{event.minute}'</span>
                  <span style={{ fontSize: "1.2rem" }}>{getEventIcon(event.type)}</span>
                  <span style={{ fontSize: "13px" }}><strong>{event.team === "home" ? homeTeam : awayTeam}</strong>: {event.player}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB: NÄCHSTES SPIEL --- */}
      {activeTab === "next" && (
        <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "left" }}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "5px", textAlign: "center", color: "#2146d0" }}>📅 Nächstes Spiel für {selectedTeam}</h3>
          <p style={{ fontSize: "11px", color: "#666", textAlign: "center", marginBottom: "15px" }}>Trage hier das kommende Spiel ein.</p>
          <form onSubmit={saveNextMatchToCloud}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Art</label>
                <select value={nextIsHome ? "heim" : "auswaerts"} onChange={(e) => setNextIsHome(e.target.value === "heim")} style={{...inputStyle, padding: "8px", cursor: "pointer"}}>
                  <option value="heim">🏠 Heimspiel</option>
                  <option value="auswaerts">🚌 Auswärtsspiel</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Gegner</label>
                <input type="text" value={nextOpponent} onChange={(e) => setNextOpponent(e.target.value)} placeholder="z.B. FC Radolfzell" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Datum</label>
                <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Uhrzeit</label>
                <input type="time" value={nextTime} onChange={(e) => setNextTime(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "4px" }}>Spielort (Optional)</label>
              <input type="text" value={nextLocation} onChange={(e) => setNextLocation(e.target.value)} placeholder="z.B. Kunstrasenplatz Nenzingen" style={inputStyle} />
            </div>
            <button type="submit" style={{ width: "100%", padding: "12px", background: "#2146d0", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}>💾 Nächstes Spiel speichern</button>
          </form>
        </div>
      )}

      {/* --- TAB: KADER --- */}
      {activeTab === "lineup" && (
        <div style={{ background: "#f8f9fa", padding: "12px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "left" }}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "5px", textAlign: "center", color: "#2146d0" }}>📋 Kader für heute ({selectedTeam})</h3>
          {players.length === 0 ? (
            <p style={{ color: "#999", fontSize: "13px", textAlign: "center" }}>Keine Spieler im System.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {players.map((p) => {
                const isInLineup = currentLineup.includes(p);
                return (
                  <div key={p} onClick={() => togglePlayerInLineup(p)} style={{ background: isInLineup ? "#e8f8f5" : "white", border: isInLineup ? "1px solid #27ae60" : "1px solid #ddd", borderRadius: "8px", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                    <span style={{ fontWeight: isInLineup ? "bold" : "normal", color: isInLineup ? "#27ae60" : "#333", fontSize: "14px" }}>{p}</span>
                    <span style={{ fontSize: "16px" }}>{isInLineup ? "✅" : "➕"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- TAB: HISTORIE --- */}
      {activeTab === "history" && (
        <div style={{ background: "#f8f9fa", padding: "12px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "left" }}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "12px", textAlign: "center", color: "#2146d0" }}>🏆 Gespeicherte Spiele ({selectedTeam})</h3>
          {filteredMatches.length === 0 ? (
            <p style={{ color: "#999", fontSize: "13px", textAlign: "center" }}>Noch keine gespeicherten Spiele.</p>
          ) : (
            filteredMatches.map((match) => (
              <div key={match.id} style={{ background: "white", border: "1px solid #ddd", borderRadius: "8px", padding: "10px", marginBottom: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#666", marginBottom: "4px" }}>
                  <span>📅 {match.date}</span>
                  <span onClick={() => setExpandedMatchId(expandedMatchId === match.id ? null : match.id)} style={{ cursor: "pointer", color: "#2980b9", fontWeight: "bold", textDecoration: "underline" }}>
                    {match.history?.length || 0} Ereignisse {expandedMatchId === match.id ? "▲" : "▼"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
                    <button onClick={() => deleteSavedMatch(match.id)} title="Spiel löschen" style={{ background: "transparent", color: "#e74c3c", border: "none", borderRadius: "4px", padding: "2px 4px", cursor: "pointer", fontSize: "14px", flexShrink: 0 }}>🗑</button>
                    <span style={{ fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{match.homeTeam} vs {match.awayTeam}</span>
                  </div>
                  {editingMatchId === match.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                      <input type="number" value={editHomeGoals} onChange={(e) => setEditHomeGoals(e.target.value)} style={{ width: "35px", textAlign: "center", padding: "2px", color: "#333", backgroundColor: "#fff" }} />
                      <span>:</span>
                      <input type="number" value={editAwayGoals} onChange={(e) => setEditAwayGoals(e.target.value)} style={{ width: "35px", textAlign: "center", padding: "2px", color: "#333", backgroundColor: "#fff" }} />
                      <button onClick={() => saveEditedMatch(match.id)} style={{ background: "#27ae60", color: "white", border: "none", borderRadius: "4px", padding: "4px 6px", cursor: "pointer", fontSize: "11px" }}>💾</button>
                      <button onClick={() => setEditingMatchId(null)} style={{ background: "transparent", color: "#7f8c8d", border: "none", padding: "4px 6px", cursor: "pointer", fontSize: "12px" }}>✖</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      <span style={{ fontWeight: "bold", fontSize: "14px", color: "#2146d0" }}>{match.homeGoals} : {match.awayGoals}</span>
                      <button onClick={() => shareMatchToSocialMedia(match)} style={{ background: "#27ae60", color: "white", border: "none", borderRadius: "4px", padding: "4px 6px", cursor: "pointer", fontSize: "11px" }}>📤 Teilen</button>
                      <button onClick={() => startEditingMatch(match)} style={{ background: "#f39c12", color: "white", border: "none", borderRadius: "4px", padding: "4px 6px", cursor: "pointer", fontSize: "11px" }}>✏️</button>
                    </div>
                  )}
                </div>
                {expandedMatchId === match.id && match.history && match.history.length > 0 && (
                  <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed #ccc" }}>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: "12px", color: "#555" }}>Spielverlauf:</h4>
                    {[...match.history].reverse().map((event) => (
                      <div key={event.id} style={{ display: "flex", gap: "8px", alignItems: "center", padding: "3px 0", fontSize: "12px" }}>
                        <span style={{ fontWeight: "bold", width: "25px", color: "#666" }}>{event.minute}'</span>
                        <span style={{ fontSize: "1.1rem" }}>{getEventIcon(event.type)}</span>
                        <span><strong>{event.team === "home" ? match.homeTeam : match.awayTeam}</strong>: {event.player}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}