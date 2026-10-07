import { useState, useEffect } from "react";
import MatchView from "./components/MatchView";
import PublicView from "./components/PublicView";
import YouthAdminPage from "./components/YouthAdminPage"; 
import CoachPortal from "./components/CoachPortal"; // NEU: Import für das Trainer-Portal
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "./firebase";
import { isAdminUser } from "./admins";
import { redeemTickerCode, isTickerSessionValid } from "./tickerCode";
import logo from "./assets/SVON-Wappen.png";

export default function App() {
  const [clubId, setClubId] = useState(() => {
    const hash = window.location.hash.replace("#", "").trim();
    if (hash && hash !== "zuschauer" && hash !== "jugend" && hash !== "trainer") { 
      return hash.toLowerCase();
    }
    return localStorage.getItem("svon_current_club") || "";
  });

  const [view, setView] = useState(() => {
    const saved = localStorage.getItem("svon_current_view");
    // Die frühere Ansicht "admin" gibt es nicht mehr (jetzt im Trainer Portal)
    return saved === "admin" ? "match" : (saved || "home");
  });
  
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [clubInput, setClubInput] = useState("");
  const [tickerCodeInput, setTickerCodeInput] = useState("");
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setFirebaseUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = isAdminUser(firebaseUser);
  // Anonym angemeldet = Ticker-Person mit Tagescode
  const isTickerUser = !!firebaseUser?.isAnonymous;

  // Ticker-Zugang regelmäßig prüfen: Code abgelaufen oder durch neuen Tagescode ersetzt -> abmelden
  useEffect(() => {
    // Während der Code-Anmeldung noch nicht prüfen – die Sitzung wird erst nach dem Login angelegt
    if (!isTickerUser || !clubId || isRedeemingCode) return;
    const verify = async () => {
      if (await isTickerSessionValid(clubId)) return;
      await signOut(auth);
      alert("Dein Ticker-Code ist abgelaufen. Bitte hol dir den aktuellen Code von deinem Trainer.");
    };
    verify();
    const interval = setInterval(verify, 60000);
    return () => clearInterval(interval);
  }, [isTickerUser, clubId, isRedeemingCode]);

  // Ohne Admin-Login oder gültigen Ticker-Code kein Zugriff auf den Ticker
  useEffect(() => {
    if (authLoading) return;
    if (view === "match" && !isAdmin && !isTickerUser) {
      setView("home");
      localStorage.removeItem("svon_current_view");
    }
  }, [authLoading, view, isAdmin, isTickerUser]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "").trim();
      if (hash && hash !== "zuschauer" && hash !== "jugend" && hash !== "trainer") { 
        const cleanClub = hash.toLowerCase();
        setClubId(cleanClub);
        localStorage.setItem("svon_current_club", cleanClub);
      } else if (hash === "zuschauer" && clubId) {
        setView("public");
        localStorage.setItem("svon_current_view", "public");
      } else if (hash === "jugend" && clubId) { 
        setView("youth");
        localStorage.setItem("svon_current_view", "youth");
      } else if (hash === "trainer" && clubId) { 
        setView("coachportal");
        localStorage.setItem("svon_current_view", "coachportal");
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    
    if (window.location.hash === "#zuschauer" && clubId) {
      setView("public");
    } else if (window.location.hash === "#jugend" && clubId) {
      setView("youth");
    } else if (window.location.hash === "#trainer" && clubId) { 
      setView("coachportal");
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

  const openTicker = () => {
    setView("match");
    localStorage.setItem("svon_current_view", "match");
  };

  const handleTickerCodeLogin = async (e) => {
    e.preventDefault();
    if (!tickerCodeInput.trim()) return;
    setIsRedeemingCode(true);
    try {
      await redeemTickerCode(clubId, tickerCodeInput);
      setTickerCodeInput("");
      openTicker();
    } catch (error) {
      console.error("Ticker-Code Fehler:", error);
      alert(error.code === "permission-denied"
        ? "Ungültiger oder abgelaufener Ticker-Code!"
        : "Anmeldung fehlgeschlagen. Bitte später erneut versuchen.");
    } finally {
      setIsRedeemingCode(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    handleBackToHome();
  };

  const handleBackToHome = () => {
    setView("home");
    localStorage.removeItem("svon_current_view");
    window.location.hash = `#${clubId}`;
  };

  if (authLoading) {
    return <div style={{ textAlign: "center", marginTop: "50px", fontFamily: "sans-serif" }}>Lade...</div>;
  }

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

  if (view === "coachportal") {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
        <div style={{ background: "#f39c12", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white" }}>
          <span style={{ fontWeight: "bold", fontSize: "14px" }}>📋 Trainer Portal ({clubId.toUpperCase()})</span>
          <button 
            onClick={handleBackToHome}
            style={{ background: "white", color: "#f39c12", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
          >
            🏠 Zur Startseite
          </button>
        </div>
        <CoachPortal clubId={clubId} tickerTeams={teams} />
      </div>
    );
  }

  if (view === "home") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", background: "#f0f2f5", padding: "20px", boxSizing: "border-box" }}>
        <img src={logo} alt="Logo" style={{ maxWidth: "90px", marginBottom: "10px" }} />
        <h1 style={{ color: "#2146d0", marginBottom: "5px", textAlign: "center", fontSize: "24px", wordBreak: "break-word", padding: "0 10px" }}>
          SV Orsingen-Nenzingen
        </h1>
        <p style={{ color: "#666", marginBottom: "5px", textAlign: "center", fontSize: "14px" }}>
          Aktiver Verein: <strong>{clubId.toUpperCase()}</strong>
        </p>
        <button onClick={() => { setClubId(""); window.location.hash = ""; localStorage.removeItem("svon_current_club"); }} style={{ background: "transparent", border: "none", color: "#e74c3c", fontSize: "12px", cursor: "pointer", textDecoration: "underline", marginBottom: "25px" }}>
          Verein wechseln
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: "15px", width: "100%", maxWidth: "320px" }}>
          
          <button 
            onClick={() => { setView("public"); localStorage.setItem("svon_current_view", "public"); window.location.hash = "#zuschauer"; }}
            style={{ padding: "15px", background: "#27ae60", color: "white", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}
          >
            👀 Live-Ticker Zuschauer Ansicht
          </button>

          {/* Die weiße Live-Ticker Box ist nun OBERHALB des Coach-Portals */}
          <div style={{ background: "white", padding: "18px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", textAlign: "center" }}>
            <h3 style={{ color: "#2146d0", margin: "0 0 10px 0", fontSize: "15px" }}>⚽ Live-Ticker bedienen</h3>
            {isTickerUser ? (
              <>
                <p style={{ color: "#27ae60", fontSize: "13px", fontWeight: "bold", margin: "0 0 10px 0" }}>✅ Ticker-Zugang aktiv</p>
                <button 
                  onClick={openTicker}
                  style={{ width: "100%", padding: "11px", background: "#2146d0", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", fontSize: "14px", cursor: "pointer", marginBottom: "8px" }}>
                  Zum Ticker
                </button>
                <button 
                  onClick={() => signOut(auth)}
                  style={{ background: "transparent", border: "none", color: "#e74c3c", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}>
                  Ticker-Zugang beenden
                </button>
              </>
            ) : (
              <form onSubmit={handleTickerCodeLogin}>
                <input 
                  type="text" 
                  value={tickerCodeInput} 
                  onChange={(e) => setTickerCodeInput(e.target.value)} 
                  placeholder="Ticker-Code (z.B. K7P-4XM)" 
                  autoCapitalize="characters"
                  autoComplete="off"
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box", marginBottom: "10px", textAlign: "center", color: "#333", background: "#fff", textTransform: "uppercase" }} 
                />
                <button 
                  type="submit" 
                  disabled={isRedeemingCode}
                  style={{ width: "100%", padding: "11px", background: "#2146d0", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", fontSize: "14px", cursor: isRedeemingCode ? "not-allowed" : "pointer" }}>
                  {isRedeemingCode ? "Wird geprüft..." : "In Ticker einloggen"}
                </button>
                <p style={{ color: "#888", fontSize: "11px", margin: "8px 0 0 0" }}>Den Tagescode bekommst du von deinem Trainer.</p>
              </form>
            )}
          </div>

          {/* Der orange Button ist nun UNTERHALB der weißen Box */}
          <button 
            onClick={() => { setView("coachportal"); localStorage.setItem("svon_current_view", "coachportal"); window.location.hash = "#trainer"; }}
            style={{ padding: "15px", background: "#f39c12", color: "white", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}
          >
            📋 Trainer Portal
          </button>

          <button 
            onClick={() => {
              if (isAdmin) {
                setView("match");
                localStorage.setItem("svon_current_view", "match");
              } else {
                setView("youth");
                localStorage.setItem("svon_current_view", "youth");
                window.location.hash = "#jugend";
              }
            }}
            style={{ padding: "15px", background: "#c0392b", color: "white", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}
          >
            🔒 Jugend-Admin (Login)
          </button>

        </div>
      </div>
    );
  }

  const role = isAdmin ? "admin" : "trainer";

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", paddingBottom: "40px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 15px",
          background: isAdmin ? "#c0392b" : "#2146d0",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          flexWrap: "wrap",
          gap: "8px"
        }}
      >
        <button 
          onClick={handleBackToHome}
          style={{ background: "white", color: isAdmin ? "#c0392b" : "#2146d0", border: "none", borderRadius: "6px", padding: "8px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
        >
          🏠 Startseite ({isAdmin ? "Admin" : "Ticker"})
        </button>

        <div style={{ display: "flex", gap: "8px" }}>
          {isAdmin && (
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

          {(isAdmin || isTickerUser) && (
            <button
              onClick={handleLogout}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: 0,
                background: "#333",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "13px"
              }}
            >
              🚪 Logout
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: "600px", margin: "20px auto", padding: "0 10px" }}>
        <MatchView clubId={clubId} teams={teams} userRole={role} />
      </div>
    </div>
  );
}