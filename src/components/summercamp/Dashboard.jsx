import { SHIRT_SIZES, participantFee, participantCostSum, staffCostSum, groupOf, birthYearOf, formatEuro } from "../../summerCamp";
import { cell, countBy } from "./styles";
import { StatTile, BarChart } from "./ui";

const hasAllergy = (text) => text && !/^(keine|-|nein)/i.test(text.trim());
const bySize = (a, b) => SHIRT_SIZES.indexOf(a.label) - SHIRT_SIZES.indexOf(b.label);

// Übersicht Sommercamp: Kennzahlen, Finanzen und Auswertungen
export default function Dashboard({ participants, staff, donations, settings }) {
  const groups = settings.groups || [];
  const fees = participants.map(p => participantFee(p, settings));
  const feesTotal = fees.reduce((s, v) => s + v, 0);
  const feesPaid = participants.reduce((s, p, i) => s + (p.paid ? fees[i] : 0), 0);
  const donationsTotal = donations.reduce((s, d) => s + Number(d.amount || 0), 0);
  const costsParticipants = participants.reduce((s, p) => s + participantCostSum(p, settings), 0);
  const costsStaff = staff.length * staffCostSum(settings);
  const income = feesTotal + donationsTotal;
  const expenses = costsParticipants + costsStaff;
  const result = income - expenses;
  const cashNow = feesPaid + donationsTotal - expenses;

  const clubs = countBy(participants, p => (p.club || "").trim() || "ohne Angabe").sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const years = countBy(participants, p => birthYearOf(p) || "ohne Angabe").sort((a, b) => a.label.localeCompare(b.label));
  const perGroup = [
    ...[...groups].sort((a, b) => Number(a.yearFrom) - Number(b.yearFrom)).map(g => ({ label: g.name, value: participants.filter(p => groupOf(p, groups)?.id === g.id).length })),
    ...(participants.some(p => !groupOf(p, groups)) && groups.length > 0 ? [{ label: "Ohne Gruppe", value: participants.filter(p => !groupOf(p, groups)).length }] : [])
  ];
  const sizesKids = countBy(participants, p => p.shirtSize || "ohne Größe").sort(bySize);
  const sizesStaff = countBy(staff, s => s.shirtSize || "ohne Größe").sort(bySize);
  const roles = countBy(staff, s => s.role || "Betreuer").sort((a, b) => b.value - a.value);

  const financeRow = (label, value, { bold, color, indent } = {}) => (
    <tr>
      <td style={{ ...cell, paddingLeft: indent ? "20px" : "8px", fontWeight: bold ? "bold" : "normal" }}>{label}</td>
      <td style={{ ...cell, textAlign: "right", fontWeight: bold ? "bold" : "normal", color }}>{formatEuro(value)}</td>
    </tr>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* KENNZAHLEN */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <StatTile label="Teilnehmer" value={participants.length} color="#2146d0" hint={`${participants.filter(p => p.member).length} Mitglieder · ${participants.filter(p => p.sibling).length} Geschwister`} />
        <StatTile label="Betreuer" value={staff.length} color="#2146d0" hint={staff.length ? `${(participants.length / staff.length).toFixed(1).replace(".", ",")} Kinder pro Betreuer` : "noch keine"} />
        <StatTile label="Bezahlt" value={`${participants.filter(p => p.paid).length}/${participants.length}`} color={participants.every(p => p.paid) ? "#27ae60" : "#c0392b"} hint={`offen: ${formatEuro(feesTotal - feesPaid)}`} />
        <StatTile label="Mit Trikotnummer" value={participants.filter(p => p.withNumber).length} />
        <StatTile label="Allergien beachten" value={participants.filter(p => hasAllergy(p.allergies)).length} color="#c0392b" />
        <StatTile label="Ergebnis (geplant)" value={formatEuro(result)} color={result >= 0 ? "#27ae60" : "#c0392b"} hint={`Kasse aktuell: ${formatEuro(cashNow)}`} />
      </div>

      {/* FINANZEN */}
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
        <div style={{ background: "white", border: "1px solid #e0e0e0", borderRadius: "10px", padding: "14px", flex: "1 1 300px" }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px" }}>💶 Finanzen</h4>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {financeRow("Einnahmen", income, { bold: true, color: "#27ae60" })}
              {financeRow("Teilnahmegebühren bezahlt", feesPaid, { indent: true })}
              {financeRow("Teilnahmegebühren offen", feesTotal - feesPaid, { indent: true, color: feesTotal - feesPaid > 0 ? "#c0392b" : undefined })}
              {financeRow(`Spenden (${donations.length})`, donationsTotal, { indent: true })}
              {financeRow("Ausgaben", expenses, { bold: true, color: "#e67e22" })}
              {financeRow(`Material Teilnehmer (${participants.length})`, costsParticipants, { indent: true })}
              {financeRow(`Material Betreuer (${staff.length})`, costsStaff, { indent: true })}
              {financeRow("Ergebnis (geplant)", result, { bold: true, color: result >= 0 ? "#27ae60" : "#c0392b" })}
              {financeRow("Kasse aktuell (bezahlt + Spenden − Ausgaben)", cashNow, { color: "#555" })}
            </tbody>
          </table>
        </div>
        <BarChart title="Teilnehmer pro Verein" data={clubs} />
      </div>

      {/* AUSWERTUNGEN */}
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
        <BarChart title="Teilnehmer pro Jahrgang" data={years} />
        <BarChart title="Kinder pro Gruppe" data={perGroup} emptyText="Noch keine Gruppen angelegt (Reiter „Gruppen“)." />
      </div>
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
        <BarChart title="T-Shirt-Größen Kinder (Bestellung)" data={sizesKids} />
        <BarChart title="T-Shirt-Größen Betreuer (Bestellung)" data={sizesStaff} emptyText="Noch keine Betreuer angelegt." />
        <BarChart title="Betreuer nach Rolle" data={roles} emptyText="Noch keine Betreuer angelegt." />
      </div>
    </div>
  );
}
