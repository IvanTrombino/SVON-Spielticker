import { useState, useEffect } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { conflictsDocRef, approveConflict, rejectConflict } from "../pitchConflicts";

const STATUS_STYLES = {
  offen: { label: "⏳ Offen", background: "#fef9e7", border: "#f1c40f", color: "#7a6609" },
  genehmigt: { label: "✅ Genehmigt", background: "#e8f8f5", border: "#27ae60", color: "#1e8449" },
  abgelehnt: { label: "❌ Abgelehnt", background: "#fdedec", border: "#e74c3c", color: "#c0392b" }
};

const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
const formatDateTime = (iso) => iso ? new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

// Platzkonflikte: Trainer sehen die Liste (canDecide = false), Admins können genehmigen/ablehnen
export default function PitchConflicts({ clubId, canDecide = false }) {
  const [conflicts, setConflicts] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [deciderName, setDeciderName] = useState("");

  useEffect(() => {
    if (!clubId) return;
    const unsubConflicts = onSnapshot(conflictsDocRef(clubId), (snap) => {
      setConflicts(snap.exists() ? snap.data().list || [] : []);
    });
    const unsubPitches = onSnapshot(doc(db, "ticker", `${clubId}_pitches`), (snap) => {
      setPitches(snap.exists() ? snap.data().list || [] : []);
    });
    return () => { unsubConflicts(); unsubPitches(); };
  }, [clubId]);

  // Name des entscheidenden Admins: aus dem Trainerprofil, sonst die E-Mail
  useEffect(() => {
    const user = auth.currentUser;
    if (!canDecide || !user) return;
    getDoc(doc(db, "youth_coaches", user.uid))
      .then(snap => {
        const c = snap.exists() ? snap.data() : null;
        setDeciderName(c?.firstName ? `${c.firstName} ${c.lastName || ""}`.trim() : user.email);
      })
      .catch(() => setDeciderName(user.email));
  }, [canDecide]);

  const handleDecision = async (conflict, approve) => {
    const note = notes[conflict.id] || "";
    if (approve && !window.confirm(`Genehmigen? ${conflict.booking.team} bekommt den Platz, die bisherige Belegung (${(conflict.conflictTeams || []).join(", ")}) wird für diesen Termin entfernt.`)) return;
    setBusyId(conflict.id);
    try {
      const decidedBy = deciderName || auth.currentUser?.email || "Admin";
      if (approve) await approveConflict(clubId, conflict.id, decidedBy, note);
      else await rejectConflict(clubId, conflict.id, decidedBy, note);
    } catch (error) {
      console.error("Fehler bei der Entscheidung:", error);
      alert(error.message || "Fehler beim Speichern der Entscheidung.");
    } finally {
      setBusyId(null);
    }
  };

  const pitchName = (id) => pitches.find(p => p.id === id)?.name || "Unbekannter Platz";

  // Offene zuerst, danach die neuesten
  const sorted = [...conflicts].sort((a, b) =>
    (a.status === "offen" ? 0 : 1) - (b.status === "offen" ? 0 : 1) || (b.createdAt || "").localeCompare(a.createdAt || "")
  );

  return (
    <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", color: "#333", textAlign: "left" }}>
      <h3 style={{ marginTop: 0, color: "#2146d0", fontSize: "16px", borderBottom: "2px solid #eee", paddingBottom: "8px" }}>
        🏟️ Platzkonflikte ({conflicts.filter(c => c.status === "offen").length} offen)
      </h3>

      {sorted.length === 0 && <p style={{ color: "#777", textAlign: "center", margin: "20px 0" }}>Keine Platzkonflikte gemeldet.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {sorted.map(c => {
          const s = STATUS_STYLES[c.status] || STATUS_STYLES.offen;
          const b = c.booking || {};
          return (
            <div key={c.id} style={{ background: s.background, borderLeft: `5px solid ${s.border}`, borderRadius: "8px", padding: "12px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
                <strong style={{ fontSize: "14px" }}>{pitchName(b.pitchId)} · {formatDate(b.date)} · {b.startTime}–{b.endTime}</strong>
                <span style={{ fontWeight: "bold", color: s.color }}>{s.label}</span>
              </div>
              <div>🙋 <strong>Anfrage:</strong> {b.team} ({b.type}{b.share && b.share !== "Ganz" ? `, ${b.share}` : ""}) – von {c.requestedBy || "-"} am {formatDateTime(c.createdAt)}</div>
              <div>⛔ <strong>Belegt durch:</strong> {(c.conflictTeams || []).join(", ") || "-"}</div>
              {b.notes && <div>📝 <strong>Notiz:</strong> {b.notes}</div>}

              {c.status !== "offen" && (
                <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px solid rgba(0,0,0,0.1)" }}>
                  <div>⚖️ <strong>Entschieden von:</strong> {c.decidedBy || "-"} am {formatDateTime(c.decidedAt)}</div>
                  {c.status === "genehmigt" && <div>🔁 Platz an {b.team} vergeben{c.displacedTeams?.length ? `, Termin entfernt bei: ${c.displacedTeams.join(", ")}` : ""}</div>}
                  {c.decisionNote && <div>💬 <strong>Begründung:</strong> {c.decisionNote}</div>}
                </div>
              )}

              {canDecide && c.status === "offen" && (
                <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    placeholder="Begründung (optional)"
                    value={notes[c.id] || ""}
                    onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })}
                    style={{ flex: "1 1 200px", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", background: "#fff", color: "#333" }}
                  />
                  <button disabled={busyId === c.id} onClick={() => handleDecision(c, true)} style={{ background: "#27ae60", color: "white", border: "none", borderRadius: "6px", padding: "8px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>✅ Genehmigen</button>
                  <button disabled={busyId === c.id} onClick={() => handleDecision(c, false)} style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "6px", padding: "8px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>❌ Ablehnen</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
