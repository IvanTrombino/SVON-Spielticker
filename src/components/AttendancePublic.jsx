import { useState, useEffect } from "react";
import { doc, collection, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { STATUS, SELECTION, formatEventDate, formatResponseTime, countResponses, statusOf, laundryName } from "../attendance";
import logo from "../assets/SVON-Wappen.png";

const MY_KIDS_KEY = "svon_my_kids";
const loadMyKids = () => { try { return JSON.parse(localStorage.getItem(MY_KIDS_KEY) || "[]"); } catch { return []; } };
const rememberKid = (key) => {
  try { localStorage.setItem(MY_KIDS_KEY, JSON.stringify([...new Set([...loadMyKids(), key])])); } catch { /* egal */ }
};

const PHONE_KEY = "svon_parent_phone";
const loadPhone = () => { try { return localStorage.getItem(PHONE_KEY) || ""; } catch { return ""; } };
const rememberPhone = (phone) => { try { localStorage.setItem(PHONE_KEY, phone); } catch { /* egal */ } };

// Eltern-Seite: Zu-/Absage ohne Anmeldung über den geteilten Link (?zusage=<id>)
export default function AttendancePublic({ eventId }) {
  const [event, setEvent] = useState(undefined); // undefined = lädt, null = nicht gefunden
  const [responses, setResponses] = useState({});
  const [myKids, setMyKids] = useState(loadMyKids);
  const [comments, setComments] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [phones, setPhones] = useState({});
  const [savedPhones, setSavedPhones] = useState({});

  useEffect(() => {
    const unsubEvent = onSnapshot(doc(db, "attendance_events", eventId),
      (snap) => setEvent(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setEvent(null));
    const unsubResponses = onSnapshot(collection(db, "attendance_events", eventId, "responses"),
      (snap) => setResponses(Object.fromEntries(snap.docs.map(d => [d.id, d.data()]))),
      () => setResponses({}));
    return () => { unsubEvent(); unsubResponses(); };
  }, [eventId]);

  const answer = async (key, status, laundry = !!responses[key]?.laundry) => {
    setSavingKey(key);
    try {
      const comment = (comments[key] ?? responses[key]?.comment ?? "").slice(0, 200);
      await setDoc(doc(db, "attendance_events", eventId, "responses", key), { status, comment, laundry, updatedAt: serverTimestamp() });
      rememberKid(key);
      setMyKids(loadMyKids());
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      alert("Speichern hat nicht geklappt. Ist die Abstimmung vielleicht schon beendet?");
    } finally {
      setSavingKey(null);
    }
  };

  // Telefonnummer geht nur an die Trainer (Eltern können sie nicht lesen)
  const savePhone = async (key) => {
    const phone = (phones[key] ?? "").trim().slice(0, 30);
    if (phone === (savedPhones[key] ?? "")) return;
    try {
      await setDoc(doc(db, "attendance_events", eventId, "contacts", key), { phone, updatedAt: serverTimestamp() });
      setSavedPhones({ ...savedPhones, [key]: phone });
      if (phone) rememberPhone(phone);
    } catch (error) {
      console.error("Telefonnummer speichern:", error);
      alert("Telefonnummer konnte nicht gespeichert werden.");
    }
  };

  const page = (children) => (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", padding: "16px", boxSizing: "border-box", fontFamily: "sans-serif", color: "#333" }}>
      <div style={{ maxWidth: "520px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          <img src={logo} alt="SVON" style={{ width: "56px" }} />
        </div>
        {children}
      </div>
    </div>
  );

  if (event === undefined) return page(<p style={{ textAlign: "center", color: "#666" }}>Lade...</p>);
  if (event === null) return page(<p style={{ textAlign: "center", color: "#c0392b" }}>Diese Abstimmung gibt es nicht (mehr). Bitte den Link beim Trainer prüfen.</p>);

  const roster = [...(event.roster || [])].sort((a, b) => (myKids.includes(b.key) ? 1 : 0) - (myKids.includes(a.key) ? 1 : 0));
  const counts = countResponses(event.roster || [], responses);
  const laundry = laundryName(event.roster || [], responses);
  const selection = event.selection || {};
  const confirmedCount = (event.roster || []).filter(r => responses[r.key]?.status === "yes" && selection[r.key] === "confirmed").length;

  return page(
    <>
      <div style={{ background: "white", borderRadius: "12px", padding: "16px", marginBottom: "12px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: "12px", color: "#2146d0", fontWeight: "bold" }}>{event.team} · {event.type}</div>
        <h2 style={{ margin: "4px 0 8px 0", fontSize: "20px", color: "#222" }}>{event.title || event.type}</h2>
        <div style={{ fontSize: "14px", lineHeight: 1.6 }}>
          📅 {formatEventDate(event)}
          {event.meetTime && <><br />⏱ Treffpunkt {event.meetTime} Uhr</>}
          {event.location && <><br />📍 {event.location}</>}
          {event.note && <><br />ℹ️ {event.note}</>}
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap", fontSize: "13px", fontWeight: "bold" }}>
          <span style={{ color: STATUS.yes.color }}>✅ {counts.yes}</span>
          <span style={{ color: STATUS.no.color }}>❌ {counts.no}</span>
          <span style={{ color: "#888" }}>offen {counts.open}</span>
        </div>
        {event.maxPlayers && (
          <p style={{ margin: "10px 0 0 0", padding: "8px 10px", background: "#fff8e1", borderRadius: "8px", fontSize: "13px", color: "#7a5b00" }}>
            👥 <strong>Max. {event.maxPlayers} Kinder.</strong> Die Trainer entscheiden, wer dabei ist und wer auf die Warteliste kommt.
            {confirmedCount > 0 && <> Bisher bestätigt: {confirmedCount}/{event.maxPlayers}.</>}
          </p>
        )}
        <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#555" }}>🧺 Trikotwäsche: <strong>{laundry || "noch offen – wer übernimmt?"}</strong></p>
        {event.closed && <p style={{ margin: "10px 0 0 0", color: "#c0392b", fontWeight: "bold", fontSize: "13px" }}>🔒 Die Abstimmung ist beendet.</p>}
      </div>

      {!event.closed && <p style={{ fontSize: "13px", color: "#555", margin: "0 0 8px 4px" }}>Tippe bei deinem Kind auf „Bin dabei“ oder „Bin nicht dabei“:</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {roster.map(r => {
          const current = statusOf(responses[r.key]) ? responses[r.key] : null;
          const mine = myKids.includes(r.key);
          const sel = current?.status === "yes" ? selection[r.key] : null;
          const laundryTaken = laundry && !current?.laundry;
          return (
            <div key={r.key} style={{ background: current ? STATUS[current.status].background : "white", border: mine ? "2px solid #2146d0" : "1px solid #e0e0e0", borderRadius: "10px", padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "15px" }}>{r.name}{mine && <span style={{ fontSize: "11px", color: "#2146d0", marginLeft: "6px" }}>(dein Kind)</span>}</strong>
                {current && <span style={{ fontSize: "13px", fontWeight: "bold", color: STATUS[current.status].color }}>{STATUS[current.status].icon} {STATUS[current.status].label}</span>}
              </div>
              {current && (
                <div style={{ fontSize: "11px", color: "#777", marginTop: "2px" }}>
                  {current.updatedAt && <>abgestimmt am {formatResponseTime(current.updatedAt)}</>}
                  {current.laundry && <span style={{ marginLeft: "6px", color: "#2146d0", fontWeight: "bold" }}>🧺 übernimmt Trikotwäsche</span>}
                  {sel && <span style={{ marginLeft: "6px", color: SELECTION[sel].color, fontWeight: "bold" }}>{SELECTION[sel].icon} {SELECTION[sel].label}</span>}
                </div>
              )}
              {current?.comment && <div style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>💬 {current.comment}</div>}
              {!event.closed && (
                <>
                  <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                    {Object.entries(STATUS).map(([status, s]) => (
                      <button
                        key={status}
                        disabled={savingKey === r.key}
                        onClick={() => answer(r.key, status)}
                        style={{ flex: 1, padding: "10px 4px", borderRadius: "8px", border: current?.status === status ? `2px solid ${s.color}` : "1px solid #ccc", background: current?.status === status ? s.background : "white", color: "#333", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}
                      >
                        {s.icon} {s.label}
                      </button>
                    ))}
                  </div>
                  {current && (!laundryTaken || current.laundry) && (
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "13px", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!current.laundry} disabled={savingKey === r.key} onChange={(e) => answer(r.key, current.status, e.target.checked)} />
                      🧺 Übernehme Trikotwäsche
                    </label>
                  )}
                  {mine && (
                    <input
                      type="tel"
                      maxLength={30}
                      placeholder="Telefonnummer (optional, nur für die Trainer sichtbar)"
                      value={phones[r.key] ?? savedPhones[r.key] ?? ""}
                      onFocus={() => phones[r.key] === undefined && !savedPhones[r.key] && setPhones({ ...phones, [r.key]: loadPhone() })}
                      onChange={(e) => setPhones({ ...phones, [r.key]: e.target.value })}
                      onBlur={() => savePhone(r.key)}
                      style={{ marginTop: "8px", width: "100%", boxSizing: "border-box", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", background: "#fff", color: "#333" }}
                    />
                  )}
                  {mine && (
                    <input
                      type="text"
                      maxLength={200}
                      placeholder="Kommentar (optional), z. B. kommt später"
                      value={comments[r.key] ?? current?.comment ?? ""}
                      onChange={(e) => setComments({ ...comments, [r.key]: e.target.value })}
                      onBlur={() => current && (comments[r.key] ?? "") !== (current.comment ?? "") && answer(r.key, current.status)}
                      style={{ marginTop: "8px", width: "100%", boxSizing: "border-box", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", background: "#fff", color: "#333" }}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: "11px", color: "#999", textAlign: "center", marginTop: "16px" }}>SV Orsingen-Nenzingen · Live-Ticker</p>
    </>
  );
}
