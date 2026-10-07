import React, { useState, useEffect, useRef } from "react";
import logo from "../assets/SVON-Wappen.png";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { findLinkedTeamId, fetchTeamMatches, nextMatchFrom, showsTable, fetchTeamTable } from "../fussballde";

// "2026-10-10" -> "Sa, 10.10.2026"; andere Schreibweisen bleiben unverändert
const formatMatchDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "")
  ? new Date(`${value}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })
  : value;

export default function PublicView({ clubId, teams, onBackToAdmin }) {
  const [selectedTeam, setSelectedTeam] = useState("übersicht"); // Standardmäßig auf Gesamtübersicht starten
  
  // --- Tab-Navigation für die Fans (innerhalb einer Mannschaft) ---
  const [activeTab, setActiveTab] = useState("ticker");

  const [homeTeam, setHomeTeam] = useState("Heim");
  const [awayTeam, setAwayTeam] = useState("Gast");
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState([]);
  
  // NEU: Name des aktuellen Ticker-Schreibers
  const [activeEditor, setActiveEditor] = useState("");

  const [matchDate, setMatchDate] = useState("");
  const [kickoffTime, setKickoffTime] = useState("");

  // --- Globale Daten für alle Teams (Live-Status & Nächste Spiele) ---
  const [allTeamsLiveStatus, setAllTeamsLiveStatus] = useState({});
  const [nextMatches, setNextMatches] = useState({});
  const [overviewNow, setOverviewNow] = useState(Date.now()); // Für die Live-Minute in der Übersicht

  // --- Globale Historie für die Fans ---
  const [savedMatches, setSavedMatches] = useState([]);
  const [expandedMatchId, setExpandedMatchId] = useState(null);

  const [wantsNotifications, setWantsNotifications] = useState(false);
  const wantsNotificationsRef = useRef(false); 
  
  const [showInfo, setShowInfo] = useState(false);
  const [copied, setCopied] = useState(false);

  const historyLengthRef = useRef(0);

  // Interval, um die Live-Minuten in der Gesamtübersicht aktuell zu halten
  useEffect(() => {
    if (selectedTeam === "übersicht") {
      const int = setInterval(() => setOverviewNow(Date.now()), 15000); // Alle 15 Sek. aktualisieren reicht
      return () => clearInterval(int);
    }
  }, [selectedTeam]);

  // 1a. Nächste Spiele automatisch von fussball.de (für verknüpfte Mannschaften)
  const [fussballLinks, setFussballLinks] = useState({});
  const [autoNextMatches, setAutoNextMatches] = useState({});
  const [autoTables, setAutoTables] = useState({}); // { Mannschaft: { league, rows, own } }

  useEffect(() => {
    if (!clubId) return;
    return onSnapshot(doc(db, "ticker", `${clubId}_fussballde`), (snap) => {
      setFussballLinks(snap.exists() ? snap.data().links || {} : {});
    }, () => setFussballLinks({}));
  }, [clubId]);

  useEffect(() => {
    if (!teams || teams.length === 0 || Object.keys(fussballLinks).length === 0) return;
    let cancelled = false;
    const load = async () => {
      // Tabellen (nur D-Jugend bis 1. Mannschaft)
      Promise.all(teams.filter(showsTable).map(async (teamName) => {
        const teamId = findLinkedTeamId(fussballLinks, teamName);
        if (!teamId) return null;
        try {
          const table = await fetchTeamTable(teamId);
          return table ? [teamName, table] : null;
        } catch (error) {
          console.error(`fussball.de Tabelle (${teamName}):`, error);
          return null;
        }
      })).then(entries => { if (!cancelled) setAutoTables(Object.fromEntries(entries.filter(Boolean))); });

      const entries = await Promise.all(teams.map(async (teamName) => {
        const teamId = findLinkedTeamId(fussballLinks, teamName);
        if (!teamId) return null;
        try {
          const next = nextMatchFrom(await fetchTeamMatches(teamId));
          return next ? [teamName, next] : null;
        } catch (error) {
          console.error(`fussball.de (${teamName}):`, error);
          return null;
        }
      }));
      if (!cancelled) setAutoNextMatches(Object.fromEntries(entries.filter(Boolean)));
    };
    load();
    const interval = setInterval(load, 30 * 60 * 1000); // alle 30 Minuten aktualisieren
    return () => { cancelled = true; clearInterval(interval); };
  }, [teams, fussballLinks]);

  // 1b. Von Hand eingetragene nächste Spiele (${clubId}_next_matches) – für nicht verknüpfte Mannschaften
  useEffect(() => {
    if (!clubId) return;
    const unsubNext = onSnapshot(doc(db, "ticker", `${clubId}_next_matches`), (snap) => {
      if (snap.exists()) {
        setNextMatches(snap.data() || {});
      } else {
        setNextMatches({});
      }
    });
    return () => unsubNext();
  }, [clubId]);

  // 2. Live-Status für ALLE Mannschaften gleichzeitig überwachen (für die Übersicht)
  useEffect(() => {
    if (!clubId || !teams || teams.length === 0) return;

    const unsubList = teams.map((teamName) => {
      const docName = `${clubId}_live_match_${teamName}`;
      return onSnapshot(doc(db, "ticker", docName), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAllTeamsLiveStatus((prev) => ({
            ...prev,
            [teamName]: {
              isRunning: data.isRunning || false,
              homeTeam: data.homeTeam || teamName,
              awayTeam: data.awayTeam || "Gast",
              homeGoals: data.homeGoals || 0,
              awayGoals: data.awayGoals || 0,
              time: data.time || 0,
              startTime: data.startTime || null
            }
          }));
        }
      });
    });

    return () => {
      unsubList.forEach((unsub) => unsub());
    };
  }, [clubId, teams]);

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

  // Live-Spiel für das AKTUELL ausgewählte Team laden (Detailansicht)
  useEffect(() => {
    if (!clubId || selectedTeam === "übersicht") return;

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
        
        // Den Namen des aktuellen Ticker-Schreibers auslesen
        setActiveEditor(data.activeEditor || "");
        
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
        setActiveEditor("");
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
  const safeChannelName = selectedTeam !== "übersicht" ? `${clubId}${selectedTeam.toLowerCase().replace(/[^a-z0-9]/g, "")}` : clubId;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(safeChannelName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- FILTER FÜR DIE FANS ---
  const filteredMatches = selectedTeam !== "übersicht" ? savedMatches.filter(m => (m.team || (teams && teams[0]) || "1. Mannschaft") === selectedTeam) : [];
  
  // --- DYNAMISCHE TORSCHÜTZEN-BERECHCHNUNG ---
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
    return "https://www.fussball.de/verein/sv-orsingen-nenzingen-suedbaden/-/id/00ES8GN9F000000RVV0AG08LVUPGND5I#!/";
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
      
      <img src={logo} alt="Logo" style={{ maxWidth: "70px", marginBottom: "10px" }} />
      <h2 style={{ color: "#2146d0", margin: "0 0 5px 0", fontSize: "1.5rem" }}>Live-Ticker</h2>
      <p style={{ color: "#666", fontSize: "12px", marginBottom: "15px" }}>Aktiver Verein: <strong>{clubId.toUpperCase()}</strong></p>
      
      {/* MANNSCHAFTS-AUSWAHL (Inklusive Gesamtübersicht & Dark-Mode Fix) */}
      <div style={{ background: "white", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "15px", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
        <label style={{ display: "block", fontSize: "13px", color: "#555", marginBottom: "6px", fontWeight: "bold", textAlign: "left" }}>
          Ansicht / Mannschaft wählen:
        </label>
        <select 
          value={selectedTeam} 
          onChange={(e) => { setSelectedTeam(e.target.value); setActiveTab("ticker"); }}
          style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "15px", backgroundColor: "#f8f9fa", color: "#333", boxSizing: "border-box", fontWeight: "bold" }}
        >
          <option value="übersicht">📊 Gesamtübersicht (Aktive & Nächste Spiele)</option>
          {teams && teams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* --- GESAMTÜBERSICHT (DASHBOARD) --- */}
      {selectedTeam === "übersicht" && (
        <div style={{ textAlign: "left" }}>
          
          {/* AKTIVE / LIVE SPIELE */}
          <div style={{ background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: "12px", padding: "15px", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "1.1rem", color: "#c53030", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              🔴 Aktive Live-Spiele
            </h3>
            {Object.entries(allTeamsLiveStatus).filter(([_, status]) => status.isRunning || status.time > 0).length === 0 ? (
              <p style={{ color: "#718096", fontSize: "13px", margin: "0" }}>Aktuell findet kein Live-Spiel statt.</p>
            ) : (
              Object.entries(allTeamsLiveStatus)
                .filter(([_, status]) => status.isRunning || status.time > 0)
                .map(([teamName, status]) => {
                  // Spielminute berechnen
                  const matchMinute = status.startTime 
                    ? Math.floor((overviewNow - status.startTime) / 60000) + 1 
                    : Math.floor((status.time || 0) / 60);

                  const isPaused = !status.isRunning && status.time > 0;
                  const isHalftime = isPaused && status.time === 45 * 60;
                  
                  // Text für die Anzeige generieren
                  const timeText = isHalftime ? "⏸ Halbzeit" : isPaused ? "⏸ Pause" : `⏱ ${matchMinute}. Min`;

                  return (
                    <div key={teamName} onClick={() => setSelectedTeam(teamName)} style={{ background: "white", padding: "12px", borderRadius: "8px", border: "1px solid #fc8181", cursor: "pointer", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                      <div>
                        <span style={{ fontSize: "11px", background: "#e53e3e", color: "white", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>{teamName}</span>
                        <div style={{ fontWeight: "bold", fontSize: "14px", marginTop: "4px" }}>{status.homeTeam} vs {status.awayTeam}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#e53e3e" }}>
                          {status.homeGoals} : {status.awayGoals} ➔
                        </div>
                        <div style={{ fontSize: "11px", color: "#c53030", fontWeight: "bold", marginTop: "2px" }}>
                          {timeText}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          {/* NÄCHSTE SPIELE */}
          <div style={{ background: "#f8f9fa", border: "1px solid #ddd", borderRadius: "12px", padding: "15px", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "1.1rem", color: "#2146d0", margin: "0 0 12px 0" }}>
              📅 Nächste Spiele
            </h3>
            {(!teams || teams.length === 0) ? (
              <p style={{ color: "#777", fontSize: "13px" }}>Keine Mannschaften vorhanden.</p>
            ) : (
              teams
                // Blende "E-Jugend Funino" und "F-Jugend Funino" aus der Liste aus
                .filter(t => t !== "E-Jugend Funino" && t !== "F-Jugend Funino")
                .map((teamName) => {
                  // fussball.de hat Vorrang, sonst von Hand eingetragen
                  const nextMatch = autoNextMatches[teamName] || nextMatches[teamName];
                  return (
                    <div key={teamName} style={{ background: "white", padding: "12px", borderRadius: "8px", border: "1px solid #e0e0e0", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                      <div style={{ flex: 1, paddingRight: "10px" }}>
                        <strong style={{ fontSize: "14px", color: "#2146d0", display: "block", marginBottom: "4px" }}>{teamName}</strong>
                        {autoTables[teamName]?.own && (
                          <div style={{ fontSize: "11px", color: "#7a6609", background: "#fef9e7", border: "1px solid #f7dc6f", borderRadius: "4px", padding: "2px 6px", display: "inline-block", marginBottom: "4px" }}>
                            🏆 {autoTables[teamName].own.rank}. Platz · {autoTables[teamName].own.points} Pkt.{autoTables[teamName].league ? ` · ${autoTables[teamName].league}` : ""}
                          </div>
                        )}
                        
                        <div style={{ fontSize: "13px", color: "#333", fontWeight: "bold", marginBottom: "4px" }}>
                          {nextMatch?.opponent ? (
                            <>
                              {nextMatch.isHome ? "Heimspiel gegen " : "Auswärtsspiel gegen "}
                              {nextMatch.opponent}
                            </>
                          ) : "Gegner noch offen"}
                        </div>

                        {nextMatch?.location && (
                          <div style={{ fontSize: "11px", color: "#666", display: "flex", alignItems: "center", gap: "4px" }}>
                            Spielort: {nextMatch.location}
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: "12px", color: "#555", textAlign: "right", whiteSpace: "nowrap" }}>
                        {nextMatch?.date && <div style={{ marginBottom: "2px", fontWeight: "bold" }}>{formatMatchDate(nextMatch.date)}</div>}
                        {nextMatch?.time && <div>⏱️ {nextMatch.time} Uhr</div>}
                        {!nextMatch?.date && !nextMatch?.time && <span style={{ fontStyle: "italic", color: "#999", fontSize: "11px" }}>Kein Termin</span>}
                        {nextMatch?.competition && <div style={{ fontSize: "10px", color: "#999", marginTop: "2px" }}>{nextMatch.competition}</div>}
                      </div>
                    </div>
                  );
              })
            )}
          </div>

          {/* OFFIZIELLER FUSSBALL.DE LINK */}
          <div style={{ background: "#e8f4f8", border: "1px solid #bce0fd", borderRadius: "10px", padding: "15px", textAlign: "center" }}>
            <a 
              href={getFussballDeLink()} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: "block", padding: "12px", background: "#0056b3", color: "white", borderRadius: "8px", textDecoration: "none", fontWeight: "bold", fontSize: "14px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
            >
              🌐 Zum offiziellen Spielplan & Tabelle auf Fussball.de
            </a>
          </div>

        </div>
      )}

      {/* --- DETAILANSICHT FÜR EINE AUSGEWÄHLTE MANNSCHAFT --- */}
      {selectedTeam !== "übersicht" && (
        <>
          {/* FAN-NAVIGATION (REITER) */}
          <div style={{ display: "flex", gap: "5px", marginBottom: "15px" }}>
            <button onClick={() => setActiveTab("ticker")} style={tabButtonStyle("ticker")}>
              ⏱️ Live-Ticker
            </button>
            <button onClick={() => setActiveTab("scorers")} style={tabButtonStyle("scorers")}>
              🎯 Torschützen
            </button>
            <button onClick={() => setActiveTab("history")} style={tabButtonStyle("history")}>
              📅 Letzte Spiele
            </button>
            {autoTables[selectedTeam] && (
              <button onClick={() => setActiveTab("table")} style={tabButtonStyle("table")}>
                📊 Tabelle
              </button>
            )}
          </div>

          {/* TAB 4: TABELLE (von fussball.de) */}
          {activeTab === "table" && autoTables[selectedTeam] && (
            <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "left" }}>
              <h3 style={{ fontSize: "1.1rem", margin: "0 0 4px 0", textAlign: "center", color: "#2146d0" }}>📊 {autoTables[selectedTeam].league || "Tabelle"}</h3>
              <p style={{ fontSize: "11px", color: "#888", textAlign: "center", margin: "0 0 12px 0" }}>Quelle: fussball.de</p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ color: "#666", fontSize: "11px", textAlign: "center" }}>
                      <th style={{ padding: "6px 4px" }}>Pl.</th>
                      <th style={{ padding: "6px 4px", textAlign: "left" }}>Mannschaft</th>
                      <th style={{ padding: "6px 4px" }}>Sp.</th>
                      <th style={{ padding: "6px 4px" }}>Tore</th>
                      <th style={{ padding: "6px 4px" }}>Diff.</th>
                      <th style={{ padding: "6px 4px" }}>Pkt.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoTables[selectedTeam].rows.map((row, i) => (
                      <tr key={`${row.rank}-${row.team}`} style={{ background: row.own ? "#dbeafe" : i % 2 === 0 ? "white" : "#f4f6f8", fontWeight: row.own ? "bold" : "normal", textAlign: "center" }}>
                        <td style={{ padding: "6px 4px" }}>{row.rank}.</td>
                        <td style={{ padding: "6px 4px", textAlign: "left" }}>{row.team}</td>
                        <td style={{ padding: "6px 4px" }}>{row.played}</td>
                        <td style={{ padding: "6px 4px", whiteSpace: "nowrap" }}>{row.goals}</td>
                        <td style={{ padding: "6px 4px" }}>{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
                        <td style={{ padding: "6px 4px" }}>{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 1: LIVE-TICKER */}
          {activeTab === "ticker" && (
            <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
              
              {/* ANZEIGE: WER BEDIENt DEN TICKER? */}
              {activeEditor && (
                <div style={{ fontSize: "12px", color: "#155724", backgroundColor: "#d4edda", padding: "8px 12px", borderRadius: "6px", marginBottom: "15px", border: "1px solid #c3e6cb", display: "inline-block" }}>
                  ✏️ Ticker wird live bedient von: <strong>{activeEditor}</strong>
                </div>
              )}

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

          {/* TAB 3: LETZTE SPIELE */}
          {activeTab === "history" && (
            <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "left" }}>
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
        </>
      )}

    </div>
  );
}