import { useState, useEffect } from "react";
import AdminPanel from "./components/AdminPanel";
import MatchView from "./components/MatchView";
import PublicView from "./components/PublicView"; // NEU: Die Zuschauer-Ansicht
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
 
export default function App() {
  const [view, setView] = useState("match"); // "match", "admin", oder "public"
 
  const [teams, setTeams] = useState(() => {
    const saved = localStorage.getItem("svon_teams");
    return saved ? JSON.parse(saved) : [];
  });
 
  useEffect(() => {
    localStorage.setItem("svon_teams", JSON.stringify(teams));
  }, [teams]);

  // Teams zusätzlich mit Firebase synchronisieren
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

  // Wenn der Zuschauer-Modus aktiv ist, zeigen wir NUR die PublicView
  if (view === "public") {
    return <PublicView onBackToAdmin={() => setView("match")} />;
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
          onClick={() => setView("public")}
          style={{
            padding: "10px 15px",
            borderRadius: "8px",
            border: 0,
            background: "#f39c12",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer"
          }}
          title="Ansicht für Eltern und Zuschauer am Spielfeldrand"
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