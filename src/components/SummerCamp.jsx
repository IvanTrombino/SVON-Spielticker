import { useState, useEffect } from "react";
import { collection, doc, onSnapshot, query, where, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { withDefaults } from "../summerCamp";
import { inputStyle, labelStyle, button } from "./summercamp/styles";
import { Modal } from "./summercamp/ui";
import Dashboard from "./summercamp/Dashboard";
import Participants from "./summercamp/Participants";
import Staff from "./summercamp/Staff";
import Groups from "./summercamp/Groups";
import Donations from "./summercamp/Donations";

const TABS = [
  { id: "dashboard", label: "📊 Dashboard" },
  { id: "participants", label: "👦 Teilnehmer" },
  { id: "staff", label: "🧑‍🏫 Betreuer" },
  { id: "groups", label: "👥 Gruppen" },
  { id: "donations", label: "💝 Spenden" }
];

// Lädt alle Einträge eines Camp-Jahres aus einer Sammlung
const useCampCollection = (name, clubId, campYear, sortFn) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!clubId) return;
    const q = query(collection(db, name), where("clubId", "==", clubId), where("campYear", "==", campYear));
    return onSnapshot(q, (snap) => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(sortFn)));
  }, [name, clubId, campYear, sortFn]);
  return items;
};

const byRegistration = (a, b) => (a.registeredAt || "").localeCompare(b.registeredAt || "") || (a.lastName || "").localeCompare(b.lastName || "");
const byName = (a, b) => (a.lastName || "").localeCompare(b.lastName || "") || (a.firstName || "").localeCompare(b.firstName || "");
const byDate = (a, b) => (b.date || "").localeCompare(a.date || "");

