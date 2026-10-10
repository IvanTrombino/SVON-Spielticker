import { useState, useEffect } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { STATUS, SELECTION, EVENT_TYPES, buildRoster, rosterName, attendanceLink, formatEventDate, formatResponseTime, shareText, reminderText, resultText, shareViaWhatsApp, countResponses, statusOf, laundryName, selectionLists } from "../attendance";
import { findLinkedTeamId, fetchTeamMatches, nextMatchFrom } from "../fussballde";

const inputStyle = { padding: "9px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "13px", width: "100%", boxSizing: "border-box" };
const labelStyle = { fontSize: "11px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "3px" };
const btn = (background, color = "white") => ({ padding: "8px 12px", background, color, border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" });
const today = () => new Date().toLocaleDateString("sv-SE");

const emptyEvent = () => ({ type: "Spiel", title: "", date: today(), time: "", meetTime: "", location: "", note: "", maxPlayers: "" });
const phoneLink = (phone) => `tel:${phone.replace(/[^\d+]/g, "")}`;

// Ein Termin mit Live-Rückmeldungen
function EventCard({ event, players }) {
  const [responses, setResponses] = useState({});
  const [contacts, setContacts] = useState({});
  const [open, setOpen] = useState(false);

  useEffect(() => onSnapshot(collection(db, "attendance_events", event.id, "responses"),
    (snap) => setResponses(Object.fromEntries(snap.docs.map(d => [d.id, d.data()])))), [event.id]);

  useEffect(() => {
    if (!open) return;
    return onSnapshot(collection(db, "attendance_events", event.id, "contacts"),
      (snap) => setContacts(Object.fromEntries(snap.docs.map(d => [d.id, d.data()]))),
      (error) => console.error("Telefonnummern laden:", error));
  }, [event.id, open]);

  const roster = event.roster || [];
  const counts = countResponses(roster, responses);
  const missing = roster.filter(r => !statusOf(responses[r.key]));
  const selection = event.selection || {};
  const lists = selectionLists(event, responses);
  const laundry = laundryName(roster, responses);
  const isFull = event.maxPlayers && lists.confirmed.length >= event.maxPlayers;

  const setSelection = (key, value) => {
    const next = { ...selection };
    if (next[key] === value) delete next[key]; else next[key] = value;
    return updateDoc(doc(db, "attendance_events", event.id), { selection: next });
  };

  const changeMax = () => {
    const input = window.prompt("Maximale Anzahl Kinder (leer = unbegrenzt):", event.maxPlayers || "");
    if (input === null) return;
    const max = parseInt(input, 10);
    return updateDoc(doc(db, "attendance_events", event.id), { maxPlayers: max > 0 ? max : null });
  };
  const newPlayers = players.filter(p => !roster.some(r => r.key === p.id));
  // Termine von früher enthalten noch gekürzte oder veraltete Namen
  const renamed = roster.filter(r => { const p = players.find(pl => pl.id === r.key); return p && rosterName(p) !== r.name; });
  const isPast = event.date < today();

  const toggleClosed = () => updateDoc(doc(db, "attendance_events", event.id), { closed: !event.closed });

  const updateRoster = async (e) => {
    e?.stopPropagation();
    if (!window.confirm([newPlayers.length && `${newPlayers.length} neue(n) Spieler hinzufügen`, renamed.length && `${renamed.length} Namen aktualisieren`].filter(Boolean).join(" und ") + "?")) return;
    const merged = [...roster.map(r => { const p = players.find(pl => pl.id === r.key); return p ? { ...r, name: rosterName(p) } : r; }), ...buildRoster(newPlayers)];
    await updateDoc(doc(db, "attendance_events", event.id), { roster: merged, rosterKeys: merged.map(r => r.key) });
  };

  const handleDelete = async () => {
    if (!window.confirm(`Termin „${event.title || event.type}“ mit allen Rückmeldungen löschen?`)) return;
    for (const sub of ["responses", "contacts"]) {
      const snap = await getDocs(collection(db, "attendance_events", event.id, sub));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    }
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
          <span style={{ color: "#888" }}>offen {counts.open}</span>
          {event.maxPlayers && <span style={{ color: isFull ? "#c0392b" : "#2146d0" }}>👍 {lists.confirmed.length}/{event.maxPlayers}</span>}
          <span style={{ marginLeft: "auto", color: "#888", fontWeight: "normal" }}>{open ? "▲" : "▼"}</span>
        </div>
        {(newPlayers.length > 0 || renamed.length > 0) && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "8px", padding: "6px 8px", background: "#eef2ff", borderRadius: "6px", fontSize: "12px", color: "#2146d0" }}>
            <span>🆕 {[newPlayers.length && `${newPlayers.length} neue(r) Spieler noch nicht in der Abstimmung`, renamed.length && `${renamed.length} Name(n) geändert`].filter(Boolean).join(", ")}</span>
            <button onClick={updateRoster} style={{ ...btn("#2146d0"), marginLeft: "auto" }}>🔄 Spielerliste aktualisieren</button>
          </div>
        )}
      </div>

      {open && (
        <div style={{ marginTop: "10px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
            <button onClick={() => shareViaWhatsApp(shareText(event))} style={btn("#25d366")}>📤 Per WhatsApp teilen</button>
            <button onClick={copyLink} style={btn("#eef2ff", "#2146d0")}>🔗 Link kopieren</button>
            {missing.length > 0 && !event.closed && <button onClick={() => shareViaWhatsApp(reminderText(event, missing.map(r => r.name)))} style={btn("#f39c12")}>⏰ Erinnern ({missing.length})</button>}
            <button onClick={toggleClosed} style={btn("#7f8c8d")}>{event.closed ? "🔓 Wieder öffnen" : "🔒 Abstimmung beenden"}</button>
            <button onClick={() => shareViaWhatsApp(resultText(event, responses))} style={btn("#128c7e")}>📋 Ergebnis teilen</button>
            <button onClick={handleDelete} style={btn("white", "#c0392b")}>🗑️</button>
          </div>
          {(event.meetTime || event.location || event.note) && (
            <p style={{ fontSize: "12px", color: "#555", margin: "0 0 8px 0" }}>
              {event.meetTime && `⏱ Treffpunkt ${event.meetTime} Uhr  `}{event.location && `📍 ${event.location}  `}{event.note && `ℹ️ ${event.note}`}
            </p>
          )}
          <div style={{ background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "8px 10px", marginBottom: "10px", fontSize: "12px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span>👥 <strong>{event.maxPlayers ? `Max. ${event.maxPlayers} Kinder` : "Keine Höchstzahl"}</strong></span>
            <button onClick={changeMax} style={btn("#eef2ff", "#2146d0")}>✏️ Ändern</button>
            <span style={{ color: "#555" }}>👍 {lists.confirmed.length} bestätigt · ⏳ {lists.waitlist.length} Warteliste{lists.undecided.length > 0 && ` · ${lists.undecided.length} noch nicht eingeteilt`}</span>
            <span style={{ color: "#555", flexBasis: "100%" }}>🧺 Trikotwäsche: <strong>{laundry || "noch niemand"}</strong></span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <tbody>
              {[...roster].sort((a, b) => {
                const rank = (key) => (statusOf(responses[key]) ? { yes: 0, no: 1 }[responses[key].status] : 2);
                return rank(a.key) - rank(b.key) || a.name.localeCompare(b.name);
              }).map(r => {
                const response = responses[r.key];
                const s = statusOf(response);
                const phone = contacts[r.key]?.phone;
                const sel = response?.status === "yes" ? selection[r.key] : null;
                return (
                  <tr key={r.key} style={{ background: s ? s.background : "white", borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "6px 8px", fontWeight: "bold" }}>
                      {r.name}{response?.laundry && <span title="übernimmt Trikotwäsche"> 🧺</span>}
                      {sel && <div style={{ fontSize: "11px", color: SELECTION[sel].color }}>{SELECTION[sel].icon} {SELECTION[sel].label}</div>}
                    </td>
                    <td style={{ padding: "6px 8px", color: s ? s.color : "#999", fontWeight: "bold", whiteSpace: "nowrap" }}>
                      {s ? `${s.icon} ${s.label}` : "– offen –"}
                      {s && <div style={{ fontSize: "11px", color: "#888", fontWeight: "normal" }}>{formatResponseTime(response.updatedAt)}</div>}
                    </td>
                    <td style={{ padding: "6px 8px", color: "#555", fontSize: "12px" }}>
                      {response?.comment}
                      {phone && <div><a href={phoneLink(phone)} style={{ color: "#2146d0" }}>📞 {phone}</a></div>}
                    </td>
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap", textAlign: "right" }}>
                      {response?.status === "yes" && (
                        <>
                          <button onClick={() => setSelection(r.key, "confirmed")} title="Bestätigen" style={{ ...btn(sel === "confirmed" ? SELECTION.confirmed.color : "#eee", sel === "confirmed" ? "white" : "#333"), padding: "5px 8px", marginRight: "4px" }}>👍</button>
                          <button onClick={() => setSelection(r.key, "waitlist")} title="Warteliste" style={{ ...btn(sel === "waitlist" ? SELECTION.waitlist.color : "#eee", sel === "waitlist" ? "white" : "#333"), padding: "5px 8px" }}>⏳</button>
                        </>
                      )}
                    </td>
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
      const maxPlayers = parseInt(form.maxPlayers, 10) > 0 ? parseInt(form.maxPlayers, 10) : null;
      const data = { ...form, title: form.title.trim(), maxPlayers, selection: {}, clubId, team, roster, rosterKeys: roster.map(r => r.key), closed: false, createdByName: coachName, createdAt: serverTimestamp() };
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
          <div style={{ marginBottom: "8px" }}><label style={labelStyle}>Max. Anzahl Kinder (optional)</label><input type="number" min="1" value={form.maxPlayers} onChange={set("maxPlayers")} placeholder="z. B. 10 – wird den Eltern als Hinweis angezeigt" style={inputStyle} /></div>
          <div style={{ marginBottom: "10px" }}><label style={labelStyle}>Hinweis an die Eltern</label><input value={form.note} onChange={set("note")} placeholder="z. B. Trikots mitbringen, Fahrgemeinschaften" style={inputStyle} /></div>
          <p style={{ fontSize: "11px", color: "#888", margin: "0 0 10px 0" }}>{players.length} aktive Spieler werden in die Abstimmung übernommen (mit Vor- und Nachnamen).</p>
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
