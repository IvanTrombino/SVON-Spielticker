import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { compareTeamNames } from "../teamOrder";
import { todayString, addDays, formatInfoDate, visibleInfos, sendTrainerPush, shareViaWhatsApp } from "../trainerInfo";

const MAX_DAYS = 365;
const emptyForm = () => ({ id: null, title: "", text: "", teams: [], from: todayString(), until: "" });

// Pinnwand für Trainer und Admins. Jede Info hat einen Zeitraum und wird nach Ablauf gelöscht.
// viewerTeams = Mannschaften des Betrachters (null = alle sehen), canModerate = Admin darf alle Infos bearbeiten/löschen
export default function TrainerInfos({ clubId, infos, viewerTeams, uid, authorName, canModerate = false }) {
  const [allTeams, setAllTeams] = useState([]);
  const [form, setForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!clubId) return;
    return onSnapshot(doc(db, "youth_settings", clubId), (snap) => {
      const list = snap.exists() ? snap.data().teams || [] : [];
      setAllTeams(list.map(t => t.name).sort(compareTeamNames));
    });
  }, [clubId]);

  const today = todayString();
  const shown = canModerate ? infos : visibleInfos(infos, viewerTeams, uid);

  const infoText = (i) => [`📢 ${i.title}`, i.text, "", `Gültig bis ${formatInfoDate(i.until)} · ${i.authorName}`].filter((line, idx) => idx !== 1 || line).join("\n");

  const toggleTeam = (team) =>
    setForm({ ...form, teams: form.teams.includes(team) ? form.teams.filter(t => t !== team) : [...form.teams, team] });

  const saveInfo = async () => {
    const title = form.title.trim();
    if (!title) return alert("Bitte einen Titel eingeben.");
    if (!form.from || !form.until) return alert("Bitte den Zeitraum angeben – bis wann soll die Info angezeigt werden?");
    if (form.from > form.until) return alert("Das Enddatum darf nicht vor dem Startdatum liegen.");
    if (form.until < today) return alert("Das Enddatum liegt in der Vergangenheit.");
    if (form.until > addDays(today, MAX_DAYS)) return alert(`Eine Info kann höchstens ${MAX_DAYS} Tage angezeigt werden.`);

    const data = {
      clubId,
      title,
      text: form.text.trim(),
      teams: form.teams,
      from: form.from,
      until: form.until,
      expiresAt: Timestamp.fromDate(new Date(`${form.until}T23:59:59`))
    };

    setIsSaving(true);
    try {
      if (form.id) {
        await updateDoc(doc(db, "trainer_infos", form.id), data);
      } else {
        await addDoc(collection(db, "trainer_infos"), { ...data, authorUid: uid, authorName, createdAt: serverTimestamp() });
        if (form.from <= today) sendTrainerPush(clubId, infoText({ ...data, authorName }));
      }
      setForm(null);
    } catch (error) {
      console.error("Info speichern:", error);
      alert("Die Info konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeInfo = async (info) => {
    if (!window.confirm(`Info „${info.title}“ wirklich löschen?`)) return;
    try {
      await deleteDoc(doc(db, "trainer_infos", info.id));
    } catch (error) {
      console.error("Info löschen:", error);
      alert("Die Info konnte nicht gelöscht werden.");
    }
  };

  const inputStyle = { width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box", background: "#fff", color: "#333", margin: "4px 0 10px 0" };
  const labelStyle = { fontSize: "12px", fontWeight: "bold", color: "#555" };
  const smallButton = (bg) => ({ background: bg, color: "white", border: "none", borderRadius: "4px", padding: "6px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" });

  return (
    <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", color: "#333" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #eee", paddingBottom: "10px", marginBottom: "15px", gap: "10px", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, color: "#34495e", fontSize: "16px" }}>📢 Infos für Trainer</h3>
        {!form && <button onClick={() => setForm(emptyForm())} style={{ background: "#2146d0", color: "white", border: "none", borderRadius: "6px", padding: "8px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>➕ Neue Info</button>}
      </div>

      {form && (
        <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: "8px", padding: "12px", marginBottom: "15px" }}>
          <label style={labelStyle}>Titel</label>
          <input type="text" maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z. B. Kabinen am Samstag geschlossen" style={inputStyle} />

          <label style={labelStyle}>Text (optional)</label>
          <textarea maxLength={2000} rows={4} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }} />

          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Anzeigen ab</label>
              <input type="date" value={form.from} min={form.id ? undefined : today} onChange={(e) => setForm({ ...form, from: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Anzeigen bis *</label>
              <input type="date" value={form.until} min={form.from || today} max={addDays(today, MAX_DAYS)} onChange={(e) => setForm({ ...form, until: e.target.value })} required style={inputStyle} />
            </div>
          </div>
          <p style={{ fontSize: "11px", color: "#666", margin: "-4px 0 10px 0" }}>Nach dem Enddatum wird die Info automatisch gelöscht.</p>

          <label style={labelStyle}>Für wen?</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "4px 0 12px 0" }}>
            <button onClick={() => setForm({ ...form, teams: [] })} style={{ padding: "6px 10px", borderRadius: "14px", border: "1px solid #2146d0", background: form.teams.length === 0 ? "#2146d0" : "white", color: form.teams.length === 0 ? "white" : "#2146d0", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>Alle Trainer</button>
            {allTeams.map(t => {
              const active = form.teams.includes(t);
              return <button key={t} onClick={() => toggleTeam(t)} style={{ padding: "6px 10px", borderRadius: "14px", border: "1px solid #2146d0", background: active ? "#2146d0" : "white", color: active ? "white" : "#2146d0", fontSize: "12px", cursor: "pointer" }}>{t}</button>;
            })}
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={saveInfo} disabled={isSaving} style={{ flex: 1, padding: "11px", background: "#27ae60", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: isSaving ? "not-allowed" : "pointer" }}>{isSaving ? "Speichere..." : "💾 Speichern"}</button>
            <button onClick={() => setForm(null)} style={{ flex: 1, padding: "11px", background: "#eee", color: "#333", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Abbrechen</button>
          </div>
        </div>
      )}

      {shown.length === 0 ? <p style={{ color: "#777", fontSize: "13px", textAlign: "center" }}>Aktuell gibt es keine Infos.</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {shown.map(i => {
            const canEdit = canModerate || i.authorUid === uid;
            const planned = i.from > today;
            return (
              <div key={i.id} style={{ border: "1px solid #ddd", borderLeft: `4px solid ${planned ? "#95a5a6" : "#2146d0"}`, borderRadius: "8px", padding: "10px 12px", background: planned ? "#f8f9fa" : "white" }}>
                <div style={{ fontWeight: "bold", fontSize: "15px", color: "#2c3e50" }}>{i.title}</div>
                {i.text && <div style={{ fontSize: "13px", color: "#333", whiteSpace: "pre-wrap", marginTop: "4px" }}>{i.text}</div>}
                <div style={{ fontSize: "11px", color: "#777", marginTop: "6px" }}>
                  {planned ? `⏳ Wird ab ${formatInfoDate(i.from)} angezeigt · ` : ""}Gültig bis {formatInfoDate(i.until)} · {i.teams.length ? i.teams.join(", ") : "Alle Trainer"} · {i.authorName}
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                  <button onClick={() => shareViaWhatsApp(infoText(i))} style={smallButton("#25d366")}>📤 WhatsApp</button>
                  {canEdit && <button onClick={() => setForm({ id: i.id, title: i.title, text: i.text, teams: i.teams, from: i.from, until: i.until })} style={smallButton("#f39c12")}>✏️ Bearbeiten</button>}
                  {canEdit && <button onClick={() => removeInfo(i)} style={smallButton("#e74c3c")}>🗑 Löschen</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
