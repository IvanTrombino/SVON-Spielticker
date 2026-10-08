import { useState } from "react";
import { groupOf, birthYearOf, formatDate, today, downloadCSV, csvText } from "../../summerCamp";
import { labelStyle, cell, button } from "./styles";
import { Modal, Field } from "./ui";

// Gruppen nach Jahrgang: Kinder werden automatisch einsortiert, Betreuer werden zugeteilt
export default function Groups({ campYear, participants, staff, settings, onSaveGroups }) {
  const [form, setForm] = useState(null);
  const groups = [...(settings.groups || [])].sort((a, b) => Number(a.yearFrom) - Number(b.yearFrom));
  const staffById = Object.fromEntries(staff.map(s => [s.id, s]));

  const membersOf = (group) => participants
    .filter(p => groupOf(p, groups)?.id === group.id)
    .sort((a, b) => (a.birthDate || "").localeCompare(b.birthDate || ""));
  const ungrouped = participants.filter(p => !groupOf(p, groups));
  const assignedStaffIds = new Set(groups.flatMap(g => g.staffIds || []));
  const freeStaff = staff.filter(s => !assignedStaffIds.has(s.id));

  const saveGroup = async () => {
    const from = Number(form.yearFrom), to = Number(form.yearTo || form.yearFrom);
    if (!form.name.trim()) return alert("Bitte einen Gruppennamen eintragen.");
    if (!from || !to || from > to) return alert("Bitte gültige Jahrgänge eintragen (von ≤ bis).");
    const overlap = groups.find(g => g.id !== form.id && from <= Number(g.yearTo) && to >= Number(g.yearFrom));
    if (overlap && !window.confirm(`Die Jahrgänge überschneiden sich mit „${overlap.name}“. Kinder landen dann in der ersten passenden Gruppe. Trotzdem speichern?`)) return;
    const group = { id: form.id || `g${Date.now()}`, name: form.name.trim(), yearFrom: from, yearTo: to, staffIds: form.staffIds || [] };
    await onSaveGroups(form.id ? groups.map(g => g.id === form.id ? group : g) : [...groups, group]);
    setForm(null);
  };

  const deleteGroup = async () => {
    if (!window.confirm(`Gruppe „${form.name}“ löschen? Die Kinder werden danach wieder automatisch zugeordnet.`)) return;
    await onSaveGroups(groups.filter(g => g.id !== form.id));
    setForm(null);
  };

  // Schnellstart: eine Gruppe pro vorhandenem Jahrgang
  const createPerYear = async () => {
    const years = [...new Set(participants.map(birthYearOf).filter(Boolean))].sort();
    const missing = years.filter(y => !groups.some(g => Number(y) >= Number(g.yearFrom) && Number(y) <= Number(g.yearTo)));
    if (missing.length === 0) return alert("Alle Jahrgänge sind bereits einer Gruppe zugeordnet.");
    if (!window.confirm(`${missing.length} Gruppe(n) anlegen: ${missing.join(", ")}?`)) return;
    await onSaveGroups([...groups, ...missing.map((y, i) => ({ id: `g${Date.now()}${i}`, name: `Jahrgang ${y}`, yearFrom: Number(y), yearTo: Number(y), staffIds: [] }))]);
  };

  const exportCSV = () => {
    const lines = [];
    groups.forEach(g => {
      membersOf(g).forEach(p => lines.push([csvText(g.name), csvText("Kind"), csvText(`${p.lastName} ${p.firstName}`), csvText(formatDate(p.birthDate)), csvText(birthYearOf(p))]));
      (g.staffIds || []).forEach(id => staffById[id] && lines.push([csvText(g.name), csvText(staffById[id].role || "Betreuer"), csvText(`${staffById[id].firstName} ${staffById[id].lastName}`), "", ""]));
    });
    ungrouped.forEach(p => lines.push([csvText("Ohne Gruppe"), csvText("Kind"), csvText(`${p.lastName} ${p.firstName}`), csvText(formatDate(p.birthDate)), csvText(birthYearOf(p))]));
    freeStaff.forEach(s => lines.push([csvText("Ohne feste Gruppe"), csvText(s.role || "Betreuer"), csvText(`${s.firstName} ${s.lastName}`), "", ""]));
    if (lines.length === 0) return alert("Noch keine Daten vorhanden.");
    downloadCSV(`Sommercamp_${campYear}_Gruppen_${today()}.csv`, ["Gruppe", "Rolle", "Name", "Geburtsdatum", "Jahrgang"], lines);
  };

  const groupCard = (key, title, subtitle, members, groupStaff, onEdit, highlight) => (
    <div key={key} style={{ background: "white", border: `1px solid ${highlight ? "#f5b7b1" : "#ddd"}`, borderRadius: "10px", padding: "12px", flex: "1 1 260px", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px", marginBottom: "6px" }}>
        <div>
          <strong style={{ fontSize: "15px", color: highlight ? "#c0392b" : "#2146d0" }}>{title}</strong>
          {subtitle && <div style={{ fontSize: "11px", color: "#888" }}>{subtitle}</div>}
        </div>
        {onEdit && <button onClick={onEdit} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}>✏️</button>}
      </div>
      {members.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px" }}>
          <tbody>
            {members.map(p => (
              <tr key={p.id} style={{ background: "#eafaf1" }}>
                <td style={{ ...cell, padding: "3px 6px" }}>{p.lastName} {p.firstName}</td>
                <td style={{ ...cell, padding: "3px 6px", textAlign: "right", color: "#555" }}>{formatDate(p.birthDate) || "?"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ fontSize: "12px", marginBottom: "6px" }}>Anzahl: <strong>{members.length}</strong></div>
      {groupStaff.length > 0 && (
        <div style={{ background: "#fef9e7", borderRadius: "6px", padding: "6px 8px", fontSize: "12px" }}>
          {groupStaff.map(s => <div key={s.id}><strong>{s.role || "Betreuer"}:</strong> {s.firstName} {s.lastName}</div>)}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px", alignItems: "center" }}>
        <span style={{ flex: 1, fontSize: "13px", color: "#555" }}>Gesamtanzahl Kinder: <strong>{participants.length}</strong> · Gruppen: <strong>{groups.length}</strong></span>
        <button onClick={createPerYear} style={button("#7f8c8d")}>⚡ Je Jahrgang eine Gruppe</button>
        <button onClick={() => setForm({ name: "", yearFrom: "", yearTo: "", staffIds: [] })} style={button("#27ae60")}>➕ Gruppe</button>
        <button onClick={exportCSV} style={button("#2146d0")}>📥 Excel (CSV)</button>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-start" }}>
        {groups.map(g => groupCard(
          g.id,
          g.name,
          `Jahrgang ${g.yearFrom === g.yearTo ? g.yearFrom : `${g.yearFrom}–${g.yearTo}`}`,
          membersOf(g),
          (g.staffIds || []).map(id => staffById[id]).filter(Boolean),
          () => setForm({ ...g, staffIds: g.staffIds || [] })
        ))}
        {ungrouped.length > 0 && groupCard("none", "Ohne Gruppe", "Jahrgang fehlt oder passt in keine Gruppe", ungrouped, [], null, true)}
        {freeStaff.length > 0 && groupCard("free", "Ohne feste Gruppe", "z. B. Springer, Ausdauer und Körper", [], freeStaff, null)}
      </div>
      {groups.length === 0 && <p style={{ color: "#777", textAlign: "center", margin: "20px 0" }}>Noch keine Gruppen. Lege Gruppen mit Jahrgängen an – die Kinder werden automatisch einsortiert.</p>}

      {form && (
        <Modal onClose={() => setForm(null)} maxWidth="460px">
          <h3 style={{ margin: "0 0 12px 0", color: "#2146d0" }}>{form.id ? "✏️ Gruppe bearbeiten" : "➕ Gruppe anlegen"}</h3>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
            <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="z. B. Große (2011–2013)" flex="1 1 100%" />
            <Field label="Jahrgang von *" type="number" value={form.yearFrom} onChange={(v) => setForm({ ...form, yearFrom: v })} placeholder="2011" />
            <Field label="Jahrgang bis" type="number" value={form.yearTo} onChange={(v) => setForm({ ...form, yearTo: v })} placeholder="2013" />
          </div>
          <label style={labelStyle}>Betreuer zuteilen</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "220px", overflowY: "auto", border: "1px solid #eee", borderRadius: "6px", padding: "8px", marginBottom: "12px" }}>
            {staff.length === 0 && <span style={{ fontSize: "12px", color: "#999" }}>Noch keine Betreuer angelegt (Reiter „Betreuer“).</span>}
            {staff.map(s => {
              const otherGroup = groups.find(g => g.id !== form.id && (g.staffIds || []).includes(s.id));
              return (
                <label key={s.id} style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.staffIds.includes(s.id)}
                    onChange={(e) => setForm({ ...form, staffIds: e.target.checked ? [...form.staffIds, s.id] : form.staffIds.filter(x => x !== s.id) })}
                  />
                  {s.firstName} {s.lastName} <span style={{ color: "#888", fontSize: "11px" }}>({s.role || "Betreuer"}{otherGroup ? `, auch in ${otherGroup.name}` : ""})</span>
                </label>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={saveGroup} style={{ ...button("#27ae60"), flex: "1 1 150px" }}>💾 Speichern</button>
            <button onClick={() => setForm(null)} style={{ ...button("#eee", "#333"), flex: "1 1 100px" }}>Abbrechen</button>
            {form.id && <button onClick={deleteGroup} style={{ ...button("white", "#c0392b"), border: "1px solid #e6b0aa", flex: "1 1 100%", fontSize: "12px" }}>🗑️ Gruppe löschen</button>}
          </div>
        </Modal>
      )}
    </div>
  );
}
