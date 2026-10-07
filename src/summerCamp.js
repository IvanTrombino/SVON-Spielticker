// Sommercamp: Preise und Kostenberechnung (alle Beträge in Euro)

export const DEFAULT_CAMP_SETTINGS = {
  baseFee: 90,            // Teilnahmegebühr Grundpreis
  numberSurcharge: 6,     // Aufpreis mit Rückennummer
  siblingDiscount: 10,    // Rabatt Geschwisterkind
  nonMemberSurcharge: 0,  // Aufschlag für Nicht-Mitglieder
  // Vereinskosten (Einkauf) pro Kind; onlyWithNumber = fällt nur mit Rückennummer an
  costItems: [
    { id: "shirt", name: "T-Shirt", price: 17.70, onlyWithNumber: false },
    { id: "number", name: "Nummer", price: 4.90, onlyWithNumber: true },
    { id: "bottle", name: "Flasche", price: 2.99, onlyWithNumber: false },
    { id: "medal", name: "Medaille/Pokal", price: 1.70, onlyWithNumber: false },
    { id: "logo", name: "Logo Brust", price: 4.90, onlyWithNumber: false }
  ]
};

export const SHIRT_SIZES = ["", "116", "128", "140", "152", "164", "XS", "S", "M", "L", "XL"];

const round2 = (value) => Math.round(value * 100) / 100;

// Teilnahmegebühr: Grundpreis + Nummer − Geschwister + Nicht-Mitglied; ein Sonderpreis hat Vorrang
export const participantFee = (p, settings) => {
  if (p.customFee !== undefined && p.customFee !== null && p.customFee !== "") return round2(Number(p.customFee));
  return round2(
    Number(settings.baseFee)
    + (p.withNumber ? Number(settings.numberSurcharge) : 0)
    - (p.sibling ? Number(settings.siblingDiscount) : 0)
    + (p.member ? 0 : Number(settings.nonMemberSurcharge))
  );
};

// Vereinskosten je Position für einen Teilnehmer
export const participantCosts = (p, settings) =>
  Object.fromEntries(settings.costItems.map(item => [item.id, item.onlyWithNumber && !p.withNumber ? 0 : round2(Number(item.price))]));

export const participantCostSum = (p, settings) =>
  round2(Object.values(participantCosts(p, settings)).reduce((sum, v) => sum + v, 0));

export const formatEuro = (value) =>
  Number(value || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
