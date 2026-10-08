// Sommercamp: Preise, Kostenberechnung, Gruppen und Export (alle Beträge in Euro)

export const DEFAULT_CAMP_SETTINGS = {
  baseFee: 100,           // Teilnahmegebühr Grundpreis
  memberDiscount: 10,     // Rabatt für Mitglieder des SVON
  siblingDiscount: 10,    // Rabatt Geschwisterkind
  numberSurcharge: 6,     // Aufpreis mit Trikotnummer (optional)
  // Vereinskosten (Einkauf) pro Kind; onlyWithNumber = fällt nur mit Trikotnummer an
  costItems: [
    { id: "shirt", name: "T-Shirt", price: 17.70, onlyWithNumber: false },
    { id: "number", name: "Nummer", price: 4.90, onlyWithNumber: true },
    { id: "bottle", name: "Flasche", price: 2.99, onlyWithNumber: false },
    { id: "medal", name: "Medaille/Pokal", price: 1.70, onlyWithNumber: false },
    { id: "logo", name: "Logo Brust", price: 4.90, onlyWithNumber: false }
  ],
  // Vereinskosten pro Betreuer
  staffCostItems: [
    { id: "shirt", name: "T-Shirt", price: 21.50 },
    { id: "slogan", name: "Slogan", price: 4.90 }
  ],
  // Gruppen nach Jahrgang mit zugeteilten Betreuern
  groups: []
};

export const SHIRT_SIZES = ["", "116", "128", "140", "152", "164", "XS", "S", "M", "L", "XL", "XXL", "3XL"];
export const STAFF_ROLES = ["Trainer", "Springer", "Ausdauer und Körper", "Betreuer", "Organisation"];

const round2 = (value) => Math.round(value * 100) / 100;

export const withDefaults = (saved) => ({ ...DEFAULT_CAMP_SETTINGS, ...(saved || {}) });

// Teilnahmegebühr: Grundpreis − Mitglied − Geschwister + Trikotnummer; ein Sonderpreis hat Vorrang
export const participantFee = (p, settings) => {
  if (p.customFee !== undefined && p.customFee !== null && p.customFee !== "") return round2(Number(p.customFee));
  return round2(
    Number(settings.baseFee)
    - (p.member ? Number(settings.memberDiscount) : 0)
    - (p.sibling ? Number(settings.siblingDiscount) : 0)
    + (p.withNumber ? Number(settings.numberSurcharge) : 0)
  );
};

// Vereinskosten je Position für einen Teilnehmer
export const participantCosts = (p, settings) =>
  Object.fromEntries(settings.costItems.map(item => [item.id, item.onlyWithNumber && !p.withNumber ? 0 : round2(Number(item.price))]));

export const participantCostSum = (p, settings) =>
  round2(Object.values(participantCosts(p, settings)).reduce((sum, v) => sum + v, 0));

export const staffCostSum = (settings) =>
  round2(settings.staffCostItems.reduce((sum, item) => sum + Number(item.price || 0), 0));

export const birthYearOf = (p) => (p.birthDate || "").slice(0, 4);

// Gruppe eines Teilnehmers: manuelle Zuteilung hat Vorrang, sonst nach Jahrgang
export const groupOf = (p, groups) => {
  if (p.groupId) return groups.find(g => g.id === p.groupId) || null;
  const year = Number(birthYearOf(p));
  if (!year) return null;
  return groups.find(g => year >= Number(g.yearFrom) && year <= Number(g.yearTo)) || null;
};

export const formatEuro = (value) =>
  Number(value || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export const formatDate = (iso) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE") : (iso || "");

export const today = () => new Date().toLocaleDateString("sv-SE");

// CSV-Download, der von Excel direkt mit Umlauten geöffnet wird (Semikolon, UTF-8 mit BOM)
export const csvText = (value) => `"${String(value ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
export const csvEuro = (value) => csvText(Number(value || 0).toFixed(2).replace(".", ","));
export const downloadCSV = (filename, headers, rows) => {
  const content = [headers.map(csvText).join(";"), ...rows.map(r => r.join(";"))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
