import { useState } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { SHIRT_SIZES, participantFee, participantCosts, participantCostSum, groupOf, formatEuro, formatDate, today, downloadCSV, csvText, csvEuro } from "../../summerCamp";
import { inputStyle, labelStyle, cell, button } from "./styles";
import { Modal, Field, Check } from "./ui";

const emptyParticipant = () => ({
  lastName: "", firstName: "", birthDate: "", club: "SV Orsingen-Nenzingen", guardian: "", phone: "", email: "",
  allergies: "", registeredAt: today(), sibling: false, member: true, withNumber: false, shirtNumber: "", shirtSize: "",
  paid: false, customFee: "", groupId: "", notes: ""
});

const hasAllergy = (text) => text && !/^(keine|-|nein)/i.test(text.trim());

export default function Participants({ clubId, campYear, participants, settings }) {
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const groups = settings.groups || [];
  const rows = participants.map((p, i) => ({
    ...p,
    nr: i + 1,
    fee: participantFee(p, settings),
    costs: participantCosts(p, settings),
    costSum: participantCostSum(p, settings),
    group: groupOf(p, groups)
  }));
  const visible = rows.filter(p => !search || `${p.lastName} ${p.firstName} ${p.guardian} ${p.club}`.toLowerCase().includes(search.toLowerCase()));
  const totalFees = rows.reduce((s, p) => s + p.fee, 0);
  const totalCosts = rows.reduce((s, p) => s + p.costSum, 0);

  const set = (name) => (value) => setForm(prev => ({ ...prev, [name]: value }));

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

  const handleDelete = async (p) => {
    if (!window.confirm(`${p.firstName} ${p.lastName} endgültig aus dem Sommercamp ${campYear} löschen?`)) return;
    await deleteDoc(doc(db, "summercamp_participants", p.id));
    setForm(null);
  };

  const exportCSV = () => {
    if (rows.length === 0) return alert("Noch keine Anmeldungen vorhanden.");
    const headers = ["Nr.", "Nachname", "Vorname", "Geburtsdatum", "Jahrgang", "Verein", "Erziehungsberechtigte", "Telefon", "E-Mail", "Allergien/Unverträglichkeiten",
      "Eingang Anmeldung", "Geschwisterkind", "Mitglied", "Trikotnummer", "Wunschnummer", "T-Shirt-Größe", "Gruppe", "Teilnahmegebühr", "Bezahlt",
      ...settings.costItems.map(i => `Kosten ${i.name}`), "Summe Kosten", "Bemerkung"];
    const lines = rows.map(p => [
      csvText(p.nr), csvText(p.lastName), csvText(p.firstName), csvText(formatDate(p.birthDate)), csvText((p.birthDate || "").slice(0, 4)), csvText(p.club), csvText(p.guardian),
      csvText(p.phone), csvText(p.email), csvText(p.allergies), csvText(formatDate(p.registeredAt)), csvText(p.sibling ? "Ja" : "Nein"), csvText(p.member ? "Ja" : "Nein"),
      csvText(p.withNumber ? "Ja" : "Nein"), csvText(p.shirtNumber), csvText(p.shirtSize), csvText(p.group?.name || ""), csvEuro(p.fee), csvText(p.paid ? "Ja" : "Nein"),
      ...settings.costItems.map(i => csvEuro(p.costs[i.id])), csvEuro(p.costSum), csvText(p.notes)
    ]);
    lines.push(["", csvText("Summe"), ...Array(15).fill(""), csvEuro(totalFees), "", ...settings.costItems.map(i => csvEuro(rows.reduce((s, p) => s + p.costs[i.id], 0))), csvEuro(totalCosts), ""]);
    downloadCSV(`Sommercamp_${campYear}_Teilnehmer_${today()}.csv`, headers, lines);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
        <input type="text" placeholder="🔍 Name, Erziehungsberechtigte oder Verein suchen..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, flex: "1 1 240px", width: "auto" }} />
        <button onClick={() => setForm(emptyParticipant())} style={button("#27ae60")}>➕ Anmeldung</button>
        <button onClick={exportCSV} style={button("#2146d0")}>📥 Excel (CSV)</button>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: "#777", textAlign: "center", margin: "30px 0" }}>Noch keine Anmeldungen für {campYear}.</p>
      ) : (
        <div style={{ overflowX: "auto", background: "white", borderRadius: "8px", border: "1px solid #ddd" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead style={{ background: "#f4f6f8" }}>
              <tr>
                {["Nr.", "Name", "Geb.-Datum", "Verein", "Erziehungsber.", "Telefon", "E-Mail", "Allergien", "Eingang", "Geschw.", "Mitglied", "Nr./Größe", "Gruppe", "Gebühr", "Bezahlt", ...settings.costItems.map(i => i.name), "Summe Kosten"].map(h => (
                  <th key={h} style={{ ...cell, fontWeight: "bold", background: h === "Bezahlt" ? "#fef3c7" : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => (
                <tr key={p.id} style={{ background: p.paid ? "white" : "#fff8f8" }}>
                  <td style={cell}>{p.nr}</td>
                  <td style={{ ...cell, fontWeight: "bold", color: "#2980b9", cursor: "pointer", textDecoration: "underline" }} onClick={() => setForm({ ...emptyParticipant(), ...p })}>{p.lastName} {p.firstName} ✏️</td>
                  <td style={cell}>{formatDate(p.birthDate)}</td>
                  <td style={cell}>{p.club}</td>
                  <td style={cell}>{p.guardian}</td>
                  <td style={cell}>{p.phone}</td>
                  <td style={cell}>{p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}</td>
                  <td style={{ ...cell, whiteSpace: "normal", minWidth: "140px", color: hasAllergy(p.allergies) ? "#c0392b" : "#333", fontWeight: hasAllergy(p.allergies) ? "bold" : "normal" }}>{p.allergies}</td>
                  <td style={cell}>{formatDate(p.registeredAt)}</td>
                  <td style={{ ...cell, textAlign: "center" }}>{p.sibling ? "✔" : ""}</td>
                  <td style={{ ...cell, textAlign: "center" }}>{p.member ? "✔" : ""}</td>
                  <td style={cell}>{p.withNumber ? `#${p.shirtNumber || "?"}` : "–"}{p.shirtSize && ` · ${p.shirtSize}`}</td>
                  <td style={cell}>{p.group?.name || <span style={{ color: "#c0392b" }}>–</span>}</td>
                  <td style={{ ...cell, fontWeight: "bold", background: "#eafaf1" }}>{formatEuro(p.fee)}{p.customFee !== "" && p.customFee !== undefined && <span title="Sonderpreis"> *</span>}</td>
                  <td style={{ ...cell, textAlign: "center", background: "#fef3c7" }}>
                    <input type="checkbox" checked={!!p.paid} onChange={() => updateDoc(doc(db, "summercamp_participants", p.id), { paid: !p.paid })} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                  </td>
                  {settings.costItems.map(i => <td key={i.id} style={{ ...cell, color: "#666" }}>{formatEuro(p.costs[i.id])}</td>)}
                  <td style={{ ...cell, fontWeight: "bold" }}>{formatEuro(p.costSum)}</td>
                </tr>
              ))}
              <tr style={{ background: "#f4f6f8", fontWeight: "bold" }}>
                <td style={cell} colSpan={13}>Summe ({rows.length} Teilnehmer)</td>
                <td style={cell}>{formatEuro(totalFees)}</td>
                <td style={cell}>{rows.filter(p => p.paid).length}/{rows.length}</td>
                {settings.costItems.map(i => <td key={i.id} style={cell}>{formatEuro(rows.reduce((s, p) => s + p.costs[i.id], 0))}</td>)}
                <td style={cell}>{formatEuro(totalCosts)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: "11px", color: "#888" }}>Rötlich = noch nicht bezahlt · rote Allergie = bitte beachten · * = Sonderpreis · Gruppe „–“ = Jahrgang passt in keine Gruppe.</p>

      {form && (
        <Modal onClose={() => setForm(null)}>
          <form onSubmit={handleSave}>
            <h3 style={{ margin: "0 0 12px 0", color: "#e67e22" }}>{form.id ? "✏️ Anmeldung bearbeiten" : `➕ Anmeldung Sommercamp ${campYear}`}</h3>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
              <Field label="Nachname *" value={form.lastName} onChange={set("lastName")} />
              <Field label="Vorname *" value={form.firstName} onChange={set("firstName")} />
              <Field label="Geburtsdatum" type="date" value={form.birthDate} onChange={set("birthDate")} />
              <Field label="Verein" value={form.club} onChange={set("club")} list="sc-clubs" />
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
              <Field label="Erziehungsberechtigte" value={form.guardian} onChange={set("guardian")} />
              <Field label="Telefon" type="tel" value={form.phone} onChange={set("phone")} />
              <Field label="E-Mail" type="email" value={form.email} onChange={set("email")} />
            </div>
            <datalist id="sc-clubs">
              {[...new Set(participants.map(p => p.club).filter(Boolean))].map(c => <option key={c} value={c} />)}
            </datalist>
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Allergien / Unverträglichkeiten</label>
              <textarea value={form.allergies} onChange={(e) => set("allergies")(e.target.value)} rows={2} placeholder="z. B. keine Angabe, Laktose, Nüsse …" style={{ ...inputStyle, fontFamily: "inherit" }} />
            </div>

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", background: "#f8f9fa", borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
              <Check label="Mitglied SVON" checked={form.member} onChange={set("member")} />
              <Check label="Geschwisterkind" checked={form.sibling} onChange={set("sibling")} />
              <Check label="Trikotnummer (optional)" checked={form.withNumber} onChange={set("withNumber")} />
              <Check label="Betrag bezahlt" checked={form.paid} onChange={set("paid")} />
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px", alignItems: "flex-end" }}>
              {form.withNumber && <Field label="Wunschnummer" type="number" value={form.shirtNumber} onChange={set("shirtNumber")} flex="1 1 100px" />}
              <div style={{ flex: "1 1 100px" }}>
                <label style={labelStyle}>T-Shirt-Größe</label>
                <select value={form.shirtSize} onChange={(e) => set("shirtSize")(e.target.value)} style={inputStyle}>
                  {SHIRT_SIZES.map(s => <option key={s} value={s}>{s || "– wählen –"}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label style={labelStyle}>Gruppe</label>
                <select value={form.groupId || ""} onChange={(e) => set("groupId")(e.target.value)} style={inputStyle}>
                  <option value="">automatisch nach Jahrgang</option>
                  {(settings.groups || []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <Field label="Eingang Anmeldung" type="date" value={form.registeredAt} onChange={set("registeredAt")} flex="1 1 140px" />
              <Field label="Sonderpreis (€, optional)" type="number" value={form.customFee} onChange={set("customFee")} flex="1 1 140px" />
            </div>

            <Field label="Bemerkung" value={form.notes} onChange={set("notes")} flex="1 1 100%" />

            <div style={{ background: "#eafaf1", border: "1px solid #a9dfbf", borderRadius: "8px", padding: "10px", fontSize: "13px", margin: "12px 0" }}>
              Teilnahmegebühr: <strong>{formatEuro(participantFee(form, settings))}</strong>
              {" · "}Kosten Verein: <strong>{formatEuro(participantCostSum(form, settings))}</strong>
              <div style={{ fontSize: "11px", color: "#555", marginTop: "3px" }}>
                Grundpreis {formatEuro(settings.baseFee)}
                {form.member && ` − Mitglied ${formatEuro(settings.memberDiscount)}`}
                {form.sibling && ` − Geschwister ${formatEuro(settings.siblingDiscount)}`}
                {form.withNumber && ` + Trikotnummer ${formatEuro(settings.numberSurcharge)}`}
                {form.customFee !== "" && form.customFee !== undefined && " (Sonderpreis gilt)"}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="submit" disabled={isSaving} style={{ ...button("#27ae60"), flex: "1 1 150px" }}>{isSaving ? "Wird gespeichert..." : "💾 Speichern"}</button>
              <button type="button" onClick={() => setForm(null)} style={{ ...button("#eee", "#333"), flex: "1 1 100px" }}>Abbrechen</button>
              {form.id && <button type="button" onClick={() => handleDelete(form)} style={{ ...button("white", "#c0392b"), border: "1px solid #e6b0aa", flex: "1 1 100%", fontSize: "12px" }}>🗑️ Anmeldung löschen</button>}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
