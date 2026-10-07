import { useState, useEffect } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, where, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULT_CAMP_SETTINGS, SHIRT_SIZES, participantFee, participantCosts, participantCostSum, formatEuro } from "../summerCamp";

const today = () => new Date().toLocaleDateString("sv-SE");
const formatDate = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE") : (iso || "");

const emptyParticipant = () => ({
  lastName: "", firstName: "", birthDate: "", club: "SV Orsingen-Nenzingen", guardian: "", phone: "", email: "",
  allergies: "", registeredAt: today(), sibling: false, member: true, withNumber: true, shirtNumber: "", shirtSize: "",
  paid: false, customFee: "", notes: ""
});

const inputStyle = { padding: "8px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "13px", width: "100%", boxSizing: "border-box" };
const labelStyle = { fontSize: "11px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "3px" };
const cell = { padding: "6px 8px", fontSize: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" };

// Sommercamp-Verwaltung (nur Admins): Anmeldungen, Kostenkalkulation, Export
export default function SummerCamp({ clubId }) {
  const [campYear, setCampYear] = useState(new Date().getFullYear());
  const [participants, setParticipants] = useState([]);
  const [settingsByYear, setSettingsByYear] = useState({});
  const [form, setForm] = useState(null); // null = Formular zu; sonst { ...daten, id? }
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const settings = { ...DEFAULT_CAMP_SETTINGS, ...(settingsByYear[campYear] || {}) };
  const settingsRef = doc(db, "summercamp_settings", clubId);

  useEffect(() => {
    if (!clubId) return;
    return onSnapshot(doc(db, "summercamp_settings", clubId), (snap) => {
      setSettingsByYear(snap.exists() ? snap.data().years || {} : {});
    });
  }, [clubId]);

  useEffect(() => {
    if (!clubId) return;
    const q = query(collection(db, "summercamp_participants"), where("clubId", "==", clubId), where("campYear", "==", campYear));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.registeredAt || "").localeCompare(b.registeredAt || "") || (a.lastName || "").localeCompare(b.lastName || ""));
      setParticipants(list);
    });
  }, [clubId, campYear]);

  // --- Berechnungen ---
  const rows = participants.map((p, i) => ({ ...p, nr: i + 1, fee: participantFee(p, settings), costs: participantCosts(p, settings), costSum: participantCostSum(p, settings) }));
  const visibleRows = rows.filter(p => !search || `${p.lastName} ${p.firstName} ${p.guardian}`.toLowerCase().includes(search.toLowerCase()));
  const totalFees = rows.reduce((s, p) => s + p.fee, 0);
  const paidFees = rows.filter(p => p.paid).reduce((s, p) => s + p.fee, 0);
  const totalCosts = rows.reduce((s, p) => s + p.costSum, 0);
  const sizeCounts = rows.reduce((acc, p) => { if (p.shirtSize) acc[p.shirtSize] = (acc[p.shirtSize] || 0) + 1; return acc; }, {});

  // --- Teilnehmer speichern ---
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.lastName.trim() || !form.firstName.trim()) return alert("Bitte Vor- und Nachname eintragen.");
    setIsSaving(true);
    try {
      const { id, ...data } = form;
      const payload = { ...data, lastName: data.lastName.trim(), firstName: data.firstName.trim(), clubId, campYear };
      if (id) await updateDoc(doc(db, "summercamp_participants", id), payload);
      else await addDoc(collection(db, "summercamp_participants"), { ...payload, createdAt: new Date().toISOString() });
      setForm(null);
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern!");
    } finally {
      setIsSaving(false);
    }
  };

  const togglePaid = (p) => updateDoc(doc(db, "summercamp_participants", p.id), { paid: !p.paid });

  const handleDelete = async (p) => {
    if (!window.confirm(`${p.firstName} ${p.lastName} endgültig aus dem Sommercamp ${campYear} löschen?`)) return;
    await deleteDoc(doc(db, "summercamp_participants", p.id));
    setForm(null);
  };

  // --- Preise speichern (pro Jahr) ---
  const saveSettings = async () => {
    const clean = {
      baseFee: Number(settingsDraft.baseFee) || 0,
      numberSurcharge: Number(settingsDraft.numberSurcharge) || 0,
      siblingDiscount: Number(settingsDraft.siblingDiscount) || 0,
      nonMemberSurcharge: Number(settingsDraft.nonMemberSurcharge) || 0,
      costItems: settingsDraft.costItems.filter(i => i.name.trim()).map(i => ({ ...i, name: i.name.trim(), price: Number(i.price) || 0 }))
    };
    await setDoc(settingsRef, { years: { ...settingsByYear, [campYear]: clean } });
    setShowSettings(false);
  };

  // --- Export als CSV (Excel, mit Umlauten) ---
  const exportCSV = () => {
    if (rows.length === 0) return alert("Noch keine Anmeldungen vorhanden.");
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
    const euro = (v) => q(Number(v).toFixed(2).replace(".", ","));
    const headers = ["Nr.", "Nachname", "Vorname", "Geburtsdatum", "Verein", "Erziehungsberechtigte", "Telefon", "E-Mail", "Allergien/Unverträglichkeiten",
      "Eingang Anmeldung", "Geschwisterkind", "Mitglied", "Rückennummer", "Wunschnummer", "T-Shirt-Größe", "Teilnahmegebühr", "Bezahlt",
      ...settings.costItems.map(i => `Kosten ${i.name}`), "Summe Kosten", "Bemerkung"];
    const lines = rows.map(p => [
      q(p.nr), q(p.lastName), q(p.firstName), q(formatDate(p.birthDate)), q(p.club), q(p.guardian), q(p.phone), q(p.email), q(p.allergies),
      q(formatDate(p.registeredAt)), q(p.sibling ? "Ja" : "Nein"), q(p.member ? "Ja" : "Nein"), q(p.withNumber ? "Ja" : "Nein"), q(p.shirtNumber), q(p.shirtSize),
      euro(p.fee), q(p.paid ? "Ja" : "Nein"), ...settings.costItems.map(i => euro(p.costs[i.id])), euro(p.costSum), q(p.notes)
    ].join(";"));
    const totals = ["", q("Summe"), "", "", "", "", "", "", "", "", "", "", "", "", "", euro(totalFees), "", ...settings.costItems.map(i => euro(rows.reduce((s, p) => s + p.costs[i.id], 0))), euro(totalCosts), ""].join(";");
    const blob = new Blob(["﻿" + [headers.map(q).join(";"), ...lines, totals].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Sommercamp_${campYear}_${clubId.toUpperCase()}_${today()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const card = (label, value, color) => (
    <div style={{ flex: "1 1 140px", background: "white", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
      <div style={{ fontSize: "18px", fontWeight: "bold", color }}>{value}</div>
      <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>{label}</div>
    </div>
  );

  const setField = (name, value) => setForm(prev => ({ ...prev, [name]: value }));
  const check = (name, label) => (
    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
      <input type="checkbox" checked={!!form[name]} onChange={(e) => setField(name, e.target.checked)} style={{ width: "16px", height: "16px" }} /> {label}
    </label>
  );
  const field = (name, label, type = "text", flex = "1 1 180px") => (
    <div style={{ flex }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={form[name] ?? ""} onChange={(e) => setField(name, e.target.value)} style={inputStyle} />
    </div>
  );

  return (
    <div style={{ fontFamily: "sans-serif", color: "#333", textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "15px" }}>
        <h2 style={{ margin: 0, color: "#e67e22", fontSize: "20px" }}>☀️ Sommercamp</h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <select value={campYear} onChange={(e) => setCampYear(Number(e.target.value))} style={{ ...inputStyle, width: "auto", fontWeight: "bold" }}>
            {[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setForm(emptyParticipant())} style={{ padding: "9px 14px", background: "#27ae60", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>➕ Anmeldung</button>
          <button onClick={() => { setSettingsDraft(JSON.parse(JSON.stringify(settings))); setShowSettings(true); }} style={{ padding: "9px 14px", background: "#7f8c8d", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>⚙ Preise</button>
          <button onClick={exportCSV} style={{ padding: "9px 14px", background: "#2146d0", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>📥 Excel (CSV)</button>
        </div>
      </div>

      {/* ÜBERSICHT */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "15px" }}>
        {card("Anmeldungen", rows.length, "#2146d0")}
        {card(`Bezahlt (${rows.filter(p => p.paid).length})`, formatEuro(paidFees), "#27ae60")}
        {card(`Offen (${rows.filter(p => !p.paid).length})`, formatEuro(totalFees - paidFees), "#c0392b")}
        {card("Einnahmen gesamt", formatEuro(totalFees), "#333")}
        {card("Kosten Material", formatEuro(totalCosts), "#e67e22")}
        {card("Überschuss", formatEuro(totalFees - totalCosts), totalFees - totalCosts >= 0 ? "#27ae60" : "#c0392b")}
      </div>
      {Object.keys(sizeCounts).length > 0 && (
        <p style={{ fontSize: "12px", color: "#555", margin: "0 0 12px 0" }}>
          👕 T-Shirts: {SHIRT_SIZES.filter(s => sizeCounts[s]).map(s => `${s}: ${sizeCounts[s]}`).join(" · ")}
          {rows.some(p => !p.shirtSize) && <span style={{ color: "#c0392b" }}> · ohne Größe: {rows.filter(p => !p.shirtSize).length}</span>}
        </p>
      )}

      {/* TABELLE */}
      <input type="text" placeholder="🔍 Name oder Erziehungsberechtigte suchen..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, marginBottom: "10px" }} />
      {rows.length === 0 ? (
        <p style={{ color: "#777", textAlign: "center", margin: "30px 0" }}>Noch keine Anmeldungen für {campYear}.</p>
      ) : (
        <div style={{ overflowX: "auto", background: "white", borderRadius: "8px", border: "1px solid #ddd" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead style={{ background: "#f4f6f8" }}>
              <tr>
                {["Nr.", "Name", "Geb.-Datum", "Verein", "Erziehungsber.", "Telefon", "E-Mail", "Allergien", "Eingang", "Geschw.", "Mitglied", "Nr./Größe", "Gebühr", "Bezahlt", ...settings.costItems.map(i => i.name), "Summe Kosten"].map(h => (
                  <th key={h} style={{ ...cell, fontWeight: "bold", textAlign: "left", background: h === "Bezahlt" ? "#fef3c7" : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(p => (
                <tr key={p.id} style={{ background: p.paid ? "white" : "#fff8f8" }}>
                  <td style={cell}>{p.nr}</td>
                  <td style={{ ...cell, fontWeight: "bold", color: "#2980b9", cursor: "pointer", textDecoration: "underline" }} onClick={() => setForm({ ...emptyParticipant(), ...p })}>{p.lastName} {p.firstName} ✏️</td>
                  <td style={cell}>{formatDate(p.birthDate)}</td>
                  <td style={cell}>{p.club}</td>
                  <td style={cell}>{p.guardian}</td>
                  <td style={cell}>{p.phone}</td>
                  <td style={cell}>{p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}</td>
                  <td style={{ ...cell, whiteSpace: "normal", minWidth: "140px", color: p.allergies && !/^(keine|-)/i.test(p.allergies) ? "#c0392b" : "#333" }}>{p.allergies}</td>
                  <td style={cell}>{formatDate(p.registeredAt)}</td>
                  <td style={{ ...cell, textAlign: "center" }}>{p.sibling ? "✔" : ""}</td>
                  <td style={{ ...cell, textAlign: "center" }}>{p.member ? "✔" : ""}</td>
                  <td style={cell}>{p.withNumber ? `#${p.shirtNumber || "?"}` : "–"} {p.shirtSize && `· ${p.shirtSize}`}</td>
                  <td style={{ ...cell, fontWeight: "bold", background: "#eafaf1" }}>{formatEuro(p.fee)}{p.customFee !== "" && p.customFee !== undefined && <span title="Sonderpreis"> *</span>}</td>
                  <td style={{ ...cell, textAlign: "center", background: "#fef3c7" }}>
                    <input type="checkbox" checked={!!p.paid} onChange={() => togglePaid(p)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                  </td>
                  {settings.costItems.map(i => <td key={i.id} style={{ ...cell, color: "#666" }}>{formatEuro(p.costs[i.id])}</td>)}
                  <td style={{ ...cell, fontWeight: "bold" }}>{formatEuro(p.costSum)}</td>
                </tr>
              ))}
              <tr style={{ background: "#f4f6f8", fontWeight: "bold" }}>
                <td style={cell} colSpan={12}>Summe ({rows.length} Teilnehmer)</td>
                <td style={cell}>{formatEuro(totalFees)}</td>
                <td style={cell}>{rows.filter(p => p.paid).length}/{rows.length}</td>
                {settings.costItems.map(i => <td key={i.id} style={cell}>{formatEuro(rows.reduce((s, p) => s + p.costs[i.id], 0))}</td>)}
                <td style={cell}>{formatEuro(totalCosts)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: "11px", color: "#888" }}>Zeilen mit rötlichem Hintergrund sind noch nicht bezahlt. * = Sonderpreis. Die Daten (inkl. Allergien) sind nur für Admins sichtbar.</p>

      {/* FORMULAR ANMELDUNG */}
      {form && (
        <div onClick={() => setForm(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "15px" }}>
          <form onSubmit={handleSave} onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: "10px", padding: "18px", width: "100%", maxWidth: "640px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 6px 20px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#e67e22" }}>{form.id ? "✏️ Anmeldung bearbeiten" : `➕ Anmeldung Sommercamp ${campYear}`}</h3>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
              {field("lastName", "Nachname *")}
              {field("firstName", "Vorname *")}
              {field("birthDate", "Geburtsdatum", "date")}
              {field("club", "Verein")}
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
              {field("guardian", "Erziehungsberechtigte")}
              {field("phone", "Telefon", "tel")}
              {field("email", "E-Mail", "email")}
            </div>
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Allergien / Unverträglichkeiten</label>
              <textarea value={form.allergies} onChange={(e) => setField("allergies", e.target.value)} rows={2} placeholder="z. B. keine Angabe, Laktose, Nüsse …" style={{ ...inputStyle, fontFamily: "inherit" }} />
            </div>

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", background: "#f8f9fa", borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
              {check("member", "Mitglied")}
              {check("sibling", "Geschwisterkind")}
              {check("withNumber", "Rückennummer")}
              {check("paid", "Betrag bezahlt")}
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px", alignItems: "flex-end" }}>
              {form.withNumber && field("shirtNumber", "Wunschnummer", "number", "1 1 100px")}
              <div style={{ flex: "1 1 100px" }}>
                <label style={labelStyle}>T-Shirt-Größe</label>
                <select value={form.shirtSize} onChange={(e) => setField("shirtSize", e.target.value)} style={inputStyle}>
                  {SHIRT_SIZES.map(s => <option key={s} value={s}>{s || "– wählen –"}</option>)}
                </select>
              </div>
              {field("registeredAt", "Eingang Anmeldung", "date", "1 1 140px")}
              {field("customFee", "Sonderpreis (€, optional)", "number", "1 1 140px")}
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Bemerkung</label>
              <input type="text" value={form.notes || ""} onChange={(e) => setField("notes", e.target.value)} style={inputStyle} />
            </div>

            <div style={{ background: "#eafaf1", border: "1px solid #a9dfbf", borderRadius: "8px", padding: "10px", fontSize: "13px", marginBottom: "12px" }}>
              Teilnahmegebühr: <strong>{formatEuro(participantFee(form, settings))}</strong>
              {" · "}Kosten Verein: <strong>{formatEuro(participantCostSum(form, settings))}</strong>
              <div style={{ fontSize: "11px", color: "#555", marginTop: "3px" }}>
                Grundpreis {formatEuro(settings.baseFee)}
                {form.withNumber && ` + Nummer ${formatEuro(settings.numberSurcharge)}`}
                {form.sibling && ` − Geschwister ${formatEuro(settings.siblingDiscount)}`}
                {!form.member && Number(settings.nonMemberSurcharge) > 0 && ` + Nicht-Mitglied ${formatEuro(settings.nonMemberSurcharge)}`}
                {form.customFee !== "" && form.customFee !== undefined && " (Sonderpreis gilt)"}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="submit" disabled={isSaving} style={{ flex: "1 1 150px", padding: "11px", background: "#27ae60", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>{isSaving ? "Wird gespeichert..." : "💾 Speichern"}</button>
              <button type="button" onClick={() => setForm(null)} style={{ flex: "1 1 100px", padding: "11px", background: "#eee", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Abbrechen</button>
              {form.id && <button type="button" onClick={() => handleDelete(form)} style={{ flex: "1 1 100%", padding: "9px", background: "white", color: "#c0392b", border: "1px solid #e6b0aa", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" }}>🗑️ Anmeldung löschen</button>}
            </div>
          </form>
        </div>
      )}

      {/* PREISE */}
      {showSettings && settingsDraft && (
        <div onClick={() => setShowSettings(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "15px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: "10px", padding: "18px", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 6px 20px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 4px 0", color: "#2146d0" }}>⚙ Preise Sommercamp {campYear}</h3>
            <p style={{ fontSize: "11px", color: "#888", margin: "0 0 12px 0" }}>Gelten für alle Anmeldungen dieses Jahres (außer mit Sonderpreis).</p>

            <h4 style={{ fontSize: "13px", margin: "0 0 6px 0" }}>Teilnahmegebühr</h4>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
              {[["baseFee", "Grundpreis"], ["numberSurcharge", "+ mit Rückennummer"], ["siblingDiscount", "− Geschwisterkind"], ["nonMemberSurcharge", "+ Nicht-Mitglied"]].map(([key, label]) => (
                <div key={key} style={{ flex: "1 1 45%" }}>
                  <label style={labelStyle}>{label} (€)</label>
                  <input type="number" step="0.01" value={settingsDraft[key]} onChange={(e) => setSettingsDraft({ ...settingsDraft, [key]: e.target.value })} style={inputStyle} />
                </div>
              ))}
            </div>

            <h4 style={{ fontSize: "13px", margin: "0 0 6px 0" }}>Kosten Verein pro Kind</h4>
            {settingsDraft.costItems.map((item, idx) => (
              <div key={item.id} style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" }}>
                <input type="text" value={item.name} onChange={(e) => setSettingsDraft({ ...settingsDraft, costItems: settingsDraft.costItems.map((c, i) => i === idx ? { ...c, name: e.target.value } : c) })} style={{ ...inputStyle, flex: "2 1 120px" }} />
                <input type="number" step="0.01" value={item.price} onChange={(e) => setSettingsDraft({ ...settingsDraft, costItems: settingsDraft.costItems.map((c, i) => i === idx ? { ...c, price: e.target.value } : c) })} style={{ ...inputStyle, flex: "1 1 70px" }} />
                <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <input type="checkbox" checked={item.onlyWithNumber} onChange={(e) => setSettingsDraft({ ...settingsDraft, costItems: settingsDraft.costItems.map((c, i) => i === idx ? { ...c, onlyWithNumber: e.target.checked } : c) })} /> nur mit Nummer
                </label>
                <button onClick={() => setSettingsDraft({ ...settingsDraft, costItems: settingsDraft.costItems.filter((_, i) => i !== idx) })} style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer" }}>✖</button>
              </div>
            ))}
            <button onClick={() => setSettingsDraft({ ...settingsDraft, costItems: [...settingsDraft.costItems, { id: `item${Date.now()}`, name: "", price: 0, onlyWithNumber: false }] })} style={{ background: "none", border: "1px dashed #aaa", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", marginBottom: "14px" }}>➕ Kostenposition</button>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={saveSettings} style={{ flex: 1, padding: "11px", background: "#2146d0", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>💾 Speichern</button>
              <button onClick={() => setShowSettings(false)} style={{ flex: 1, padding: "11px", background: "#eee", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
