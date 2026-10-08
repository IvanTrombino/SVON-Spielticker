import { useState } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { SHIRT_SIZES, STAFF_ROLES, staffCostSum, formatEuro, today, downloadCSV, csvText, csvEuro } from "../../summerCamp";
import { inputStyle, labelStyle, cell, button } from "./styles";
import { Modal, Field } from "./ui";

const emptyStaff = () => ({ lastName: "", firstName: "", role: "Trainer", shirtSize: "", shirtName: "", phone: "", email: "", notes: "" });

// Betreuer des Sommercamps mit T-Shirt (Größe + Name) und Vereinskosten
export default function Staff({ clubId, campYear, staff, settings, onEditCosts }) {
  const [form, setForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const costEach = staffCostSum(settings);
  const groups = settings.groups || [];
  const groupNamesOf = (id) => groups.filter(g => (g.staffIds || []).includes(id)).map(g => g.name).join(", ");

  const set = (name) => (value) => setForm(prev => ({ ...prev, [name]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.lastName.trim() || !form.firstName.trim()) return alert("Bitte Vor- und Nachname eintragen.");
    setIsSaving(true);
    try {
      const { id, ...data } = form;
      // Name auf dem T-Shirt: standardmäßig der Vorname
      const payload = { ...data, lastName: data.lastName.trim(), firstName: data.firstName.trim(), shirtName: (data.shirtName || data.firstName).trim(), clubId, campYear };
      if (id) await updateDoc(doc(db, "summercamp_staff", id), payload);
      else await addDoc(collection(db, "summercamp_staff"), { ...payload, createdAt: new Date().toISOString() });
      setForm(null);
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Betreuer ${s.firstName} ${s.lastName} löschen?`)) return;
    await deleteDoc(doc(db, "summercamp_staff", s.id));
    setForm(null);
  };

  const exportCSV = () => {
    if (staff.length === 0) return alert("Noch keine Betreuer angelegt.");
    const headers = ["Nr.", "Name", "Rolle", "Gruppe", "Größe", "Name T-Shirt", "Telefon", "E-Mail", ...settings.staffCostItems.map(i => `Kosten ${i.name}`), "Summe", "Bemerkung"];
    const lines = staff.map((s, i) => [
      csvText(i + 1), csvText(`${s.lastName} ${s.firstName}`), csvText(s.role), csvText(groupNamesOf(s.id)), csvText(s.shirtSize), csvText(s.shirtName),
      csvText(s.phone), csvText(s.email), ...settings.staffCostItems.map(item => csvEuro(item.price)), csvEuro(costEach), csvText(s.notes)
    ]);
    lines.push(["", csvText("Summe"), "", "", "", "", "", "", ...settings.staffCostItems.map(item => csvEuro(item.price * staff.length)), csvEuro(costEach * staff.length), ""]);
    downloadCSV(`Sommercamp_${campYear}_Betreuer_${today()}.csv`, headers, lines);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px", justifyContent: "flex-end" }}>
        <button onClick={() => setForm(emptyStaff())} style={button("#27ae60")}>➕ Betreuer</button>
        <button onClick={onEditCosts} style={button("#7f8c8d")}>✏️ Kosten {campYear} ändern</button>
        <button onClick={exportCSV} style={button("#2146d0")}>📥 Excel (CSV)</button>
      </div>

      {staff.length === 0 ? (
        <p style={{ color: "#777", textAlign: "center", margin: "30px 0" }}>Noch keine Betreuer für {campYear}.</p>
      ) : (
        <div style={{ overflowX: "auto", background: "white", borderRadius: "8px", border: "1px solid #ddd" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead style={{ background: "#f4f6f8" }}>
              <tr>
                {["Nr.", "Name", "Rolle", "Gruppe", "Größe", "Name T-Shirt", "Telefon", ...settings.staffCostItems.map(i => i.name), "Summe"].map(h => <th key={h} style={{ ...cell, fontWeight: "bold" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {staff.map((s, i) => (
                <tr key={s.id}>
                  <td style={cell}>{i + 1}</td>
                  <td style={{ ...cell, fontWeight: "bold", color: "#2980b9", cursor: "pointer", textDecoration: "underline" }} onClick={() => setForm({ ...emptyStaff(), ...s })}>{s.lastName} {s.firstName} ✏️</td>
                  <td style={cell}>{s.role}</td>
                  <td style={cell}>{groupNamesOf(s.id) || <span style={{ color: "#999" }}>–</span>}</td>
                  <td style={{ ...cell, textAlign: "center", fontWeight: "bold" }}>{s.shirtSize || <span style={{ color: "#c0392b" }}>?</span>}</td>
                  <td style={{ ...cell, background: "#eafaf1" }}>{s.shirtName}</td>
                  <td style={cell}>{s.phone}</td>
                  {settings.staffCostItems.map(item => <td key={item.id} style={{ ...cell, color: "#666" }}>{formatEuro(item.price)}</td>)}
                  <td style={{ ...cell, fontWeight: "bold" }}>{formatEuro(costEach)}</td>
                </tr>
              ))}
              <tr style={{ background: "#f4f6f8", fontWeight: "bold" }}>
                <td style={cell} colSpan={7}>Summe ({staff.length} Betreuer)</td>
                {settings.staffCostItems.map(item => <td key={item.id} style={cell}>{formatEuro(item.price * staff.length)}</td>)}
                <td style={cell}>{formatEuro(costEach * staff.length)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: "11px", color: "#888" }}>Die Gruppen-Zuteilung erfolgt im Reiter „Gruppen“. Kosten pro Betreuer: „✏️ Kosten {campYear} ändern“.</p>

      {form && (
        <Modal onClose={() => setForm(null)} maxWidth="520px">
          <form onSubmit={handleSave}>
            <h3 style={{ margin: "0 0 12px 0", color: "#e67e22" }}>{form.id ? "✏️ Betreuer bearbeiten" : `➕ Betreuer Sommercamp ${campYear}`}</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
              <Field label="Nachname *" value={form.lastName} onChange={set("lastName")} />
              <Field label="Vorname *" value={form.firstName} onChange={set("firstName")} />
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
              <div style={{ flex: "1 1 160px" }}>
                <label style={labelStyle}>Rolle</label>
                <input list="sc-roles" value={form.role} onChange={(e) => set("role")(e.target.value)} style={inputStyle} />
                <datalist id="sc-roles">{STAFF_ROLES.map(r => <option key={r} value={r} />)}</datalist>
              </div>
              <div style={{ flex: "1 1 100px" }}>
                <label style={labelStyle}>T-Shirt-Größe</label>
                <select value={form.shirtSize} onChange={(e) => set("shirtSize")(e.target.value)} style={inputStyle}>
                  {SHIRT_SIZES.map(s => <option key={s} value={s}>{s || "– wählen –"}</option>)}
                </select>
              </div>
              <Field label="Name auf dem T-Shirt" value={form.shirtName} onChange={set("shirtName")} placeholder={form.firstName || "z. B. Spitzname"} />
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
              <Field label="Telefon" type="tel" value={form.phone} onChange={set("phone")} />
              <Field label="E-Mail" type="email" value={form.email} onChange={set("email")} />
            </div>
            <Field label="Bemerkung" value={form.notes} onChange={set("notes")} flex="1 1 100%" />
            <p style={{ fontSize: "12px", color: "#555", margin: "10px 0" }}>Kosten Verein: <strong>{formatEuro(costEach)}</strong> ({settings.staffCostItems.map(i => `${i.name} ${formatEuro(i.price)}`).join(" + ")})</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="submit" disabled={isSaving} style={{ ...button("#27ae60"), flex: "1 1 150px" }}>{isSaving ? "Wird gespeichert..." : "💾 Speichern"}</button>
              <button type="button" onClick={() => setForm(null)} style={{ ...button("#eee", "#333"), flex: "1 1 100px" }}>Abbrechen</button>
              {form.id && <button type="button" onClick={() => handleDelete(form)} style={{ ...button("white", "#c0392b"), border: "1px solid #e6b0aa", flex: "1 1 100%", fontSize: "12px" }}>🗑️ Betreuer löschen</button>}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
