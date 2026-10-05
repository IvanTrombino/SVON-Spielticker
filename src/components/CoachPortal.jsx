import { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function CoachPortal({ clubId }) {
  // --- LOGIN STATES ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggedInCoach, setLoggedInCoach] = useState(null);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- APP STATES ---
  const [activeTab, setActiveTab] = useState("team");
  const [teamPlayers, setTeamPlayers] = useState([]);
  
  // --- ATTENDANCE STATES ---
  const [trainingDate, setTrainingDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceRecords, setAttendanceRecords] = useState({}); // { playerId: "anwesend" | "entschuldigt" | "unentschuldigt" }
  const [isSavingTraining, setIsSavingTraining] = useState(false);
  const [pastTrainings, setPastTrainings] = useState([]);

  // --- 1. LOGIN LOGIK ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);

    try {
      const q = query(
        collection(db, "youth_coaches"), 
        where("clubId", "==", clubId),
        where("email", "==", email.trim())
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setLoginError("E-Mail nicht gefunden.");
      } else {
        const coachDoc = querySnapshot.docs[0];
        const coachData = coachDoc.data();

        if (coachData.password === password) {
          setLoggedInCoach({ id: coachDoc.id, ...coachData });
        } else {
          setLoginError("Falsches Passwort.");
        }
      }
    } catch (error) {
      console.error("Login Fehler:", error);
      setLoginError("Fehler beim Login. Bitte später versuchen.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setLoggedInCoach(null);
    setEmail("");
    setPassword("");
    setTeamPlayers([]);
  };

  // --- 2. DATEN LADEN WENN EINGELOGGT ---
  useEffect(() => {
    if (!loggedInCoach) return;

    // Spieler der eigenen Mannschaft laden
    const qPlayers = query(
      collection(db, "youth_players"), 
      where("clubId", "==", clubId),
      where("youthTeam", "==", loggedInCoach.youthTeam),
      where("status", "==", "aktiv")
    );

    const unsubPlayers = onSnapshot(qPlayers, (snapshot) => {
      const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      players.sort((a, b) => (a.lastName || "").localeCompare(b.lastName || ""));
      setTeamPlayers(players);

      // Initialen Anwesenheits-State setzen (Standard: "anwesend")
      const initialAttendance = {};
      players.forEach(p => initialAttendance[p.id] = "anwesend");
      setAttendanceRecords(initialAttendance);
    });

    // Vergangene Trainings dieser Mannschaft laden
    const qTrainings = query(
      collection(db, "youth_trainings"),
      where("clubId", "==", clubId),
      where("team", "==", loggedInCoach.youthTeam)
    );

    const unsubTrainings = onSnapshot(qTrainings, (snapshot) => {
      const trainings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      trainings.sort((a, b) => new Date(b.date) - new Date(a.date)); // Neueste zuerst
      setPastTrainings(trainings);
    });

    return () => {
      unsubPlayers();
      unsubTrainings();
    };
  }, [loggedInCoach, clubId]);

  // --- 3. TRAININGS-ANWESENHEIT SPEICHERN ---
  const handleAttendanceChange = (playerId, status) => {
    setAttendanceRecords(prev => ({ ...prev, [playerId]: status }));
  };

  const saveTrainingSession = async () => {
    if (teamPlayers.length === 0) return alert("Keine Spieler in der Mannschaft vorhanden.");
    
    setIsSavingTraining(true);
    try {
      const presentCount = Object.values(attendanceRecords).filter(s => s === "anwesend").length;
      
      await addDoc(collection(db, "youth_trainings"), {
        clubId,
        team: loggedInCoach.youthTeam,
        date: trainingDate,
        coachId: loggedInCoach.id,
        coachName: `${loggedInCoach.firstName} ${loggedInCoach.lastName}`,
        attendance: attendanceRecords,
        presentCount,
        totalPlayers: teamPlayers.length,
        createdAt: serverTimestamp()
      });
      
      alert("Training erfolgreich gespeichert!");
    } catch (error) {
      console.error(error);
      alert("Fehler beim Speichern der Trainingseinheit.");
    } finally {
      setIsSavingTraining(false);
    }
  };

  // --- RENDER: LOGIN BILDSCHIRM ---
  if (!loggedInCoach) {
    return (
      <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif", color: "#333", boxSizing: "border-box" }}>
        <div style={{ background: "white", padding: "30px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)", textAlign: "center" }}>
          <h2 style={{ color: "#2146d0", marginTop: 0 }}>⚽ Trainer-Login</h2>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>Melde dich an, um deine Mannschaft zu verwalten.</p>
          
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <input 
              type="email" 
              placeholder="E-Mail Adresse" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "15px", width: "100%", boxSizing: "border-box" }}
            />
            <input 
              type="password" 
              placeholder="Passwort" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "15px", width: "100%", boxSizing: "border-box" }}
            />
            {loginError && <div style={{ color: "#e74c3c", fontSize: "13px", fontWeight: "bold" }}>{loginError}</div>}
            <button 
              type="submit" 
              disabled={isLoggingIn}
              style={{ padding: "12px", background: "#2146d0", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: isLoggingIn ? "not-allowed" : "pointer" }}
            >
              {isLoggingIn ? "Prüfe..." : "Einloggen"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER: TRAINER PORTAL ---
  const TabButton = ({ id, label, icon }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      style={{ flex: 1, padding: "12px 10px", border: "none", borderRadius: "8px", background: activeTab === id ? "#2146d0" : "#e0e7ff", color: activeTab === id ? "white" : "#3730a3", fontWeight: "bold", cursor: "pointer", fontSize: "14px", transition: "all 0.2s" }}
    >
      {icon} {label}
    </button>
  );

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "15px", fontFamily: "sans-serif", color: "#333", boxSizing: "border-box" }}>
      
      {/* HEADERBAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
        <div>
          <h2 style={{ margin: 0, color: "#2146d0", fontSize: "18px" }}>👋 Hallo, {loggedInCoach.firstName}</h2>
          <div style={{ fontSize: "13px", color: "#555", fontWeight: "bold", marginTop: "4px" }}>Zuständig für: {loggedInCoach.youthTeam}</div>
        </div>
        <button onClick={handleLogout} style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "6px", padding: "8px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
          Abmelden
        </button>
      </div>

      {/* NAVIGATION */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <TabButton id="team" icon="👦" label="Mein Team" />
        <TabButton id="attendance" icon="📋" label="Trainingserfassung" />
      </div>

      {/* TAB: MEIN TEAM */}
      {activeTab === "team" && (
        <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <h3 style={{ marginTop: 0, color: "#34495e", borderBottom: "2px solid #eee", paddingBottom: "8px", fontSize: "16px" }}>Spielerliste ({teamPlayers.length})</h3>
          
          {teamPlayers.length === 0 ? (
            <p style={{ color: "#777", textAlign: "center" }}>Dir sind aktuell keine Spieler zugewiesen.</p>
          ) : (
            <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
              {teamPlayers.map(p => (
                <div key={p.id} style={{ background: "#f8f9fa", border: "1px solid #ddd", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontWeight: "bold", fontSize: "15px", color: "#2c3e50" }}>{p.firstName} {p.lastName}</div>
                  <div style={{ fontSize: "12px", color: "#7f8c8d", marginBottom: "8px" }}>Jg. {p.birthYear || "?"}</div>
                  
                  <div style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {p.fatherName && <div>👨 {p.fatherName}: <a href={`tel:${p.fatherPhone}`} style={{ color: "#2980b9", textDecoration: "none", fontWeight: "bold" }}>{p.fatherPhone}</a></div>}
                    {p.motherName && <div>👩 {p.motherName}: <a href={`tel:${p.motherPhone}`} style={{ color: "#2980b9", textDecoration: "none", fontWeight: "bold" }}>{p.motherPhone}</a></div>}
                    {p.medicalComment && (
                      <div style={{ background: "#fdfefe", borderLeft: "3px solid #e74c3c", padding: "6px", marginTop: "6px", fontSize: "12px", color: "#c0392b" }}>
                        <strong>Hinweis:</strong> {p.medicalComment}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: TRAININGSERFASSUNG */}
      {activeTab === "attendance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* ERFASSUNG */}
          <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #eee", paddingBottom: "10px", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
              <h3 style={{ margin: 0, color: "#27ae60", fontSize: "16px" }}>Neues Training erfassen</h3>
              <input 
                type="date" 
                value={trainingDate} 
                onChange={e => setTrainingDate(e.target.value)} 
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontWeight: "bold", color: "#333" }}
              />
            </div>

            {teamPlayers.length === 0 ? (
              <p style={{ color: "#777" }}>Keine Spieler für die Erfassung vorhanden.</p>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                  {teamPlayers.map(p => {
                    const status = attendanceRecords[p.id];
                    return (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8f9fa", padding: "10px", borderRadius: "8px", border: "1px solid #eee", flexWrap: "wrap", gap: "10px" }}>
                        <span style={{ fontWeight: "bold", color: "#333", fontSize: "14px" }}>{p.firstName} {p.lastName}</span>
                        <div style={{ display: "flex", gap: "5px" }}>
                          <button 
                            onClick={() => handleAttendanceChange(p.id, "anwesend")}
                            style={{ padding: "6px 12px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: "bold", cursor: "pointer", background: status === "anwesend" ? "#27ae60" : "#ecf0f1", color: status === "anwesend" ? "white" : "#7f8c8d" }}
                          >✅ Anwesend</button>
                          <button 
                            onClick={() => handleAttendanceChange(p.id, "entschuldigt")}
                            style={{ padding: "6px 12px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: "bold", cursor: "pointer", background: status === "entschuldigt" ? "#f39c12" : "#ecf0f1", color: status === "entschuldigt" ? "white" : "#7f8c8d" }}
                          >⚠️ Entsch.</button>
                          <button 
                            onClick={() => handleAttendanceChange(p.id, "unentschuldigt")}
                            style={{ padding: "6px 12px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: "bold", cursor: "pointer", background: status === "unentschuldigt" ? "#e74c3c" : "#ecf0f1", color: status === "unentschuldigt" ? "white" : "#7f8c8d" }}
                          >❌ Fehlt</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <button 
                  onClick={saveTrainingSession}
                  disabled={isSavingTraining}
                  style={{ width: "100%", padding: "14px", background: "#27ae60", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: isSavingTraining ? "not-allowed" : "pointer" }}
                >
                  {isSavingTraining ? "Wird gespeichert..." : "💾 Trainingseinheit speichern"}
                </button>
              </>
            )}
          </div>

          {/* HISTORIE */}
          <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: 0, color: "#34495e", borderBottom: "2px solid #eee", paddingBottom: "8px", fontSize: "16px" }}>Letzte Trainingseinheiten</h3>
            {pastTrainings.length === 0 ? (
              <p style={{ color: "#777", fontSize: "13px" }}>Noch keine Trainings erfasst.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {pastTrainings.map(t => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#eef2ff", padding: "12px", borderRadius: "8px", border: "1px solid #c7d2fe" }}>
                    <div>
                      <div style={{ fontWeight: "bold", color: "#2146d0" }}>📅 {new Date(t.date).toLocaleDateString("de-DE")}</div>
                      <div style={{ fontSize: "12px", color: "#555" }}>Erfasst von: {t.coachName}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: "bold", color: "#27ae60", fontSize: "15px" }}>{t.presentCount} / {t.totalPlayers}</div>
                      <div style={{ fontSize: "11px", color: "#777" }}>Anwesend</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}