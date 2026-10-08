import { useState, useEffect } from "react";
import { collection, query, where, getDoc, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { db } from "../firebase";
import PitchManager from "./PitchManager"; // <-- NEU: Import für die Platzbelegung
import TickerAdmin from "./TickerAdmin";
import { getOrCreateDailyCode } from "../tickerCode";
import { compareTeamNames } from "../teamOrder";

export default function CoachPortal({ clubId, tickerTeams = [] }) {
  // --- LOGIN STATES ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggedInCoach, setLoggedInCoach] = useState(null);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- APP STATES ---
  const [activeTab, setActiveTab] = useState("team");
  const [teamPlayers, setTeamPlayers] = useState([]);
  
  // --- TEAMAUSWAHL STATES ---
  const [availableTeams, setAvailableTeams] = useState([]); 
  const [selectedTeam, setSelectedTeam] = useState(""); 

  // --- ATTENDANCE STATES ---
  const [trainingDate, setTrainingDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceRecords, setAttendanceRecords] = useState({}); 
  const [isSavingTraining, setIsSavingTraining] = useState(false);
  const [pastTrainings, setPastTrainings] = useState([]);
  const [editingTrainingId, setEditingTrainingId] = useState(null);
  const [expandedTrainingId, setExpandedTrainingId] = useState(null);

  // --- TICKER-TAGESCODE ---
  const [tickerCode, setTickerCode] = useState(null);
  const [tickerCodeError, setTickerCodeError] = useState("");

  const auth = getAuth();

  // --- 1. LOGIN LOGIK ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;
      
      const coachDocRef = doc(db, "youth_coaches", uid);
      const coachSnap = await getDoc(coachDocRef);

      if (coachSnap.exists()) {
        const coachData = coachSnap.data();
        setLoggedInCoach({ id: coachSnap.id, ...coachData });
      } else {
        setLoginError("Trainer-Profil in der Datenbank nicht gefunden (UID stimmt nicht überein).");
        auth.signOut();
      }
    } catch (error) {
      console.error("Login Fehler:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
         setLoginError("E-Mail oder Passwort ist falsch.");
      } else {
         setLoginError("Fehler beim Login. Bitte später versuchen.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setLoginError("Bitte trage zuerst deine E-Mail-Adresse oben ein.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      alert("Eine E-Mail zum Zurücksetzen des Passworts wurde an " + email + " gesendet. Bitte prüfe auch deinen Spam-Ordner.");
      setLoginError("");
    } catch (error) {
      console.error("Fehler beim Passwort-Reset:", error);
      setLoginError("Fehler beim Senden der Reset-E-Mail.");
    }
  };

  // Tagescode für den Live-Ticker laden bzw. erzeugen, sobald ein Trainer eingeloggt ist
  useEffect(() => {
    if (!loggedInCoach || !clubId) return;
    getOrCreateDailyCode(clubId)
      .then((code) => { setTickerCode(code); setTickerCodeError(""); })
      .catch((error) => {
        console.error("Fehler beim Laden des Ticker-Codes:", error);
        setTickerCodeError("Ticker-Code konnte nicht geladen werden.");
      });
  }, [loggedInCoach, clubId]);

  const tickerCodeValidUntil = tickerCode
    ? tickerCode.expiresAt.toDate().toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

  const shareTickerCode = () => {
    const text = `⚽ Live-Ticker ${clubId.toUpperCase()}\nDein Ticker-Code: ${tickerCode.code}\nGültig bis ${tickerCodeValidUntil} Uhr\n\nHier eingeben: ${window.location.origin}/#${clubId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleLogout = () => {
    auth.signOut();
    setLoggedInCoach(null);
    setEmail("");
    setPassword("");
    setTeamPlayers([]);
    setSelectedTeam("");
  };

  // --- HILFSVARIABLEN FÜR RECHTE & FALLBACK-TEAMS ---
  const isJugendleitung = loggedInCoach?.assignedTeams?.includes("Jugendleitung") || false;
  
  const fallbackTeams = [
    { id: "0", name: "Aktive" },
    { id: "1", name: "A-Jugend" },
    { id: "2", name: "B-Jugend" },
    { id: "3", name: "C-Jugend" },
    { id: "4", name: "D-Jugend" },
    { id: "5", name: "E-Jugend" },
    { id: "6", name: "F-Jugend" },
    { id: "7", name: "G-Jugend" }
  ];

  const currentTeamOptions = isJugendleitung 
    ? (availableTeams.length > 0 ? availableTeams : fallbackTeams)
    : (loggedInCoach?.assignedTeams?.filter(t => t !== "Jugendleitung").sort(compareTeamNames).map(name => ({ id: name, name })) || []);

  // Live-Ticker: Jugendleitung verwaltet alle Ticker-Teams, Trainer nur ihre eigenen
  const coachTickerTeams = (isJugendleitung
    ? tickerTeams
    : tickerTeams.filter(t => loggedInCoach?.assignedTeams?.includes(t))
  ).slice().sort(compareTeamNames);

  const activeViewTeam = selectedTeam || (currentTeamOptions[0]?.name ?? "");

  // --- 2. TEAMS LADEN ---
  useEffect(() => {
    if (!clubId || !loggedInCoach) return;
    
    const unsub = onSnapshot(doc(db, "youth_settings", clubId), (docSnap) => {
      let loadedTeams;
      if (docSnap.exists() && docSnap.data().teams && docSnap.data().teams.length > 0) {
        loadedTeams = [...docSnap.data().teams].sort((a, b) => compareTeamNames(a.name, b.name));
      } else {
        loadedTeams = fallbackTeams;
      }
      
      setAvailableTeams(loadedTeams);

      if (!selectedTeam) {
        if (isJugendleitung && loadedTeams.length > 0) {
          setSelectedTeam(loadedTeams[0].name);
        } else if (!isJugendleitung && loggedInCoach.assignedTeams && loggedInCoach.assignedTeams.length > 0) {
          const firstRealTeam = loggedInCoach.assignedTeams.find(t => t !== "Jugendleitung");
          if (firstRealTeam) setSelectedTeam(firstRealTeam);
        }
      }
    }, (error) => {
      console.error("Fehler beim Laden der Teams:", error);
      setAvailableTeams(fallbackTeams);
      if (!selectedTeam) setSelectedTeam(fallbackTeams[0].name);
    });

    return () => unsub();
  }, [clubId, loggedInCoach, isJugendleitung, selectedTeam]);

  // --- 3. SPIELER & TRAININGS LADEN ---
  useEffect(() => {
    if (!loggedInCoach || !activeViewTeam) return;

    const qPlayers = query(
      collection(db, "youth_players"), 
      where("clubId", "==", clubId),
      where("youthTeam", "==", activeViewTeam),
      where("status", "==", "aktiv")
    );

    const unsubPlayers = onSnapshot(qPlayers, (snapshot) => {
      const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      players.sort((a, b) => {
        const nameA = (a.lastName || "").toLowerCase();
        const nameB = (b.lastName || "").toLowerCase();
        if (nameA === nameB) return (a.firstName || "").localeCompare(b.firstName || "");
        return nameA.localeCompare(nameB);
      });
      setTeamPlayers(players);

      if (!editingTrainingId) {
        const initialAttendance = {};
        players.forEach(p => initialAttendance[p.id] = "anwesend");
        setAttendanceRecords(initialAttendance);
      }
    });

    const qTrainings = query(
      collection(db, "youth_trainings"),
      where("clubId", "==", clubId),
      where("team", "==", activeViewTeam)
    );

    const unsubTrainings = onSnapshot(qTrainings, (snapshot) => {
      const trainings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      trainings.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPastTrainings(trainings);
    });

    return () => {
      unsubPlayers();
      unsubTrainings();
    };
  }, [loggedInCoach, clubId, activeViewTeam, editingTrainingId]);

  // --- 4. TRAININGS-ANWESENHEIT LOGIK ---
  const handleAttendanceChange = (playerId, status) => {
    setAttendanceRecords(prev => ({ ...prev, [playerId]: status }));
  };

  const startEditingTraining = (training) => {
    setEditingTrainingId(training.id);
    setTrainingDate(training.date);
    
    const loadedAttendance = { ...training.attendance };
    teamPlayers.forEach(p => {
      if (!loadedAttendance[p.id]) loadedAttendance[p.id] = "anwesend";
    });
    setAttendanceRecords(loadedAttendance);
    window.scrollTo(0, 0);
  };

  const cancelEditing = () => {
    setEditingTrainingId(null);
    setTrainingDate(new Date().toISOString().split("T")[0]);
    const initialAttendance = {};
    teamPlayers.forEach(p => initialAttendance[p.id] = "anwesend");
    setAttendanceRecords(initialAttendance);
  };

  const deleteTrainingSession = async (trainingId) => {
    if (!window.confirm("Möchtest du diese Trainingseinheit wirklich löschen?")) return;
    
    try {
      await deleteDoc(doc(db, "youth_trainings", trainingId));
      if (editingTrainingId === trainingId) cancelEditing();
      alert("Training erfolgreich gelöscht!");
    } catch (error) {
      console.error(error);
      alert("Fehler beim Löschen des Trainings.");
    }
  };

  const saveTrainingSession = async () => {
    if (teamPlayers.length === 0) return alert("Keine Spieler in der Mannschaft vorhanden.");
    
    setIsSavingTraining(true);
    try {
      const presentCount = Object.values(attendanceRecords).filter(s => s === "anwesend").length;
      
      const payload = {
        clubId,
        team: activeViewTeam,
        date: trainingDate,
        coachId: loggedInCoach.id,
        coachName: `${loggedInCoach.firstName} ${loggedInCoach.lastName}`,
        attendance: attendanceRecords,
        presentCount,
        totalPlayers: teamPlayers.length,
      };

      if (editingTrainingId) {
        await updateDoc(doc(db, "youth_trainings", editingTrainingId), payload);
        alert("Trainingseinheit erfolgreich aktualisiert!");
        cancelEditing();
      } else {
        await addDoc(collection(db, "youth_trainings"), { ...payload, createdAt: serverTimestamp() });
        alert("Neues Training erfolgreich gespeichert!");
        const initialAttendance = {};
        teamPlayers.forEach(p => initialAttendance[p.id] = "anwesend");
        setAttendanceRecords(initialAttendance);
      }
    } catch (error) {
      console.error(error);
      alert("Fehler beim Speichern der Trainingseinheit.");
    } finally {
      setIsSavingTraining(false);
    }
  };

  // --- 5. STATISTIK BERECHNEN ---
  const getPlayerStats = () => {
    const stats = teamPlayers.map(player => {
      let anwesend = 0, entschuldigt = 0, unentschuldigt = 0;
      let total = pastTrainings.length;

      pastTrainings.forEach(t => {
        const status = t.attendance[player.id];
        if (status === "anwesend") anwesend++;
        else if (status === "entschuldigt") entschuldigt++;
        else if (status === "unentschuldigt") unentschuldigt++;
      });

      const rate = total > 0 ? Math.round((anwesend / total) * 100) : 0;
      return { ...player, anwesend, entschuldigt, unentschuldigt, total, rate };
    });

    return stats.sort((a, b) => b.rate - a.rate);
  };

  // --- RENDER: LOGIN BILDSCHIRM ---
  if (!loggedInCoach) {
    return (
      <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif", color: "#333", boxSizing: "border-box" }}>
        <div style={{ background: "white", padding: "30px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)", textAlign: "center" }}>
          <h2 style={{ color: "#2146d0", marginTop: 0 }}>⚽ Trainer-Login</h2>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>Melde dich an, um deine Mannschaft zu verwalten.</p>
          
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <input type="email" placeholder="E-Mail Adresse" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "15px", width: "100%", boxSizing: "border-box" }} />
            <input type="password" placeholder="Passwort" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "15px", width: "100%", boxSizing: "border-box" }} />
            {loginError && <div style={{ color: "#e74c3c", fontSize: "13px", fontWeight: "bold" }}>{loginError}</div>}
            
            <button type="submit" disabled={isLoggingIn} style={{ padding: "12px", background: "#2146d0", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: isLoggingIn ? "not-allowed" : "pointer" }}>
              {isLoggingIn ? "Prüfe..." : "Einloggen"}
            </button>
          </form>

          <button type="button" onClick={handleResetPassword} style={{ marginTop: "15px", background: "transparent", color: "#2980b9", border: "none", fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}>
            Passwort vergessen?
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER: TRAINER PORTAL ---
  const tabButton = (id, icon, label) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      style={{ flex: 1, padding: "12px 10px", border: "none", borderRadius: "8px", background: activeTab === id ? "#2146d0" : "#e0e7ff", color: activeTab === id ? "white" : "#3730a3", fontWeight: "bold", cursor: "pointer", fontSize: "14px", transition: "all 0.2s" }}
    >
      {icon} {label}
    </button>
  );

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "15px", fontFamily: "sans-serif", color: "#333", boxSizing: "border-box" }}>
      
      {/* HEADERBAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <h2 style={{ margin: 0, color: "#2146d0", fontSize: "18px" }}>👋 Hallo, {loggedInCoach.firstName}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
            <span style={{ fontSize: "13px", color: "#555", fontWeight: "bold" }}>Ansicht:</span>
            {currentTeamOptions.length > 0 ? (
              <select value={selectedTeam} onChange={(e) => { setSelectedTeam(e.target.value); cancelEditing(); }} style={{ padding: "6px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", fontWeight: "bold", color: "#34495e" }}>
                {currentTeamOptions.map(t => <option key={t.id || t.name} value={t.name}>{t.name}</option>)}
              </select>
            ) : (
              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#e74c3c" }}>Kein Team verfügbar</span>
            )}
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "6px", padding: "8px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>Abmelden</button>
      </div>

      {/* TICKER-TAGESCODE */}
      <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", padding: "12px 15px", borderRadius: "10px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ fontSize: "12px", fontWeight: "bold", color: "#3730a3" }}>⚽ Live-Ticker Code für heute</div>
          {tickerCode ? (
            <>
              <div style={{ fontSize: "24px", fontWeight: "bold", letterSpacing: "3px", color: "#2146d0", fontFamily: "monospace" }}>{tickerCode.code}</div>
              <div style={{ fontSize: "11px", color: "#666" }}>Gültig bis {tickerCodeValidUntil} Uhr · für alle Teams</div>
            </>
          ) : (
            <div style={{ fontSize: "13px", color: tickerCodeError ? "#e74c3c" : "#666" }}>{tickerCodeError || "Wird geladen..."}</div>
          )}
        </div>
        {tickerCode && (
          <button onClick={shareTickerCode} style={{ background: "#25d366", color: "white", border: "none", borderRadius: "6px", padding: "8px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
            📤 Per WhatsApp teilen
          </button>
        )}
      </div>

      {/* NAVIGATION */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {tabButton("team", "👦", "Mein Team")}
        {tabButton("attendance", "📋", "Trainingserfassung")}
        {tabButton("stats", "📊", "Statistik")}
        {/* NEU: PLATZBELEGUNG BUTTON */}
        {tabButton("pitches", "🏟️", "Plätze")}
        {tabButton("ticker", "⚽", "Live-Ticker")}
      </div>

      {/* INHALTE JE NACH TAB */}
      {activeTab === "team" && (
        <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <h3 style={{ marginTop: 0, color: "#34495e", borderBottom: "2px solid #eee", paddingBottom: "8px", fontSize: "16px" }}>Spielerliste ({teamPlayers.length})</h3>
          {teamPlayers.length === 0 ? <p style={{ color: "#777", textAlign: "center" }}>Dieser Mannschaft sind aktuell keine Spieler zugewiesen.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                <thead style={{ background: "#2146d0", color: "white" }}>
                  <tr>
                    <th style={{ padding: "10px", textAlign: "left", fontSize: "13px" }}>Name</th>
                    <th style={{ padding: "10px", textAlign: "center", fontSize: "13px" }}>Jg.</th>
                    <th style={{ padding: "10px", textAlign: "left", fontSize: "13px" }}>Kontakt Papa</th>
                    <th style={{ padding: "10px", textAlign: "left", fontSize: "13px" }}>Kontakt Mama</th>
                    <th style={{ padding: "10px", textAlign: "left", fontSize: "13px" }}>Wichtige Hinweise</th>
                  </tr>
                </thead>
                <tbody>
                  {teamPlayers.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#f8f9fa" }}>
                      <td style={{ padding: "10px", fontWeight: "bold", color: "#2c3e50", fontSize: "14px" }}>{p.lastName}, {p.firstName}</td>
                      <td style={{ padding: "10px", textAlign: "center", color: "#555", fontSize: "13px" }}>{p.birthYear || "?"}</td>
                      <td style={{ padding: "10px", fontSize: "13px" }}>{p.fatherName ? <div>{p.fatherName}<br/><a href={`tel:${p.fatherPhone}`} style={{ color: "#2980b9", textDecoration: "none", fontWeight: "bold" }}>{p.fatherPhone}</a></div> : "-"}</td>
                      <td style={{ padding: "10px", fontSize: "13px" }}>{p.motherName ? <div>{p.motherName}<br/><a href={`tel:${p.motherPhone}`} style={{ color: "#2980b9", textDecoration: "none", fontWeight: "bold" }}>{p.motherPhone}</a></div> : "-"}</td>
                      <td style={{ padding: "10px", fontSize: "12px", color: "#c0392b", fontWeight: p.medicalComment ? "bold" : "normal" }}>{p.medicalComment || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "attendance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: editingTrainingId ? "2px solid #f39c12" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #eee", paddingBottom: "10px", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
              <h3 style={{ margin: 0, color: editingTrainingId ? "#f39c12" : "#27ae60", fontSize: "16px" }}>{editingTrainingId ? "✏️ Training bearbeiten" : "Neues Training erfassen"}</h3>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input type="date" value={trainingDate} onChange={e => setTrainingDate(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontWeight: "bold", color: "#333" }} />
                {editingTrainingId && <button onClick={cancelEditing} style={{ background: "#95a5a6", color: "white", border: "none", borderRadius: "6px", padding: "8px", cursor: "pointer", fontWeight: "bold" }}>Abbrechen</button>}
              </div>
            </div>

            {teamPlayers.length === 0 ? <p style={{ color: "#777" }}>Keine Spieler vorhanden.</p> : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                  {teamPlayers.map(p => {
                    const status = attendanceRecords[p.id];
                    return (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8f9fa", padding: "10px", borderRadius: "8px", border: "1px solid #eee", flexWrap: "wrap", gap: "10px" }}>
                        <span style={{ fontWeight: "bold", color: "#333", fontSize: "14px" }}>{p.lastName}, {p.firstName}</span>
                        <div style={{ display: "flex", gap: "5px" }}>
                          <button onClick={() => handleAttendanceChange(p.id, "anwesend")} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: "bold", cursor: "pointer", background: status === "anwesend" ? "#27ae60" : "#ecf0f1", color: status === "anwesend" ? "white" : "#7f8c8d" }}>✅ Da</button>
                          <button onClick={() => handleAttendanceChange(p.id, "entschuldigt")} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: "bold", cursor: "pointer", background: status === "entschuldigt" ? "#f39c12" : "#ecf0f1", color: status === "entschuldigt" ? "white" : "#7f8c8d" }}>⚠️ Entsch.</button>
                          <button onClick={() => handleAttendanceChange(p.id, "unentschuldigt")} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: "bold", cursor: "pointer", background: status === "unentschuldigt" ? "#e74c3c" : "#ecf0f1", color: status === "unentschuldigt" ? "white" : "#7f8c8d" }}>❌ Fehlt</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={saveTrainingSession} disabled={isSavingTraining} style={{ width: "100%", padding: "14px", background: editingTrainingId ? "#f39c12" : "#27ae60", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: isSavingTraining ? "not-allowed" : "pointer" }}>
                  {isSavingTraining ? "Wird gespeichert..." : (editingTrainingId ? "💾 Änderungen speichern" : "💾 Trainingseinheit speichern")}
                </button>
              </>
            )}
          </div>

          <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: 0, color: "#34495e", borderBottom: "2px solid #eee", paddingBottom: "8px", fontSize: "16px" }}>Letzte Trainingseinheiten</h3>
            {pastTrainings.length === 0 ? <p style={{ color: "#777", fontSize: "13px" }}>Noch keine Trainings erfasst.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {pastTrainings.map(t => {
                  const isExpanded = expandedTrainingId === t.id;
                  const presentPlayers = [], excusedPlayers = [], missingPlayers = [];
                  
                  Object.entries(t.attendance || {}).forEach(([playerId, status]) => {
                    const player = teamPlayers.find(p => p.id === playerId);
                    if (player) {
                      if (status === "anwesend") presentPlayers.push(player.firstName);
                      if (status === "entschuldigt") excusedPlayers.push(player.firstName);
                      if (status === "unentschuldigt") missingPlayers.push(player.firstName);
                    }
                  });

                  return (
                    <div key={t.id} style={{ background: "#eef2ff", borderRadius: "8px", border: "1px solid #c7d2fe", overflow: "hidden" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px" }}>
                        <div>
                          <div style={{ fontWeight: "bold", color: "#2146d0" }}>📅 {new Date(t.date).toLocaleDateString("de-DE")}</div>
                          <div style={{ fontSize: "12px", color: "#555" }}>Erfasst von: {t.coachName}</div>
                        </div>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <div style={{ textAlign: "right", marginRight: "10px" }}>
                            <div style={{ fontWeight: "bold", color: "#27ae60", fontSize: "15px" }}>{t.presentCount} / {t.totalPlayers}</div>
                            <div style={{ fontSize: "11px", color: "#777" }}>Anwesend</div>
                          </div>
                          <button onClick={() => setExpandedTrainingId(isExpanded ? null : t.id)} style={{ background: "#34495e", color: "white", border: "none", borderRadius: "4px", padding: "6px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>{isExpanded ? "▲ Zu" : "▼ Details"}</button>
                          <button onClick={() => startEditingTraining(t)} style={{ background: "#f39c12", color: "white", border: "none", borderRadius: "4px", padding: "6px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>✏️</button>
                          <button onClick={() => deleteTrainingSession(t.id)} style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "4px", padding: "6px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>🗑</button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ background: "#fff", padding: "12px", borderTop: "1px solid #c7d2fe", fontSize: "13px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {presentPlayers.length > 0 && <div><strong style={{ color: "#27ae60" }}>✅ Anwesend:</strong> {presentPlayers.join(", ")}</div>}
                            {excusedPlayers.length > 0 && <div><strong style={{ color: "#f39c12" }}>⚠️ Entschuldigt:</strong> {excusedPlayers.join(", ")}</div>}
                            {missingPlayers.length > 0 && <div><strong style={{ color: "#e74c3c" }}>❌ Fehlt:</strong> {missingPlayers.join(", ")}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "stats" && (
        <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #eee", paddingBottom: "10px", marginBottom: "15px" }}>
            <h3 style={{ margin: 0, color: "#34495e", fontSize: "16px" }}>📊 Trainingsbeteiligung</h3>
            <span style={{ fontSize: "13px", color: "#777", fontWeight: "bold" }}>{pastTrainings.length} Trainings erfasst</span>
          </div>
          
          {teamPlayers.length === 0 || pastTrainings.length === 0 ? <p style={{ color: "#777", textAlign: "center" }}>Noch nicht genug Daten für eine Statistik vorhanden.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                <thead style={{ background: "#2146d0", color: "white" }}>
                  <tr>
                    <th style={{ padding: "10px", textAlign: "left", fontSize: "13px" }}>Name</th>
                    <th style={{ padding: "10px", textAlign: "center", fontSize: "13px" }}>Beteiligung</th>
                    <th style={{ padding: "10px", textAlign: "center", fontSize: "13px" }}>✅ Da</th>
                    <th style={{ padding: "10px", textAlign: "center", fontSize: "13px" }}>⚠️ Entsch.</th>
                    <th style={{ padding: "10px", textAlign: "center", fontSize: "13px" }}>❌ Fehlt</th>
                  </tr>
                </thead>
                <tbody>
                  {getPlayerStats().map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#f8f9fa" }}>
                      <td style={{ padding: "10px", fontWeight: "bold", color: "#2c3e50", fontSize: "13px" }}>{p.lastName}, {p.firstName}</td>
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                          <span style={{ fontWeight: "bold", color: p.rate >= 75 ? "#27ae60" : (p.rate >= 50 ? "#f39c12" : "#e74c3c") }}>{p.rate}%</span>
                          <div style={{ width: "60px", height: "8px", background: "#ecf0f1", borderRadius: "4px", overflow: "hidden" }}><div style={{ width: `${p.rate}%`, height: "100%", background: p.rate >= 75 ? "#27ae60" : (p.rate >= 50 ? "#f39c12" : "#e74c3c") }}></div></div>
                        </div>
                      </td>
                      <td style={{ padding: "10px", textAlign: "center", color: "#27ae60", fontWeight: "bold", fontSize: "13px" }}>{p.anwesend}</td>
                      <td style={{ padding: "10px", textAlign: "center", color: "#f39c12", fontWeight: "bold", fontSize: "13px" }}>{p.entschuldigt}</td>
                      <td style={{ padding: "10px", textAlign: "center", color: "#e74c3c", fontWeight: "bold", fontSize: "13px" }}>{p.unentschuldigt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* NEU: PLATZBELEGUNG INHALT RENDERN */}
      {activeTab === "pitches" && (
        <PitchManager clubId={clubId} teams={currentTeamOptions.map(t => t.name)} currentUserName={`${loggedInCoach.firstName} ${loggedInCoach.lastName || ""}`.trim()} />
      )}

      {/* LIVE-TICKER VERWALTUNG (Mannschaften verwaltet der Admin im Admin Portal) */}
      {activeTab === "ticker" && (
        <TickerAdmin clubId={clubId} teams={coachTickerTeams} />
      )}

    </div>
  );
}