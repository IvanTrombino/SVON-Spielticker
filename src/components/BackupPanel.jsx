import { useState, useEffect } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";

const formatSize = (bytes) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.round(bytes / 1024)} KB`;
const COLLECTION_NAMES = {
  youth_players: "Spieler", youth_coaches: "Trainer", youth_trainings: "Trainings", youth_settings: "Mannschaften",
  ticker: "Ticker & Plätze", ticker_codes: "Ticker-Codes", attendance_events: "Zusagen",
  summercamp_participants: "Sommercamp Kinder", summercamp_staff: "Sommercamp Betreuer",
  summercamp_donations: "Spenden", summercamp_settings: "Sommercamp Preise"
};

// Admin Portal: automatische Sicherungen ansehen, manuell sichern, als Datei herunterladen
export default function BackupPanel() {
  const [backups, setBackups] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState("");
  const [openedAt] = useState(() => Date.now());

  useEffect(() => onSnapshot(collection(db, "backups"), (snap) => {
    setBackups(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
  }, (err) => setError(`Sicherungen können nicht geladen werden: ${err.message}`)), []);

  const backupNow = async () => {
    setIsRunning(true);
    setError("");
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/backup", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || response.status);
    } catch (err) {
      setError(`Sicherung fehlgeschlagen: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const download = async (backup) => {
    setDownloading(backup.id);
    try {
      const parts = await getDocs(collection(db, "backups", backup.id, "parts"));
      const json = parts.docs.map(d => d.data()).sort((a, b) => a.index - b.index).map(p => p.data).join("");
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `SVON-Sicherung_${backup.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Download fehlgeschlagen: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const latest = backups[0];
  const latestAgeHours = latest?.createdAt ? (openedAt - latest.createdAt.toMillis()) / 36e5 : null;

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
        <h3 style={{ margin: 0, fontSize: "16px", color: "#2146d0" }}>💾 Datensicherung</h3>
        <button onClick={backupNow} disabled={isRunning} style={{ padding: "9px 14px", background: "#27ae60", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: isRunning ? "not-allowed" : "pointer", fontSize: "13px" }}>
          {isRunning ? "Sichere..." : "💾 Jetzt sichern"}
        </button>
      </div>
      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 10px 0" }}>
        Jede Nacht werden automatisch alle Daten gesichert, die letzten 30 Sicherungen bleiben erhalten. Lade ab und zu eine Sicherung herunter und bewahre sie gut geschützt auf – sie enthält personenbezogene Daten.
      </p>

      {latestAgeHours !== null && latestAgeHours > 36 && (
        <p style={{ background: "#fdecea", border: "1px solid #f5b7b1", color: "#c0392b", borderRadius: "6px", padding: "8px", fontSize: "12px" }}>
          ⚠️ Die letzte Sicherung ist älter als 36 Stunden. Bitte prüfen, ob die automatische Sicherung eingerichtet ist.
        </p>
      )}
      {error && <p style={{ color: "#c0392b", fontSize: "12px" }}>{error}</p>}

      {backups.length === 0 ? (
        <p style={{ color: "#777", textAlign: "center", margin: "20px 0" }}>Noch keine Sicherungen vorhanden.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {backups.map(b => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap", background: "white", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "8px 10px", fontSize: "12px" }}>
              <div>
                <strong>{b.createdAt?.toDate().toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong>
                <span style={{ color: "#888" }}> · {b.trigger} · {formatSize(b.sizeBytes || 0)}</span>
                <div style={{ color: "#666", marginTop: "2px" }}>
                  {Object.entries(b.counts || {})
                    .sort(([a], [c]) => (Object.keys(COLLECTION_NAMES).indexOf(a) + 1 || 99) - (Object.keys(COLLECTION_NAMES).indexOf(c) + 1 || 99))
                    .map(([name, count]) => `${COLLECTION_NAMES[name] || name}: ${count}`).join(" · ")}
                </div>
              </div>
              <button onClick={() => download(b)} disabled={downloading === b.id} style={{ padding: "6px 10px", background: "#2146d0", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" }}>
                {downloading === b.id ? "Lade..." : "📥 Herunterladen"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
