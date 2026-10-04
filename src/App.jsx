import { useState, useEffect } from "react";
import AdminPanel from "./components/AdminPanel";
import MatchView from "./components/MatchView";
import PublicView from "./components/PublicView";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import logo from "./assets/SVON-Wappen.png";

export default function App() {
  const [view, setView] = useState(() => {
    return localStorage.getItem("svon_current_view") || "home";
  });
  
  const [passwordInput, setPasswordInput] = useState("");
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    if (window.location.hash === "#zuschauer") {
      setView("public");
    }
  }, []);

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

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (passwordInput === "2002") {
      setView("match"); 
      localStorage.setItem("svon_current_view", "match");
      setPasswordInput("");
    } else {
      alert("Falsches Passwort!");
      setPasswordInput("");
    }
  };

  const handleBackToHome = () => {
    setView("home");
    localStorage.removeItem("svon_current_view");
    window.location.hash = "";
  };

  // --- 1. STARTSEITE MIT DEN AUSWAHL-BUTTONS ---
  if (view === "home") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", background: "#f0f2f5", padding: "20px" }}>
        <img src={logo} alt="SVON Logo" style={{ maxWidth: "100px", marginBottom: "15px" }} />
        <h1 style={{ color: "#2146d0", marginBottom: "5px", textAlign: "center" }}>SVON Live-Ticker</h1>
        <p style={{ color: "#666", marginBottom: "25px", textAlign: "center" }}>Bitte wähle deinen Bereich aus:</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "15px", width: "100%", maxWidth: "320px" }}>
          
          <button 
            onClick={() => { setView("public"); localStorage.setItem("svon_current_view", "public"); }}
            style={{ padding: "16px", background: "#27ae60", color: "white", border: "none", borderRadius: "10px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}
          >
            👀 Zuschauer-Ansicht
          </button>

          <div style={{ background: "white", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "center" }}>
            <h3 style={{ color: "#2146d0", margin: "0 0 10px 0", fontSize: "16px" }}>🔒 Trainer-Bereich</h3>
            <form onSubmit={handleAdminLogin}>
              <input 
                type="password" 
                value={passwordInput} 
                onChange={(e) => setPasswordInput(e.target.value)} 
                placeholder="Passwort eingeben..." 
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box", marginBottom: "10px", textAlign: "center" }}
              />
              <button 
                type="submit" 
                style={{ width: "100%", padding: "12px", background: "#2146d0", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}>
                Anmelden
              </button>
            </form>
          </div>

        </div>
      </div>
    );
  }

  // --- 2. ZUSCHAUER-ANSICHT ---
  if (view === "public") {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
        <div style={{ background: "#27ae60", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white" }}>
          <span style={{ fontWeight: "bold", fontSize: "14px" }}>👀 Zuschauer-Modus</span>
          <button 
            onClick={handleBackToHome}
            style={{ background: "white", color: "#27ae60", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
          >
            🏠 Zur Startseite
          </button>
        </div>
        <PublicView onBackToAdmin={handleBackToHome} />
      </div>
    );
  }

  // --- 3. ADMIN-BEREICH (Spiel, Administration & Zuschauer-Button oben) ---
  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", paddingBottom: "40px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 15px",
          background: "#2146d0",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          flexWrap: "wrap",
          gap: "8px"
        }}
      >
        {/* Linke Seite: Zurück zur Startseite */}
        <button 
          onClick={handleBackToHome}
          style={{ background: "white", color: "#2146d0", border: "none", borderRadius: "6px", padding: "8px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
        >
          🏠 Startseite
        </button>

        {/* Mittlere Tabs: Spiel & Administration */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setView("match")}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: 0,
              background: view === "match" ? "white" : "rgba(255,255,255,0.2)",
              color: view === "match" ? "#2146d0" : "white",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            ⚽ Spiel
          </button>

          <button
            onClick={() => setView("admin")}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: 0,
              background: view === "admin" ? "white" : "rgba(255,255,255,0.2)",
              color: view === "admin" ? "#2146d0" : "white",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            ⚙ Administration
          </button>
        </div>

        {/* Rechte Seite: Direkt in die Zuschauer-Ansicht wechseln */}
        <button
          onClick={() => { setView("public"); localStorage.setItem("svon_current_view", "public"); }}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: 0,
            background: "#27ae60",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "13px"
          }}
        >
          👀 Zuschauer
        </button>
      </div>

      <div style={{ maxWidth: "600px", margin: "20px auto", padding: "0 10px" }}>
        {view === "match" && <MatchView teams={teams} />}
        {view === "admin" && <AdminPanel teams={teams} setTeams={saveTeamsToCloud} />}
      </div>
    </div>
  );
}