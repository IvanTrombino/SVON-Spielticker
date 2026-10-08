import { useState } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { formatEuro, formatDate, today, downloadCSV, csvText, csvEuro } from "../../summerCamp";
import { cell, button } from "./styles";
import { Modal, Field, Check } from "./ui";

const emptyDonation = () => ({ donor: "", amount: "", date: today(), purpose: "", receiptIssued: false, notes: "" });

// Spenden fürs Sommercamp – fließen in die Einnahmen im Dashboard ein
export default function Donations({ clubId, campYear, donations }) {
  const [form, setForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const total = donations.reduce((s, d) => s + Number(d.amount || 0), 0);

  const set = (name) => (value) => setForm(prev => ({ ...prev, [name]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    const amount = Number(String(form.amount).replace(",", "."));
    if (!form.donor.trim()) return alert("Bitte Spender eintragen.");
    if (!(amount > 0)) return alert("Bitte einen Betrag größer 0 eintragen.");
    setIsSaving(true);
    try {
      const { id, ...data } = form;
      const payload = { ...data, donor: data.donor.trim(), amount, clubId, campYear };
      if (id) await updateDoc(doc(db, "summercamp_donations", id), payload);
      else await addDoc(collection(db, "summercamp_donations"), { ...payload, createdAt: new Date().toISOString() });
      setForm(null);
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (d) => {
    if (!window.confirm(`Spende von ${d.donor} (${formatEuro(d.amount)}) löschen?`)) return;
    await deleteDoc(doc(db, "summercamp_donations", d.id));
    setForm(null);
  };

  const exportCSV = () => {
    if (donations.length === 0) return alert("Noch keine Spenden erfasst.");
    const lines = donations.map(d => [csvText(formatDate(d.date)), csvText(d.donor), csvEuro(d.amount), csvText(d.purpose), csvText(d.receiptIssued ? "Ja" : "Nein"), csvText(d.notes)]);
    lines.push(["", csvText("Summe"), csvEuro(total), "", "", ""]);
    downloadCSV(`Sommercamp_${campYear}_Spenden_${today()}.csv`, ["Datum", "Spender", "Betrag", "Zweck", "Spendenquittung", "Bemerkung"], lines);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px", alignItems: "center" }}>
        <strong style={{ flex: 1, fontSize: "15px", color: "#27ae60" }}>Spenden gesamt: {formatEuro(total)}</strong>
        <button onClick={() => setForm(emptyDonation())} style={button("#27ae60")}>➕ Spende</button>
        <button onClick={exportCSV} style={button("#2146d0")}>📥 Excel (CSV)</button>
      </div>

      {donations.length === 0 ? (
        <p style={{ color: "#777", textAlign: "center", margin: "30px 0" }}>Noch keine Spenden für {campYear}.</p>
      ) : (
        <div style={{ overflowX: "auto", background: "white", borderRadius: "8px", border: "1px solid #ddd" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead style={{ background: "#f4f6f8" }}>
              <tr>{["Datum", "Spender", "Betrag", "Zweck", "Quittung", "Bemerkung"].map(h => <th key={h} style={{ ...cell, fontWeight: "bold" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {donations.map(d => (
                <tr key={d.id}>
                  <td style={cell}>{formatDate(d.date)}</td>
                  <td style={{ ...cell, fontWeight: "bold", color: "#2980b9", cursor: "pointer", textDecoration: "underline" }} onClick={() => setForm({ ...emptyDonation(), ...d })}>{d.donor} ✏️</td>
                  <td style={{ ...cell, fontWeight: "bold" }}>{formatEuro(d.amount)}</td>
                  <td style={cell}>{d.purpose}</td>
                  <td style={{ ...cell, textAlign: "center" }}>{d.receiptIssued ? "✔" : <span style={{ color: "#c0392b" }}>offen</span>}</td>
                  <td style={{ ...cell, whiteSpace: "normal" }}>{d.notes}</td>
                </tr>
              ))}
              <tr style={{ background: "#f4f6f8", fontWeight: "bold" }}>
                <td style={cell} colSpan={2}>Summe ({donations.length} Spenden)</td>
                <td style={cell}>{formatEuro(total)}</td>
                <td style={cell} colSpan={3}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal onClose={() => setForm(null)} maxWidth="460px">
          <form onSubmit={handleSave}>
            <h3 style={{ margin: "0 0 12px 0", color: "#27ae60" }}>{form.id ? "✏️ Spende bearbeiten" : "➕ Spende erfassen"}</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
              <Field label="Spender (Person / Firma) *" value={form.donor} onChange={set("donor")} flex="1 1 100%" />
              <Field label="Betrag (€) *" type="number" step="0.01" min="0" value={form.amount} onChange={set("amount")} />
              <Field label="Datum" type="date" value={form.date} onChange={set("date")} />
              <Field label="Zweck" value={form.purpose} onChange={set("purpose")} placeholder="z. B. T-Shirts, Verpflegung" flex="1 1 100%" />
              <Field label="Bemerkung" value={form.notes} onChange={set("notes")} flex="1 1 100%" />
            </div>
            <div style={{ marginBottom: "12px" }}><Check label="Spendenquittung ausgestellt" checked={form.receiptIssued} onChange={set("receiptIssued")} /></div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="submit" disabled={isSaving} style={{ ...button("#27ae60"), flex: "1 1 150px" }}>{isSaving ? "Wird gespeichert..." : "💾 Speichern"}</button>
              <button type="button" onClick={() => setForm(null)} style={{ ...button("#eee", "#333"), flex: "1 1 100px" }}>Abbrechen</button>
              {form.id && <button type="button" onClick={() => handleDelete(form)} style={{ ...button("white", "#c0392b"), border: "1px solid #e6b0aa", flex: "1 1 100%", fontSize: "12px" }}>🗑️ Spende löschen</button>}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