// Sommercamp-Verwaltung (nur Admins)
export default function SummerCamp({ clubId }) {
  const [campYear, setCampYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState("dashboard");
  const [settingsByYear, setSettingsByYear] = useState({});
  const [settingsDraft, setSettingsDraft] = useState(null);

  const participants = useCampCollection("summercamp_participants", clubId, campYear, byRegistration);
  const staff = useCampCollection("summercamp_staff", clubId, campYear, byName);
  const donations = useCampCollection("summercamp_donations", clubId, campYear, byDate);

  useEffect(() => {
    if (!clubId) return;
    return onSnapshot(doc(db, "summercamp_settings", clubId), (snap) => setSettingsByYear(snap.exists() ? snap.data().years || {} : {}));
  }, [clubId]);

  const settings = withDefaults(settingsByYear[campYear]);
  const openCosts = () => setSettingsDraft(JSON.parse(JSON.stringify(settings)));
  // Letztes Jahr vor dem gewählten, für das Preise gespeichert sind
  const previousYear = Object.keys(settingsByYear).map(Number).filter(y => y < campYear).sort((a, b) => b - a)[0];
  const saveYearSettings = (newSettings) =>
    setDoc(doc(db, "summercamp_settings", clubId), { years: { ...settingsByYear, [campYear]: newSettings } });

  const saveSettings = async () => {
    const d = settingsDraft;
    const cleanItems = (items) => items.filter(i => i.name.trim()).map(i => ({ ...i, name: i.name.trim(), price: Number(i.price) || 0 }));
    await saveYearSettings({
      ...settings,
      baseFee: Number(d.baseFee) || 0,
      memberDiscount: Number(d.memberDiscount) || 0,
      siblingDiscount: Number(d.siblingDiscount) || 0,
      numberSurcharge: Number(d.numberSurcharge) || 0,
      costItems: cleanItems(d.costItems),
      staffCostItems: cleanItems(d.staffCostItems)
    });
    setSettingsDraft(null);
  };

  const editItems = (key, idx, changes) =>
    setSettingsDraft({ ...settingsDraft, [key]: settingsDraft[key].map((c, i) => i === idx ? { ...c, ...changes } : c) });

  const costItemEditor = (key, withNumberFlag) => (
    <>
      {settingsDraft[key].map((item, idx) => (
        <div key={item.id} style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" }}>
          <input type="text" value={item.name} onChange={(e) => editItems(key, idx, { name: e.target.value })} style={{ ...inputStyle, flex: "2 1 120px" }} />
          <input type="number" step="0.01" value={item.price} onChange={(e) => editItems(key, idx, { price: e.target.value })} style={{ ...inputStyle, flex: "1 1 70px" }} />
          {withNumberFlag && (
            <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
              <input type="checkbox" checked={!!item.onlyWithNumber} onChange={(e) => editItems(key, idx, { onlyWithNumber: e.target.checked })} /> nur mit Nummer
            </label>
          )}
          <button onClick={() => setSettingsDraft({ ...settingsDraft, [key]: settingsDraft[key].filter((_, i) => i !== idx) })} style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer" }}>✖</button>
        </div>
      ))}
      <button onClick={() => setSettingsDraft({ ...settingsDraft, [key]: [...settingsDraft[key], { id: `item${Date.now()}`, name: "", price: 0, onlyWithNumber: false }] })} style={{ background: "none", border: "1px dashed #aaa", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", marginBottom: "14px" }}>➕ Kostenposition</button>
    </>
  );

  const thisYear = new Date().getFullYear();

  return (
    <div style={{ fontFamily: "sans-serif", color: "#333", textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
        <h2 style={{ margin: 0, color: "#e67e22", fontSize: "20px" }}>☀️ Sommercamp</h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select value={campYear} onChange={(e) => setCampYear(Number(e.target.value))} style={{ ...inputStyle, width: "auto", fontWeight: "bold" }}>
            {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2, thisYear - 3].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={openCosts} style={button("#7f8c8d")}>⚙ Preise & Kosten</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: "1 1 120px", padding: "10px", border: "none", borderRadius: "8px", background: tab === t.id ? "#e67e22" : "#fdebd0", color: tab === t.id ? "white" : "#935116", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>
            {t.label}{t.id === "participants" ? ` (${participants.length})` : t.id === "staff" ? ` (${staff.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <Dashboard participants={participants} staff={staff} donations={donations} settings={settings} />}
      {tab === "participants" && <Participants clubId={clubId} campYear={campYear} participants={participants} settings={settings} onEditCosts={openCosts} />}
      {tab === "staff" && <Staff clubId={clubId} campYear={campYear} staff={staff} settings={settings} onEditCosts={openCosts} />}
      {tab === "groups" && <Groups campYear={campYear} participants={participants} staff={staff} settings={settings} onSaveGroups={(groups) => saveYearSettings({ ...settings, groups })} />}
      {tab === "donations" && <Donations clubId={clubId} campYear={campYear} donations={donations} />}

      <p style={{ fontSize: "11px", color: "#999", marginTop: "14px" }}>Alle Sommercamp-Daten (inkl. Allergien und Kontaktdaten) sind nur für Admins sichtbar.</p>

      {settingsDraft && (
        <Modal onClose={() => setSettingsDraft(null)} maxWidth="500px">
          <h3 style={{ margin: "0 0 4px 0", color: "#2146d0" }}>⚙ Preise & Kosten Sommercamp {campYear}</h3>
          <p style={{ fontSize: "11px", color: "#888", margin: "0 0 10px 0" }}>Gelten nur für {campYear}. Andere Jahre behalten ihre eigenen Preise und Kosten.</p>
          {!settingsByYear[campYear] && (
            <p style={{ fontSize: "12px", background: "#fef9e7", border: "1px solid #f7dc6f", borderRadius: "6px", padding: "6px 8px", margin: "0 0 10px 0" }}>
              Für {campYear} sind noch keine eigenen Preise gespeichert – angezeigt werden die Standardwerte.
            </p>
          )}
          {previousYear && (
            <button
              onClick={() => setSettingsDraft({ ...JSON.parse(JSON.stringify(withDefaults(settingsByYear[previousYear]))), groups: settingsDraft.groups })}
              style={{ ...button("#eef2ff", "#2146d0"), border: "1px solid #c7d2fe", width: "100%", marginBottom: "12px", fontSize: "12px" }}
            >
              📋 Preise & Kosten aus {previousYear} übernehmen (danach anpassen und speichern)
            </button>
          )}

          <h4 style={{ fontSize: "13px", margin: "0 0 6px 0" }}>Teilnahmegebühr</h4>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
            {[["baseFee", "Grundpreis"], ["memberDiscount", "− Rabatt Mitglied SVON"], ["siblingDiscount", "− Rabatt Geschwisterkind"], ["numberSurcharge", "+ Trikotnummer (optional)"]].map(([key, label]) => (
              <div key={key} style={{ flex: "1 1 45%" }}>
                <label style={labelStyle}>{label} (€)</label>
                <input type="number" step="0.01" value={settingsDraft[key]} onChange={(e) => setSettingsDraft({ ...settingsDraft, [key]: e.target.value })} style={inputStyle} />
              </div>
            ))}
          </div>
          <p style={{ fontSize: "11px", color: "#555", margin: "0 0 14px 0" }}>
            Beispiel Mitglied mit Trikotnummer: {Number(settingsDraft.baseFee) - Number(settingsDraft.memberDiscount) + Number(settingsDraft.numberSurcharge)} €
          </p>

          <h4 style={{ fontSize: "13px", margin: "0 0 6px 0" }}>Kosten Verein pro Kind</h4>
          {costItemEditor("costItems", true)}

          <h4 style={{ fontSize: "13px", margin: "0 0 6px 0" }}>Kosten Verein pro Betreuer</h4>
          {costItemEditor("staffCostItems", false)}

          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={saveSettings} style={{ ...button("#2146d0"), flex: 1 }}>💾 Speichern</button>
            <button onClick={() => setSettingsDraft(null)} style={{ ...button("#eee", "#333"), flex: 1 }}>Abbrechen</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
