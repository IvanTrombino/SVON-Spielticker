import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { todayString, addDays, formatInfoDate, concernsTeams } from "../trainerInfo";

const DAYS_AHEAD = 6;

// Hinweis im Trainer Portal: gesperrte Plätze heute und in den nächsten Tagen.
// teams = Mannschaften des Trainers (null = alle, z. B. Jugendleitung); deren Termine werden hervorgehoben.
export default function ClosureBanner({ clubId, teams }) {
  const [closures, setClosures] = useState([]);
  const [pitches, setPitches] = useState([]);

  useEffect(() => {
    if (!clubId) return;
    const unsubClosures = onSnapshot(doc(db, "ticker", `${clubId}_closures`), (snap) => setClosures(snap.exists() ? snap.data().list || [] : []));
    const unsubPitches = onSnapshot(doc(db, "ticker", `${clubId}_pitches`), (snap) => setPitches(snap.exists() ? snap.data().list || [] : []));
    return () => { unsubClosures(); unsubPitches(); };
  }, [clubId]);

  const today = todayString();
  const lastDay = addDays(today, DAYS_AHEAD);
  const upcoming = closures.filter(c => c.date >= today && c.date <= lastDay).sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length === 0) return null;

  const pitchName = (id) => pitches.find(p => p.id === id)?.name || "Platz";

  return (
    <div style={{ background: "#fdecea", border: "2px solid #c0392b", borderRadius: "10px", padding: "12px 15px", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
      {upcoming.map(c => {
        const own = (c.affected || []).filter(a => concernsTeams([a.team], teams));
        return (
          <div key={c.id}>
            <div style={{ fontWeight: "bold", color: "#c0392b", fontSize: "15px" }}>
              🚫 {c.date === today ? "Heute" : formatInfoDate(c.date)} gesperrt: {pitchName(c.pitchId)}
            </div>
            {c.reason && <div style={{ fontSize: "13px", color: "#333" }}>{c.reason}</div>}
            {own.length > 0 && (
              <div style={{ fontSize: "13px", color: "#333", marginTop: "4px" }}>
                {own.map(a => (
                  <div key={`${a.team}-${a.startTime}`}>
                    👉 <strong>{a.team}</strong> {a.startTime}–{a.endTime}: {c.targetPitchId ? <>verlegt nach <strong>{pitchName(c.targetPitchId)}</strong></> : <strong>abgesagt</strong>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
