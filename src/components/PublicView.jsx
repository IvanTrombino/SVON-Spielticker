import React, { useState, useEffect, useRef } from "react";
import logo from "../assets/SVON-Wappen.png";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function PublicView({ clubId, teams, onBackToAdmin }) {
  const [selectedTeam, setSelectedTeam] = useState(teams && teams.length > 0 ? teams[0] : "1. Mannschaft");
  
  // --- Tab-Navigation für die Fans ---
  const [activeTab, setActiveTab] = useState("ticker");

  const [homeTeam, setHomeTeam] = useState("Heim");
  const [awayTeam, setAwayTeam] = useState("Gast");
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState([]);

  const [matchDate, setMatchDate] = useState("");
  const [kickoffTime, setKickoffTime] = useState("");

  // --- Globale Historie für die Fans ---
  const [savedMatches, setSavedMatches] = useState([]);
  const [expandedMatchId, setExpandedMatchId] = useState(null);

  const [wantsNotifications, setWantsNotifications] = useState(false);
  const wantsNotificationsRef = useRef(false); 
  
  const [showInfo, setShowInfo] = useState(false);
  const [copied, setCopied] = useState(false);

  const historyLengthRef = useRef(0);

  // Wenn sich die Teams ändern und das gewählte Team wegfällt, anpassen
  useEffect(() => {
    if (teams && teams.length > 0 && !teams.includes(selectedTeam)) {
      setSelectedTeam(teams[0]);
    }
  }, [teams, selectedTeam]);

  // Beendete Spiele (Historie) für diesen Club laden
  useEffect(() => {
    if (!clubId) return;

    const docName = `${clubId}_matches`;
    const unsubMatches = onSnapshot(doc(db, "ticker", docName), (snap) => {
      if (snap.exists()) {
        setSavedMatches(snap.data().matchesList || []);
      } else {
        setSavedMatches([]);
      }
    });

    return () => unsubMatches();
  }, [clubId]);

  // Live-Spiel für diesen Club & dieses Team laden
  useEffect(() => {
    if (!clubId || !selectedTeam) return;

    const docName = `${clubId}_live_match_${selectedTeam}`;
    const unsubLive = onSnapshot(doc(db, "ticker", docName), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHomeTeam(data.homeTeam !== undefined ? data.homeTeam : selectedTeam);
        setAwayTeam(data.awayTeam !== undefined ? data.awayTeam : "Gast");
        setHomeGoals(data.homeGoals || 0);
        setAwayGoals(data.awayGoals || 0);
        setMatchDate(data.matchDate || "");
        setKickoffTime(data.kickoffTime || "");
        
        const newHistory = data.history || [];
        setHistory(newHistory);

        if (data.isRunning) {
          if (data.startTime) {
            const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
            setTime(elapsed);
          } else if (data.time !== undefined) {
            setTime(data.time);
          }
          setIsRunning(true);
        } else {
          if (data.time !== undefined) setTime(data.time);
          setIsRunning(false);
        }

        if (newHistory.length > historyLengthRef.current && historyLengthRef.current !== 0) {
          if (wantsNotificationsRef.current) {
            const lastEvent = newHistory[newHistory.length - 1];
            triggerNotification(lastEvent, data.homeTeam || selectedTeam, data.awayTeam || "Gast");
          }
        }
        historyLengthRef.current = newHistory.length;

      } else {
        setHomeTeam(selectedTeam);
        setAwayTeam("Gast");
        setHomeGoals(0);
        setAwayGoals(0);
        setHistory([]);
        setTime(0);
        setIsRunning(false);
        setMatchDate("");
        setKickoffTime("");
        historyLengthRef.current = 0;
      }
    });

    return () => unsubLive();
  }, [clubId, selectedTeam]);

  // Lokale Uhr
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

  const getEventIcon = (type) => {
    if (type === "goal") return "⚽";
    if (type === "yellow") return "🟨";
    if (type === "yellowred") return "🟨🟥";
    if (type === "red") return "🟥";
    return "📝";
  };

  const toggleNotifications = () => {
    if (wantsNotifications) {
      setWantsNotifications(false);
      wantsNotificationsRef.current = false;
      return;
    }

    if (!("Notification" in window)) {
      alert("Dein Browser unterstützt Push-Nachrichten nicht direkt.");
      return;
    }

    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        setWantsNotifications(true);
        wantsNotificationsRef.current = true;
        new Notification("Live-Ticker", {
          body: "Benachrichtigungen aktiviert!",
          icon: logo
        });
      } else {
        alert("Du hast die Benachrichtigungen in deinen Browser-Einstellungen blockiert.");
      }
    });
  };

  const triggerNotification = (event, currentHome, currentAway) => {
    if (Notification.permission === "granted") {
      let title = "Live-Ticker";
      let body = "";
      const eventTeam = event.team === "home" ? currentHome : currentAway;

      if (event.type === "goal") {
        title = `⚽ TOOOOR für ${eventTeam}!`;
        body = `Torschütze: ${event.player} (Minute ${event.minute})`;
      } else if (event.type === "yellow") {
        title = `🟨 Gelbe Karte für ${eventTeam}`;
        body = `Spieler: ${event.player} (Minute ${event.minute})`;
      } else if (event.type === "yellowred") {
        title = `🟨🟥 Gelb-Rot für ${eventTeam}`;
        body = `Spieler: ${event.player} (Minute ${event.minute})`;
      } else if (event.type === "red") {
        title = `🟥 Rote Karte für ${eventTeam}`;
        body = `Spieler: ${event.player} (Minute ${event.minute})`;
      }

      new Notification(title, { body, icon: logo });
    }
  };

  const displayDate = matchDate ? new Date(matchDate).toLocaleDateString("de-DE") : "";
  const safeChannelName = `${clubId}${selectedTeam.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(safeChannelName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- FILTER FÜR DIE FANS ---
  const filteredMatches = savedMatches.filter(m => (m.team || (teams && teams[0]) || "1. Mannschaft") === selectedTeam);
  
  // --- DYNAMISCHE TORSCHÜTZEN-BERECHCHNUNG AUS DEN GESPEICHERTEN SPIELEN ---
  const calculatedScorers = {};
  filteredMatches.forEach(match => {
    if (match.history && Array.isArray(match.history)) {
      match.history.forEach(event => {
        if (event.type === "goal") {
          const playerName = event.player;
          if (playerName && playerName !== "Gegner" && playerName !== "Unbekannt") {
            calculatedScorers[playerName] = (calculatedScorers[playerName] || 0) + 1;
          }
        }
      });
    }
  });

  const sortedScorers = Object.entries(calculatedScorers).sort((a, b) => b[1] - a[1]);

  const getFussballDeLink = () => {
    return "https://www.fussball.de";
  };

  const tabButtonStyle = (tabName) => ({
    flex: 1, padding: "8px 4px",
    background: activeTab === tabName ? "#2146d0" : "#e0e0e0",
    color: activeTab === tabName ? "white" : "#333",
    border: "none", borderRadius: "8px", fontWeight: "bold",
    cursor: "pointer", fontSize: "11px"
  });

  return (
    <div style={{ padding: "15px", textAlign: "center", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
      
      {onBackToAdmin && (
        <button 
          onClick={onBackToAdmin} 
          style={{ marginBottom: "15px", padding: "8px 15px", background: "#7f8c8d", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>
          Zurück zum Admin-Modus
        </button>
      )}

      <img src={logo} alt="Logo" style={{ maxWidth: "70px", marginBottom: "10px" }} />
      <h2 style={{ color: "#2146d0", margin: "0 0 5px 0", fontSize: "1.5rem" }}>Live-Ticker</h2>
      <p style={{ color: "#666", fontSize: "12px", marginBottom: "15px" }}>Aktiver Verein: <strong>{clubId.toUpperCase()}</strong></p>
      
      {/* BENACHRICHTIGUNGEN & INFO BEREICH */}
      <div style={{ marginBottom: "15px" }}>
        <button 
          onClick={toggleNotifications}
          style={{ 
            padding: "8px 15px", 
            background: wantsNotifications ? "#e74c3c" : "#f39c12", 
            color: "white", 
            border: "none", 
            borderRadius: "15px", 
            cursor: "pointer", 
            fontSize: "12px", 
            fontWeight: "bold", 
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            marginBottom: "6px"
          }}
        >
          {wantsNotifications ? "🔕 Browser-Benachrichtigungen deaktivieren" : "🔔 Browser-Benachrichtigungen aktivieren"}
        </button>

        <div>
          <button 
            onClick={() => setShowInfo(!showInfo)}
            style={{ background: "transparent", border: "none", color: "#2980b9", textDecoration: "underline", fontSize: "12px", cursor: "pointer" }}
          >
            ℹ️ Echte Push-Benachrichtigungen aufs Handy (Anleitung)
          </button>
        </div>

        {showInfo && (
          <div style={{ background: "#e8f4f8", border: "1px solid #bce0fd", borderRadius: "8px", padding: "15px", marginTop: "10px", textAlign: "left", fontSize: "13px", color: "#333" }}>
            <p style={{ margin: "0 0 8px 0", fontWeight: "bold", color: "#2146d0" }}>
              📱 Push-Alarm für "{selectedTeam}":
            </p>
            <ol style={{ margin: "0 0 12px 0", paddingLeft: "20px", lineHeight: "1.5" }}>
              <li style={{ marginBottom: "6px" }}>Lade dir die kostenlose App <strong>„ntfy“</strong> aus dem App Store oder Play Store herunter.</li>
              <li style={{ marginBottom: "6px" }}>Öffne die App und tippe unten auf das <strong>„+“</strong>.</li>
              <li>Kopiere diesen Kanalnamen und füge ihn ein:</li>
            </ol>

            <div style={{ textAlign: "center", background: "white", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}>
              <div style={{ fontSize: "15px", fontWeight: "bold", fontFamily: "monospace", color: "#2146d0", marginBottom: "8px", background: "#f8f9fa", padding: "6px", borderRadius: "4px", border: "1px dashed #ccc" }}>
                {safeChannelName}
              </div>
              <button 
                onClick={copyToClipboard}
                style={{ background: copied ? "#27ae60" : "#2146d0", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}
              >
                {copied ? "✅ Kopiert!" : "📋 Namen kopieren"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MANNSCHAFTS-AUSWAHL */}
      <div style={{ background: "white", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "15px", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
        <label style={{ display: "block", fontSize: "13px", color: "#555", marginBottom: "6px", fontWeight: "bold", textAlign: "left" }}>
          Mannschaft auswählen:
        </label>
        <select 
          value={selectedTeam} 
          onChange={(e) => setSelectedTeam(e.target.value)}
          style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "15px", background: "#f8f9fa", boxSizing: "border-box" }}
        >
          {(!teams || teams.length === 0) && <option value="1. Mannschaft">1. Mannschaft</option>}
          {teams && teams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* FAN-NAVIGATION (REITER) */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "15px" }}>
        <button onClick={() => setActiveTab("ticker")} style={tabButtonStyle("ticker")}>
          ⏱️ Live-Ticker
        </button>
        <button onClick={() => setActiveTab("scorers")} style={tabButtonStyle("scorers")}>
          🎯 Torschützen
        </button>
        <button onClick={() => setActiveTab("history")} style={tabButtonStyle("history")}>
          📅 Spielplan & Letzte Spiele
        </button>
      </div>

      {/* TAB 1: LIVE-TICKER */}
      {activeTab === "ticker" && (
        <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
          
          {(displayDate || kickoffTime) && (
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "15px", background: "#eee", padding: "6px", borderRadius: "6px", display: "inline-block" }}>
              📅 {displayDate} {kickoffTime && `| ⏱ ${kickoffTime} Uhr`}
            </div>
          )}

          <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#333", marginBottom: "10px" }}>
            {homeTeam} vs {awayTeam}
          </div>

          <div style={{ fontSize: "3.5rem", fontWeight: "bold", margin: "10px 0", lineHeight: "1", color: "#2146d0" }}>
            {homeGoals} : {awayGoals}
          </div>

          <div style={{ fontSize: "1.5rem", fontFamily: "monospace", color: isRunning ? "#27ae60" : (time > 0 ? "#e74c3c" : "#333"), marginBottom: "15px", fontWeight: "bold" }}>
            {formatTime(time)} {isRunning ? "LIVE" : (time > 0 ? "Pause" : "")}
          </div>

          <hr style={{ margin: "20px 0", borderColor: "#eee" }} />

          <h3 style={{ fontSize: "1.1rem", marginBottom: "10px" }}>Spielbericht</h3>
          {history.length === 0 ? (
            <p style={{ color: "#999", fontSize: "14px" }}>Bisher noch keine Ereignisse für dieses Team.</p>
          ) : (
            <div style={{ textAlign: "left", padding: "10px", borderRadius: "8px", background: "white", border: "1px solid #ddd" }}>
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
      )}

      {/* TAB 2: TORSCHÜTZENLISTE */}
      {activeTab === "scorers" && (
        <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "left" }}>
          <h3 style={{ fontSize: "1.2rem", marginBottom: "15px", textAlign: "center", color: "#2146d0" }}>🎯 Torschützen ({selectedTeam})</h3>
          
          {sortedScorers.length === 0 ? (
            <p style={{ color: "#999", fontSize: "14px", textAlign: "center" }}>Bisher noch keine Torschützen in dieser Saison.</p>
          ) : (
            <div style={{ background: "white", borderRadius: "8px", border: "1px solid #ddd", overflow: "hidden" }}>
              {sortedScorers.map(([player, goals], index) => (
                <div key={player} style={{ padding: "10px 15px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", color: "#333" }}>
                    <strong>{index + 1}.</strong> {player}
                  </span>
                  <span style={{ background: "#2146d0", color: "white", padding: "3px 10px", borderRadius: "12px", fontSize: "13px", fontWeight: "bold" }}>
                    ⚽ {goals} {goals === 1 ? "Tor" : "Tore"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SPIELPLAN & LETZTE SPIELE */}
      {activeTab === "history" && (
        <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "left" }}>
          
          <div style={{ marginBottom: "20px", background: "#e8f4f8", border: "1px solid #bce0fd", borderRadius: "10px", padding: "15px", textAlign: "center" }}>
            <p style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "bold", color: "#0056b3" }}>
              📅 Suche nach den nächsten Spielen, Uhrzeiten oder der Tabelle?
            </p>
            <a 
              href={getFussballDeLink()} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: "block",
                padding: "12px",
                background: "#0056b3",
                color: "white",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "bold",
                fontSize: "14px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
              }}
            >
              🌐 Zum offiziellen Spielplan & Tabelle auf Fussball.de
            </a>
          </div>

          <h3 style={{ fontSize: "1.2rem", marginBottom: "15px", textAlign: "center", color: "#2146d0" }}>📜 Letzte Spiele & Ergebnisse ({selectedTeam})</h3>
          
          {filteredMatches.length === 0 ? (
            <p style={{ color: "#999", fontSize: "14px", textAlign: "center" }}>Keine vergangenen Spiele für {selectedTeam} im Ticker gespeichert.</p>
          ) : (
            filteredMatches.map((match) => (
              <div key={match.id} style={{ background: "white", border: "1px solid #ddd", borderRadius: "8px", padding: "12px", marginBottom: "10px" }}>
                
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#666", marginBottom: "6px" }}>
                  <span>📅 {match.date}</span>
                  
                  <span 
                    onClick={() => setExpandedMatchId(expandedMatchId === match.id ? null : match.id)}
                    style={{ cursor: "pointer", color: "#2980b9", fontWeight: "bold", textDecoration: "underline" }}
                  >
                    {match.history?.length || 0} Ereignisse {expandedMatchId === match.id ? "▲" : "▼"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "bold", fontSize: "15px", color: "#333" }}>
                  <span>{match.homeTeam} vs {match.awayTeam}</span>
                  <span style={{ color: "#2146d0", fontSize: "16px" }}>{match.homeGoals} : {match.awayGoals}</span>
                </div>

                {expandedMatchId === match.id && match.history && match.history.length > 0 && (
                  <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed #ccc" }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#555" }}>Spielverlauf:</h4>
                    {[...match.history].reverse().map((event) => (
                      <div key={event.id} style={{ display: "flex", gap: "10px", alignItems: "center", padding: "4px 0", fontSize: "13px" }}>
                        <span style={{ fontWeight: "bold", width: "30px", color: "#666" }}>{event.minute}'</span>
                        <span style={{ fontSize: "1.2rem" }}>{getEventIcon(event.type)}</span>
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