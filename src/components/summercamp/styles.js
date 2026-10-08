// Gemeinsame Stile und Hilfen für das Sommercamp

export const inputStyle = { padding: "8px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "13px", width: "100%", boxSizing: "border-box" };
export const labelStyle = { fontSize: "11px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "3px" };
export const cell = { padding: "6px 8px", fontSize: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", textAlign: "left" };
export const button = (background, color = "white") => ({ padding: "9px 14px", background, color, border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" });

// Zählt Einträge nach Schlüssel -> [{ label, value }]
export const countBy = (items, keyFn) => {
  const counts = {};
  items.forEach(item => {
    const key = keyFn(item);
    if (key) counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
};
