import { useState, useEffect } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { STATUS, EVENT_TYPES, buildRoster, attendanceLink, formatEventDate, shareText, reminderText, shareViaWhatsApp, countResponses } from "../attendance";
import { findLinkedTeamId, fetchTeamMatches, nextMatchFrom } from "../fussballde";

const inputStyle = { padding: "9px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "13px", width: "100%", boxSizing: "border-box" };
const labelStyle = { fontSize: "11px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "3px" };
const btn = (background, color = "white") => ({ padding: "8px 12px", background, color, border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" });
const today = () => new Date().toLocaleDateString("sv-SE");

const emptyEvent = () => ({ type: "Spiel", title: "", date: today(), time: "", meetTime: "", location: "", note: "" });

// Ein Termin mit Live-Rückmeldungen
function EventCard({ event, players }) {
  const [responses, setResponses] = useState({});
  const [open, setOpen] = useState(false);

  useEffect(() => onSnapshot(collection(db, "attendance_events", event.id, "responses"),
    (snap) => setResponses(Object.fromEntries(snap.docs.map(d => [d.id, d.data()])))), [event.id]);

  const roster = event.roster || [];
  const counts = countResponses(roster, responses);
  const missing = roster.filter(r => !responses[r.key]);
  const newPlayers = players.filter(p => !roster.some(r => r.key === p.id));
  const isPast = event.date < today();

  const toggleClosed = () => updateDoc(doc(db, "attendance_events", event.id), { closed: !event.closed });

  const updateRoster = async () => {
    if (!window.confirm(`${newPlayers.length} neue(n) Spieler zur Abstimmung hinzufügen?`)) return;
    const merged = [...roster, ...buildRoster(newPlayers)];
    await updateDoc(doc(db, "attendance_events", event.id), { roster: merged, rosterKeys: merged.map(r => r.key) });
  };

  const handleDelete = async () => {
    if (!window.confirm(`Termin „${event.title || event.type}“ mit allen Rückmeldungen löschen?`)) return;
    const snap = await getDocs(collection(db, "attendance_events", event.id, "responses"));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(db, "attendance_events", event.id));
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(attendanceLink(event.id)); alert("Link kopiert!"); }
    catch { prompt("Link kopieren:", attendanceLink(event.id)); }
  };

  return (
    <div style={{ background: "white", border: "1px solid #e0e0e0", borderRadius: "10px", padding: "12px", opacity: isPast ? 0.75 : 1 }}>
      <div onClick={() => setOpen(!open)} style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "15px", color: "#2146d0" }}>{event.title || event.type}</strong>
          <span style={{ fontSize: "12px", color: "#555" }}>{formatEventDate(event)}{event.closed && " · 🔒 beendet"}</span>
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "6px", fontSize: "13px", fontWeight: "bold" }}>
          <span style={{ color: STATUS.yes.color }}>✅ {counts.yes}</span>
          <span style={{ color: STATUS.no.color }}>❌ {counts.no}</span>
          <span style={{ color: STATUS.maybe.color }}>❔ {counts.maybe}</span>
          <span style={{ color: "#888" }}>offen {counts.open}</span>
          <span style={{ marginLeft: "auto", color: "#888", fontWeight: "normal" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: "10px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
            <button onClick={() => shareViaWhatsApp(shareText(event))} style={btn("#25d366")}>📤 Per WhatsApp teilen</button>
            <button onClick={copyLink} style={btn("#eef2ff", "#2146d0")}>🔗 Link kopieren</button>
            {missing.length > 0 && !event.closed && <button onClick={() => shareViaWhatsApp(reminderText(event, missing.map(r => r.name)))} style={btn("#f39c12")}>⏰ Erinnern ({missing.length})</button>}
            <button onClick={toggleClosed} style={btn("#7f8c8d")}>{event.closed ? "🔓 Wieder öffnen" : "🔒 Abstimmung beenden"}</button>
            {newPlayers.length > 0 && <button onClick={updateRoster} style={btn("#2146d0")}>➕ {newPlayers.length} neue Spieler aufnehmen</button>}
            <button onClick={handleDelete} style={btn("white", "#c0392b")}>🗑️</button>
          </div>
          {(event.meetTime || event.location || event.note) && (
            <p style={{ fontSize: "12px", color: "#555", margin: "0 0 8px 0" }}>
              {event.meetTime && `⏱ Treffpunkt ${event.meetTime} Uhr  `}{event.location && `📍 ${event.location}  `}{event.note && `ℹ️ ${event.note}`}
            </p>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <tbody>
              {[...roster].sort((a, b) => {
                const order = { yes: 0, maybe: 1, no: 2 };
                return (order[responses[a.key]?.status] ?? 3) - (order[responses[b.key]?.status] ?? 3) || a.name.localeCompare(b.name);
              }).map(r => {
                const s = responses[r.key] && STATUS[responses[r.key].status];
                return (
                  <tr key={r.key} style={{ background: s ? s.background : "white", borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "6px 8px", fontWeight: "bold" }}>{r.name}</td>
                    <td style={{ padding: "6px 8px", color: s ? s.color : "#999", fontWeight: "bold", whiteSpace: "nowrap" }}>{s ? `${s.icon} ${s.label}` : "– offen –"}</td>
                    <td style={{ padding: "6px 8px", color: "#555", fontSize: "12px" }}>{responses[r.key]?.comment}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Trainer Portal: Termine anlegen, teilen und Rückmeldungen sehen
export default function AttendanceCoach({ clubId, team, players, coachName }) {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [fussballLinks, setFussballLinks] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!clubId || !team) return;
    const q = query(collection(db, "attendance_events"), where("clubId", "==", clubId), where("team", "==", team));
    return onSnapshot(q, (snap) => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))), (error) => console.error("Zusagen laden:", error));
  }, [clubId, team]);

  useEffect(() => {
    if (!clubId) return;
    return onSnapshot(doc(db, "ticker", `${clubId}_fussballde`), (snap) => setFussballLinks(snap.exists() ? snap.data().links || {} : {}));
  }, [clubId]);

  const linkedTeamId = findLinkedTeamId(fussballLinks, team);
  const upcoming = events.filter(e => e.date >= today()).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  const past = events.filter(e => e.date < today()).sort((a, b) => b.date.localeCompare(a.date));

  const fillFromNextMatch = async () => {
    try {
      const next = nextMatchFrom(await fetchTeamMatches(linkedTeamId));
      if (!next) return alert("Kein kommendes Spiel bei fussball.de gefunden.");
      const [h, m] = (next.time || "00:00").split(":").map(Number);
      const meet = next.time ? `${String(Math.max(0, h - 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}` : "";
      setForm(f => ({ ...f, type: "Spiel", title: `${next.isHome ? "Heimspiel" : "Auswärtsspiel"} gegen ${next.opponent}`, date: next.date, time: next.time, meetTime: f.meetTime || meet, location: next.location }));
    } catch (error) {
      console.error(error);
      alert("fussball.de konnte nicht geladen werden.");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.date) return alert("Bitte ein Datum wählen.");
    if (players.length === 0) return alert("Für diese Mannschaft sind keine aktiven Spieler hinterlegt.");
    setIsSaving(true);
    try {
      const roster = buildRoster(players);
      const data = { ...form, title: form.title.trim(), clubId, team, roster, rosterKeys: roster.map(r => r.key), closed: false, createdByName: coachName, createdAt: serverTimestamp() };
      const ref = await addDoc(collection(db, "attendance_events"), data);
      setForm(null);
      if (window.confirm("Termin angelegt. Jetzt per WhatsApp an die Eltern schicken?")) shareViaWhatsApp(shareText({ ...data, id: ref.id }));
    } catch (error) {
      console.error("Fehler beim Anlegen:", error);
      alert("Fehler beim Anlegen des Termins.");
    } finally {
      setIsSaving(false);
    }
  };

  const set = (name) => (e) => setForm({ ...form, [name]: e.target.value });

  return (
    <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
        <h3 style={{ margin: 0, color: "#2146d0", fontSize: "17px" }}>✅ Zu- und Absagen · {team}</h3>
        {!form && <button onClick={() => setForm(emptyEvent())} style={btn("#27ae60")}>➕ Neuer Termin</button>}
      </div>
      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 12px 0" }}>Termin anlegen, Link per WhatsApp an die Eltern schicken – die Rückmeldungen erscheinen hier live.</p>

      {form && (
        <form onSubmit={handleCreate} style={{ background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: "10px", padding: "12px", marginBottom: "14px" }}>
          {linkedTeamId && <button type="button" onClick={fillFromNextMatch} style={{ ...btn("#eef2ff", "#2146d0"), width: "100%", marginBottom: "10px" }}>📥 Nächstes Spiel von fussball.de übernehmen</button>}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
            <div style={{ flex: "1 1 120px" }}>
              <label style={labelStyle}>Art</label>
              <select value={form.type} onChange={set("type")} style={inputStyle}>{EVENT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            </div>
            <div style={{ flex: "3 1 220px" }}>
              <label style={labelStyle}>Titel</label>
              <input value={form.title} onChange={set("title")} placeholder="z. B. Heimspiel gegen FC Hilzingen" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
            <div style={{ flex: "1 1 130px" }}><label style={labelStyle}>Datum *</label><input type="date" value={form.date} onChange={set("date")} style={inputStyle} /></div>
            <div style={{ flex: "1 1 100px" }}><label style={labelStyle}>Beginn</label><input type="time" value={form.time} onChange={set("time")} style={inputStyle} /></div>
            <div style={{ flex: "1 1 100px" }}><label style={labelStyle}>Treffpunkt</label><input type="time" value={form.meetTime} onChange={set("meetTime")} style={inputStyle} /></div>
          </div>
          <div style={{ marginBottom: "8px" }}><label style={labelStyle}>Ort</label><input value={form.location} onChange={set("location")} placeholder="z. B. Sportpark Orsingen" style={inputStyle} /></div>
          <div style={{ marginBottom: "10px" }}><label style={labelStyle}>Hinweis an die Eltern</label><input value={form.note} onChange={set("note")} placeholder="z. B. Trikots mitbringen, Fahrgemeinschaften" style={inputStyle} /></div>
          <p style={{ fontSize: "11px", color: "#888", margin: "0 0 10px 0" }}>{players.length} aktive Spieler werden in die Abstimmung übernommen (für Eltern nur Vorname + Initial).</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" disabled={isSaving} style={{ ...btn("#27ae60"), flex: 1, padding: "11px" }}>{isSaving ? "Wird angelegt..." : "💾 Termin anlegen"}</button>
            <button type="button" onClick={() => setForm(null)} style={{ ...btn("#eee", "#333"), flex: 1, padding: "11px" }}>Abbrechen</button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {upcoming.length === 0 && !form && <p style={{ color: "#777", textAlign: "center", margin: "16px 0" }}>Keine kommenden Termine.</p>}
        {upcoming.map(e => <EventCard key={e.id} event={e} players={players} />)}
      </div>

      {past.length > 0 && (
        <>
          <button onClick={() => setShowPast(!showPast)} style={{ ...btn("transparent", "#2146d0"), marginTop: "12px", padding: "4px 0" }}>{showPast ? "▲" : "▼"} Vergangene Termine ({past.length})</button>
          {showPast && <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>{past.map(e => <EventCard key={e.id} event={e} players={players} />)}</div>}
        </>
      )}
    </div>
  );
}
