import { useState, useEffect } from "react";
import AdminPanel from "./components/AdminPanel";
import MatchView from "./components/MatchView";
import PublicView from "./components/PublicView";
import YouthAdminPage from "./components/YouthAdminPage"; 
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import logo from "./assets/SVON-Wappen.png";

export default function App() {
  const [clubId, setClubId] = useState(() => {
    const hash = window.location.hash.replace("#", "").trim();
    if (hash && hash !== "zuschauer" && hash !== "jugend") { 
      return hash.toLowerCase();
    }
    return localStorage.getItem("svon_current_club") || "";
  });

  const [view, setView] = useState(() => {
    return localStorage.getItem("svon_current_view") || "home";
  });
  
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem("svon_user_role") || null; 
  });

  const [clubInput, setClubInput] = useState("");
  const [trainerPasswordInput, setTrainerPasswordInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "").trim();
      if (hash && hash !== "zuschauer" && hash !== "jugend") { 
        const cleanClub = hash.toLowerCase();
        setClubId(cleanClub);
        localStorage.setItem("svon_current_club", cleanClub);
      } else if (hash === "zuschauer" && clubId) {
        setView("public");
        localStorage.setItem("svon_current_view", "public");
      } else if (hash === "jugend" && clubId) { 
        setView("youth");
        localStorage.setItem("svon_current_view", "youth");
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    
    if (window.location.hash === "#zuschauer" && clubId) {
      setView("public");
    } else if (window.location.hash === "#jugend" && clubId) {
      setView("youth");
    }

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [clubId]);

  useEffect(() => {
    if (!clubId) return;

    const docName = `${clubId}_teams`;
    const unsub = onSnapshot(doc(db, "ticker", docName), (snap) => {
      if (snap.exists() && snap.data().teamsList) {
        setTeams(snap.data().teamsList);
      } else {
        if (clubId === "svon") {
          const defaultTeams = ["1. Mannschaft", "2. Mannschaft", "F-Jugend"];
          setTeams(defaultTeams);
        } else {
          setTeams(["1. Mannschaft"]);
        }
      }
    });
    return () => unsub();
  }, [clubId]);

  const saveTeamsToCloud = async (newTeams) => {
    setTeams(newTeams);
    try {
      const docName = `${clubId}_teams`;
      await setDoc(doc(db, "ticker", docName), { teamsList: newTeams });
    } catch (e) {
      console.error("Fehler beim Speichern der Teams:", e);
    }
  };

  const handleSelectClub = (e) => {
    e.preventDefault();
    const clean = clubInput.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!clean) {
      alert("Bitte gib eine gültige Vereins-ID ein!");
      return;
    }
    setClubId(clean);
    localStorage.setItem("svon_current_club", clean);
    window.location.hash = `#${clean}`;
    setClubInput("");
  };

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
    window.location.hash = `#${clubId}`;
  };

  if (!clubId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", background: "#f0f2f5", padding: "20px" }}>
        <img src={logo} alt="Logo" style={{ maxWidth: "100px", marginBottom: "15px" }} />
        <h1 style={{ color: "#2146d0", marginBottom: "5px", textAlign: "center" }}>Live-Ticker Plattform</h1>
        <p style={{ color: "#666", marginBottom: "25px", textAlign: "center" }}>Bitte gib den Vereins-Code ein oder wähle deinen Verein:</p>

        <div style={{ background: "white", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "center", width: "100%", maxWidth: "320px" }}>
          <form onSubmit={handleSelectClub}>
            <input 
              type="text" 
              value={clubInput} 
              onChange={(e) => setClubInput(e.target.value)} 
              placeholder="z.B. svon" 
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box", marginBottom: "10px", textAlign: "center", color: "#333", background: "#fff" }} 
            />
            <button 
              type="submit" 
              style={{ width: "100%", padding: "12px", background: "#2146d0", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}>
              Verein laden
            </button>
          </form>

          <div style={{ marginTop: "15px", borderTop: "1px solid #eee", paddingTop: "15px" }}>
            <button 
              onClick={() => { setClubId("svon"); window.location.hash = "#svon"; }}
              style={{ background: "none", border: "none", color: "#2980b9", textDecoration: "underline", cursor: "pointer", fontSize: "13px" }}
            >
              👉 Direkt zu SV Orsingen-Nenzingen (svon)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "public") {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
        <div style={{ background: "#27ae60", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white" }}>
          <span style={{ fontWeight: "bold", fontSize: "14px" }}>👀 Live-Ticker Zuschauer Ansicht ({clubId.toUpperCase()})</span>
          <button 
            onClick={handleBackToHome}
            style={{ background: "white", color: "#27ae60", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
          >
            🏠 Zur Startseite
          </button>
        </div>
        <PublicView clubId={clubId} teams={teams} onBackToAdmin={handleBackToHome} />
      </div>
    );
  }

  if (view === "youth") {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
        <div style={{ background: "#2980b9", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white", flexWrap: "wrap", gap: "8px" }}>
          <span style={{ fontWeight: "bold", fontSize: "14px" }}>👦 Jugenddatenbank ({clubId.toUpperCase()})</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button 
              onClick={() => { setView("match"); window.location.hash = `#${clubId}`; }}
              style={{ background: "white", color: "#2980b9", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
            >
              ⬅️ Zurück zum Admin
            </button>
            <button 
              onClick={handleBackToHome}
              style={{ background: "#c0392b", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
            >
              🏠 Startseite
            </button>
          </div>
        </div>
        <YouthAdminPage clubId={clubId} />
      </div>
    );
  }

  if (view === "home") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", background: "#f0f2f5", padding: "20px" }}>
        <img src={logo} alt="Logo" style={{ maxWidth: "100px", marginBottom: "15px" }} />
        <h1 style={{ color: "#2146d0", marginBottom: "5px", textAlign: "center" }}>SV Orsingen-Nenzingen</h1>
        <p style={{ color: "#666", marginBottom: "5px", textAlign: "center" }}>Aktiver Verein: <strong>{clubId.toUpperCase()}</strong></p>
        <button onClick={() => { setClubId(""); window.location.hash = ""; localStorage.removeItem("svon_current_club"); }} style={{ background: "transparent", border: "none", color: "#e74c3c", fontSize: "12px", cursor: "pointer", textDecoration: "underline", marginBottom: "20px" }}>
          Verein wechseln
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", maxWidth: "320px" }}>
          
          <button 
            onClick={() => { setView("public"); localStorage.setItem("svon_current_view", "public"); window.location.hash = "#zuschauer"; }}
            style={{ padding: "16px", background: "#27ae60", color: "white", border: "none", borderRadius: "10px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}
          >
            👀 Live-Ticker Zuschauer Ansicht
          </button>

          <div style={{ background: "white", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "center" }}>
            <h3 style={{ color: "#2146d0", margin: "0 0 10px 0", fontSize: "16px" }}>📋 Live-Ticker Trainer Bereich</h3>
            <form onSubmit={handleTrainerLogin}>
              <input 
                type="password" 
                value={trainerPasswordInput} 
                onChange={(e) => setTrainerPasswordInput(e.target.value)} 
                placeholder="Trainer-Passwort..." 
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box", marginBottom: "10px", textAlign: "center", color: "#333", background: "#fff" }} 
              />
              <button 
                type="submit" 
                style={{ width: "100%", padding: "12px", background: "#2146d0", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}>
                Als Trainer anmelden
              </button>
            </form>
          </div>

          <div style={{ background: "white", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "center" }}>
            <h3 style={{ color: "#c0392b", margin: "0 0 10px 0", fontSize: "16px" }}>🔒 Admin-Bereich</h3>
            <form onSubmit={handleAdminLogin}>
              <input 
                type="password" 
                value={adminPasswordInput} 
                onChange={(e) => setAdminPasswordInput(e.target.value)} 
                placeholder="Admin-Passwort..." 
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box", marginBottom: "10px", textAlign: "center", color: "#333", background: "#fff" }} 
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

        <div style={{ display: "flex", gap: "8px" }}>
          {/* NUR FÜR ADMIN: JUGEND-DATENBANK BUTTON IN DER LEISTE */}
          {userRole === "admin" && (
            <button
              onClick={() => { setView("youth"); localStorage.setItem("svon_current_view", "youth"); window.location.hash = "#jugend"; }}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: 0,
                background: "#2980b9",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "13px"
              }}
            >
              👦 Jugend
            </button>
          )}

          <button
            onClick={() => { setView("public"); localStorage.setItem("svon_current_view", "public"); window.location.hash = "#zuschauer"; }}
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
      </div>

      <div style={{ maxWidth: "600px", margin: "20px auto", padding: "0 10px" }}>
        {view === "match" && <MatchView clubId={clubId} teams={teams} userRole={userRole} />}
        {view === "admin" && (
          <AdminPanel 
            clubId={clubId}
            teams={teams} 
            setTeams={userRole === "admin" ? saveTeamsToCloud : null} 
            userRole={userRole} 
          />
        )}
      </div>
    </div>
  );
}