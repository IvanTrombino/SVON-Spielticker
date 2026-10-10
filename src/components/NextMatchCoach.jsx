import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, updateDoc, deleteField, FieldPath, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { findLinkedTeamId, fetchTeamMatches, nextMatchFrom } from "../fussballde";
import { NEXT_KINDS, effectiveNextMatch, isActiveOverride, nextMatchTitle, formatNextDate, meetText, differencesToAuto, nextMatchShareText } from "../nextMatch";
import { shareViaWhatsApp } from "../attendance";

const inputStyle = { padding: "9px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "13px", width: "100%", boxSizing: "border-box" };
const labelStyle = { fontSize: "11px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "3px" };
const btn = (background, color = "white") => ({ padding: "8px 12px", background, color, border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" });

const toForm = (m) => ({
  kind: m?.kind || "Spiel", isHome: m?.isHome ?? true, opponent: m?.opponent || "", date: m?.date || "", time: m?.time || "",
  location: m?.location || "", meetTime: m?.meetTime || "", meetPlace: m?.meetPlace || "",
  note: m?.note || "", equipment: m?.equipment || "", organization: m?.organization || ""
});

// Trainer Portal: Nächstes Spiel der Mannschaft – fussball.de automatisch, Trainer-Angaben mit Vorrang
export default function NextMatchCoach({ clubId, team, coachName }) {
  const [fussballLinks, setFussballLinks] = useState({});
  const [auto, setAuto] = useState(null);
  const [autoState, setAutoState] = useState("idle"); // idle | loading | error
  const [entries, setEntries] = useState({});
  const [form, setForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const nextRef = doc(db, "ticker", `${clubId}_next_matches`);
  const linkedTeamId = findLinkedTeamId(fussballLinks, team);

  useEffect(() => {
    if (!clubId) return;
    const unsubLinks = onSnapshot(doc(db, "ticker", `${clubId}_fussballde`), (snap) => setFussballLinks(snap.exists() ? snap.data().links || {} : {}));
    const unsubNext = onSnapshot(doc(db, "ticker", `${clubId}_next_matches`), (snap) => setEntries(snap.exists() ? snap.data() : {}),
      (error) => console.error("Nächste Spiele laden:", error));
    return () => { unsubLinks(); unsubNext(); };
  }, [clubId]);

  const loadAuto = async () => {
    if (!linkedTeamId) return setAuto(null);
    setAutoState("loading");
    try {
      setAuto(nextMatchFrom(await fetchTeamMatches(linkedTeamId)));
      setAutoState("idle");
    } catch (error) {
      console.error("fussball.de:", error);
      setAutoState("error");
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!linkedTeamId) return;
    fetchTeamMatches(linkedTeamId)
      .then((matches) => { if (!cancelled) { setAuto(nextMatchFrom(matches)); setAutoState("idle"); } })
      .catch((error) => { console.error("fussball.de:", error); if (!cancelled) setAutoState("error"); });
    return () => { cancelled = true; };
  }, [linkedTeamId]);

  if (!team) return <p style={{ color: "#777", textAlign: "center" }}>Für diese Mannschaft gibt es noch kein Team im Live-Ticker. Bitte im Admin Portal unter „Teams“ anlegen.</p>;

  const manual = entries[team];
  const shownAuto = linkedTeamId ? auto : null;
  const current = effectiveNextMatch(shownAuto, manual);
  const hasOverride = isActiveOverride(manual);
  const differences = hasOverride ? differencesToAuto(manual, shownAuto) : [];

  const set = (name) => (e) => setForm({ ...form, [name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.date) return alert("Bitte ein Datum angeben.");
    setIsSaving(true);
    try {
      const entry = {
        ...form,
        opponent: form.opponent.trim(), location: form.location.trim(), meetPlace: form.meetPlace.trim(),
        note: form.note.trim(), equipment: form.equipment.trim(), organization: form.organization.trim(),
        competition: shownAuto && shownAuto.date === form.date ? shownAuto.competition || "" : "",
        override: true, updatedBy: coachName, updatedAt: serverTimestamp()
      };
      // Mannschaftsnamen mit Punkt ("1. Mannschaft") nicht als Feldpfad deuten
      await setDoc(nextRef, { [team]: entry }, { merge: true });
      setForm(null);
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      alert("Speichern hat nicht geklappt.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetToAuto = async () => {
    if (!window.confirm("Eigene Angaben löschen und wieder die Daten von fussball.de anzeigen?")) return;
    await updateDoc(nextRef, new FieldPath(team), deleteField());
  };

  const row = (icon, label, value) => value ? <div style={{ fontSize: "13px", marginTop: "4px" }}>{icon} <strong>{label}:</strong> {value}</div> : null;

  return (
    <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", textAlign: "left" }}>
      <h3 style={{ margin: "0 0 6px 0", color: "#2146d0", fontSize: "17px" }}>📅 Nächstes Spiel · {team}</h3>
      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 12px 0" }}>
        {linkedTeamId
          ? "Wird automatisch von fussball.de übernommen. Eigene Angaben haben Vorrang, bis das Spiel vorbei ist – danach erscheint wieder das nächste Spiel von fussball.de."
          : "Diese Mannschaft ist nicht mit fussball.de verknüpft – bitte den Termin selbst eintragen."}
      </p>

      {!form && (
        <>
          <div style={{ border: "1px solid #e0e0e0", borderRadius: "10px", padding: "12px", background: "#f8f9fa", marginBottom: "10px" }}>
            {autoState === "loading" && !current && <p style={{ color: "#666", margin: 0 }}>Lade fussball.de...</p>}
            {current ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "15px" }}>{nextMatchTitle(current)}</strong>
                  <span style={{ fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px", background: current.source === "trainer" ? "#fef9e7" : "#e8f8f5", color: current.source === "trainer" ? "#7a5b00" : "#1e8449" }}>
                    {current.source === "trainer" ? `✏️ vom Trainer${current.updatedBy ? ` (${current.updatedBy})` : ""}` : current.source === "fussball.de" ? "🔄 fussball.de" : "✏️ manuell"}
                  </span>
                </div>
                {row("📅", "Wann", `${formatNextDate(current.date)}${current.time ? `, ${current.time} Uhr` : ""}`)}
                {row("📍", "Spielort", current.location)}
                {row("⏱", "Treffpunkt", meetText(current))}
                {row("🎒", "Mitbringen", current.equipment)}
                {row("ℹ️", "Hinweise", current.note)}
                {row("📋", "Organisatorisches", current.organization)}
                {current.competition && <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>{current.competition}</div>}
              </>
            ) : autoState !== "loading" && <p style={{ color: "#777", margin: 0 }}>{autoState === "error" ? "fussball.de konnte nicht geladen werden. " : ""}Kein kommender Termin vorhanden.</p>}
          </div>

          {differences.length > 0 && (
            <div style={{ background: "#fdecea", border: "1px solid #f5b7b1", borderRadius: "8px", padding: "8px 10px", fontSize: "12px", color: "#922b21", marginBottom: "10px" }}>
              ⚠️ fussball.de meldet abweichend: {differences.join(" · ")}. Angezeigt werden weiterhin deine Angaben.
            </div>
          )}

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {current
              ? <button onClick={() => setForm(toForm(current))} style={btn("#2146d0")}>✏️ Bearbeiten / ergänzen</button>
              : <button onClick={() => setForm(toForm(null))} style={btn("#27ae60")}>➕ Termin anlegen</button>}
            {current && <button onClick={() => setForm(toForm(null))} style={btn("#eef2ff", "#2146d0")}>➕ Anderen Termin anlegen</button>}
            {hasOverride && linkedTeamId && <button onClick={resetToAuto} style={btn("#7f8c8d")}>🔄 Wieder fussball.de verwenden</button>}
            {linkedTeamId && <button onClick={loadAuto} disabled={autoState === "loading"} style={btn("#eef2ff", "#2146d0")}>↻ fussball.de neu laden</button>}
            {current && <button onClick={() => shareViaWhatsApp(nextMatchShareText(team, current))} style={btn("#25d366")}>📤 Per WhatsApp teilen</button>}
          </div>
        </>
      )}

      {form && (
        <form onSubmit={handleSave} style={{ background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: "10px", padding: "12px" }}>
          {shownAuto && <button type="button" onClick={() => setForm({ ...form, ...toForm(shownAuto), meetTime: form.meetTime, meetPlace: form.meetPlace, note: form.note, equipment: form.equipment, organization: form.organization })} style={{ ...btn("#eef2ff", "#2146d0"), width: "100%", marginBottom: "10px" }}>📥 Spieldaten von fussball.de einsetzen</button>}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
            <div style={{ flex: "1 1 140px" }}>
              <label style={labelStyle}>Art</label>
              <select value={form.kind} onChange={set("kind")} style={inputStyle}>{NEXT_KINDS.map(k => <option key={k}>{k}</option>)}</select>
            </div>
            {(form.kind === "Spiel" || form.kind === "Freundschaftsspiel") && (
              <div style={{ flex: "1 1 140px" }}>
                <label style={labelStyle}>Heim / Auswärts</label>
                <select value={form.isHome ? "heim" : "auswaerts"} onChange={(e) => setForm({ ...form, isHome: e.target.value === "heim" })} style={inputStyle}>
                  <option value="heim">🏠 Heimspiel</option>
                  <option value="auswaerts">🚌 Auswärtsspiel</option>
                </select>
              </div>
            )}
          </div>
          <div style={{ marginBottom: "8px" }}>
            <label style={labelStyle}>{form.kind === "Turnier" ? "Turniername" : form.kind === "Sonstiges" ? "Bezeichnung" : "Gegner"}</label>
            <input value={form.opponent} onChange={set("opponent")} placeholder={form.kind === "Turnier" ? "z. B. Hallenturnier Singen" : "z. B. FC Radolfzell"} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
            <div style={{ flex: "1 1 130px" }}><label style={labelStyle}>Datum *</label><input type="date" value={form.date} onChange={set("date")} style={inputStyle} /></div>
            <div style={{ flex: "1 1 100px" }}><label style={labelStyle}>Uhrzeit</label><input type="time" value={form.time} onChange={set("time")} style={inputStyle} /></div>
          </div>
          <div style={{ marginBottom: "8px" }}><label style={labelStyle}>Spielort</label><input value={form.location} onChange={set("location")} placeholder="z. B. Sportpark Orsingen" style={inputStyle} /></div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
            <div style={{ flex: "1 1 100px" }}><label style={labelStyle}>Treffpunkt Uhrzeit</label><input type="time" value={form.meetTime} onChange={set("meetTime")} style={inputStyle} /></div>
            <div style={{ flex: "3 1 200px" }}><label style={labelStyle}>Treffpunkt Ort</label><input value={form.meetPlace} onChange={set("meetPlace")} placeholder="z. B. Parkplatz Sportheim" style={inputStyle} /></div>
          </div>
          <div style={{ marginBottom: "8px" }}><label style={labelStyle}>Mitzubringende Ausrüstung</label><input value={form.equipment} onChange={set("equipment")} placeholder="z. B. Schienbeinschoner, Hallenschuhe, Trinkflasche" style={inputStyle} /></div>
          <div style={{ marginBottom: "8px" }}><label style={labelStyle}>Zusatzinformationen / Hinweise</label><textarea value={form.note} onChange={set("note")} rows={2} placeholder="z. B. Spiel wurde um 30 Minuten verschoben" style={{ ...inputStyle, resize: "vertical" }} /></div>
          <div style={{ marginBottom: "10px" }}><label style={labelStyle}>Sonstige organisatorische Informationen</label><textarea value={form.organization} onChange={set("organization")} rows={2} placeholder="z. B. Fahrgemeinschaften, Trikotwäsche, Verpflegung" style={{ ...inputStyle, resize: "vertical" }} /></div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" disabled={isSaving} style={{ ...btn("#27ae60"), flex: 1, padding: "11px" }}>{isSaving ? "Speichert..." : "💾 Speichern"}</button>
            <button type="button" onClick={() => setForm(null)} style={{ ...btn("#eee", "#333"), flex: 1, padding: "11px" }}>Abbrechen</button>
          </div>
        </form>
      )}
    </div>
  );
}
