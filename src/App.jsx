import { useState, useEffect } from "react";
import AdminPanel from "./components/AdminPanel";
import MatchView from "./components/MatchView";
import PublicView from "./components/PublicView";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
 
export default function App() {
  const [view, setView] = useState("public"); // Standardmäßig startet die App in der Zuschauer-Ansicht oder nach Wunsch
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
 
  const [teams, setTeams] = useState(() => {
    const saved = localStorage.getItem("svon_teams");
    return saved ? JSON.parse(saved) : [];
  });
 
  useEffect(() => {
    localStorage.setItem("svon_teams", JSON.stringify(teams));
  }, [teams]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "ticker", "teams"), (snap) => {
      if (snap.exists() && snap.data().teamsList) {
        setTeams(snap.data().teamsList);
      }
    });
    return () => unsub();
  }, []);

  const saveTeamsToCloud = async (newTeams) => {
    setTeams(newTeams);
    try {
      await setDoc(doc(db, "ticker", "teams"), { teamsList: newTeams });
    } catch (e) {
      console.error("Fehler beim Speichern der Teams in der Cloud:", e);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    // Hier kannst du dein Wunsch-Passwort eintragen (aktuell: "svon2026")
    if (passwordInput === "svon2026") {
      setIsAuthenticated(true);
      setPasswordInput("");
    } else {
      alert("Falsches Passwort!");
      setPasswordInput("");
    }
  };

  // Wenn der Zuschauer-Modus gewählt wird, ist KEIN Passwort nötig
  if (view === "public") {
    return <PublicView onBackToAdmin={() => setView("match")} />;
  }

  // Wenn der Admin/Trainer-Bereich aufgerufen wird, aber noch kein Passwort eingegeben wurde:
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f2f5", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
        <div style={{ background: "white", padding: "30px", borderRadius: "12px", boxShadow: "0 4px 10px rgba(0,0,0,0.1)", maxWidth: "400px", width: "100%", textAlign: "center" }}>
          
          <h2 style={{ color: "#2146d0", marginBottom: "10px" }}>🔒 Trainer-Bereich</h2>
          <p style={{ color: "#666", fontSize: "14px", marginBottom: "20px" }}>Bitte gib das Passwort ein, um fortzufahren.</p>

          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)} 
              placeholder="Passwort eingeben..." 
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "16px", boxSizing: "border-box", marginBottom: "15px", textAlign: "center" }}
              autoFocus
            />
            <button 
              type="submit" 
              style={{ width: "100%", padding: "12px", background: "#2146d0", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", marginBottom: "10px" }}>
              Anmelden
            </button>
          </form>

          <button 
            onClick={() => setView("public")} 
            style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }}>
            ← Zurück zur Zuschauer-Ansicht
          </button>

        </div>
      </div>
    );
  }
 
  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", paddingBottom: "40px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          padding: "15px",
          background: "#2146d0",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}
      >
        <button
          onClick={() => setView("match")}
          style={{
            padding: "10px 15px",
            borderRadius: "8px",
            border: 0,
            background: view === "match" ? "white" : "rgba(255,255,255,0.2)",
            color: view === "match" ? "#2146d0" : "white",
            fontWeight: "bold",
            cursor: "pointer"
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
            background: view === "admin" ? "white" : "rgba(255,255,255,0.2)",
            color: view === "admin" ? "#2146d0" : "white",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          ⚙ Administration
        </button>

        <button
          onClick={() => { setIsAuthenticated(false); setView("public"); }}
          style={{
            padding: "10px 15px",
            borderRadius: "8px",
            border: 0,
            background: "#f39c12",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer"
          }}
          title="Zurück zur Zuschaueransicht & Logout"
        >
          👀 Zuschauer (Logout)
        </button>
      </div>
 
      <div style={{ maxWidth: "600px", margin: "20px auto", padding: "0 10px" }}>
        {view === "match" && <MatchView teams={teams} />}
        {view === "admin" && <AdminPanel teams={teams} setTeams={saveTeamsToCloud} />}
      </div>
    </div>
  );
}