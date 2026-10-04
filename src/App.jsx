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
  
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem("svon_user_role") || null; // "trainer" oder "admin"
  });

  const [trainerPasswordInput, setTrainerPasswordInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
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

  // --- LOGIN FÜR TRAINER (Passwort: 2002) ---
  const handleTrainerLogin = (e) => {
    e.preventDefault();
    if (trainerPasswordInput === "2002") {
      setUserRole("trainer");
      localStorage.setItem("svon_user_role", "trainer");
      setView("match"); 
      localStorage.setItem("svon_current_view", "match");
      setTrainerPasswordInput("");
    } else {
      alert("Falsches Trainer-Passwort!");
      setTrainerPasswordInput("");
    }
  };

  // --- LOGIN FÜR ADMIN (Passwort: 7241) ---
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPasswordInput === "7241") {
      setUserRole("admin");
      localStorage.setItem("svon_user_role", "admin");
      setView("match"); 
      localStorage.setItem("svon_current_view", "match");
      setAdminPasswordInput("");
    } else {
      alert("Falsches Admin-Passwort!");
      setAdminPasswordInput("");
    }
  };

  const handleBackToHome = () => {
    setView("home");
    setUserRole(null);
    localStorage.removeItem("svon_current_view");
    localStorage.removeItem("svon_user_role");
    window.location.hash = "";
  };

  // --- 1. STARTSEITE MIT GETRENNTEN LOGIN-BEREICHEN ---
  if (view === "home" || !userRole) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", background: "#f0f2f5", padding: "20px" }}>
        <img src={logo} alt="SVON Logo" style={{ maxWidth: "100px", marginBottom: "15px" }} />
        <h1 style={{ color: "#2146d0", marginBottom: "5px", textAlign: "center" }}>SVON Live-Ticker</h1>
        <p style={{ color: "#666", marginBottom: "25px", textAlign: "center" }}>Bitte wähle deinen Bereich aus:</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", maxWidth: "320px" }}>
          
          <button 
            onClick={() => { setView("public"); localStorage.setItem("svon_current_view", "public"); }}
            style={{ padding: "16px", background: "#27ae60", color: "white", border: "none", borderRadius: "10px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}
          >
            👀 Zuschauer-Ansicht
          </button>

          {/* Trainer Login */}
          <div style={{ background: "white", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "center" }}>
            <h3 style={{ color: "#2146d0", margin: "0 0 10px 0", fontSize: "16px" }}>📋 Trainer-Bereich</h3>
            <form onSubmit={handleTrainerLogin}>
              <input 
                type="password" 
                value={trainerPasswordInput} 
                onChange={(e) => setTrainerPasswordInput(e.target.value)} 
                placeholder="Trainer-Passwort..." 
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box", marginBottom: "10px", textAlign: "center" }}
              />
              <button 
                type="submit" 
                style={{ width: "100%", padding: "12px", background: "#2146d0", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}>
                Als Trainer anmelden
              </button>
            </form>
          </div>

          {/* Admin Login */}
          <div style={{ background: "white", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "center" }}>
            <h3 style={{ color: "#c0392b", margin: "0 0 10px 0", fontSize: "16px" }}>🔒 Admin-Bereich (Inkl. Teams)</h3>
            <form onSubmit={handleAdminLogin}>
              <input 
                type="password" 
                value={adminPasswordInput} 
                onChange={(e) => setAdminPasswordInput(e.target.value)} 
                placeholder="Admin-Passwort..." 
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box", marginBottom: "10px", textAlign: "center" }}
              />
              <button 
                type="submit" 
                style={{ width: "100%", padding: "12px", background: "#c0392b", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}>
                Als Admin anmelden
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

  // --- 3. ADMIN / TRAINER BEREICH ---
  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", paddingBottom: "40px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 15px",
          background: userRole === "admin" ? "#c0392b" : "#2146d0",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          flexWrap: "wrap",
          gap: "8px"
        }}
      >
        <button 
          onClick={handleBackToHome}
          style={{ background: "white", color: userRole === "admin" ? "#c0392b" : "#2146d0", border: "none", borderRadius: "6px", padding: "8px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
        >
          🏠 Startseite ({userRole === "admin" ? "Admin" : "Trainer"})
        </button>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setView("match")}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: 0,
              background: view === "match" ? "white" : "rgba(255,255,255,0.2)",
              color: view === "match" ? (userRole === "admin" ? "#c0392b" : "#2146d0") : "white",
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
              color: view === "admin" ? (userRole === "admin" ? "#c0392b" : "#2146d0") : "white",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            ⚙ Administration
          </button>
        </div>

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
        {view === "match" && <MatchView teams={teams} userRole={userRole} />}
        {view === "admin" && (
          <AdminPanel 
            teams={teams} 
            setTeams={userRole === "admin" ? saveTeamsToCloud : null} 
            userRole={userRole} 
          />
        )}
      </div>
    </div>
  );
}