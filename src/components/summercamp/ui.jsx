// Gemeinsame Bausteine für das Sommercamp
import { inputStyle, labelStyle } from "./styles";

export function Modal({ onClose, maxWidth = "640px", children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "15px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: "10px", padding: "18px", width: "100%", maxWidth, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 6px 20px rgba(0,0,0,0.2)", textAlign: "left" }}>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, value, onChange, type = "text", flex = "1 1 180px", ...rest }) {
  return (
    <div style={{ flex }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={inputStyle} {...rest} />
    </div>
  );
}

export function Check({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} style={{ width: "16px", height: "16px" }} /> {label}
    </label>
  );
}

export function StatTile({ label, value, color = "#333", hint }) {
  return (
    <div style={{ flex: "1 1 140px", background: "white", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
      <div style={{ fontSize: "20px", fontWeight: "bold", color }}>{value}</div>
      <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>{label}</div>
      {hint && <div style={{ fontSize: "10px", color: "#999", marginTop: "2px" }}>{hint}</div>}
    </div>
  );
}

// Waagrechtes Balkendiagramm für eine Kennzahl (Anzahl) – ein Farbton, Wert direkt am Balken, Tooltip beim Drüberfahren
export function BarChart({ title, data, unit = "", color = "#2146d0", emptyText = "Noch keine Daten." }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div style={{ background: "white", border: "1px solid #e0e0e0", borderRadius: "10px", padding: "14px", flex: "1 1 300px", minWidth: 0 }}>
      <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>{title}</h4>
      {data.length === 0 ? <p style={{ fontSize: "12px", color: "#999", margin: 0 }}>{emptyText}</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {data.map(d => (
            <div key={d.label} title={`${d.label}: ${d.value}${unit}`} style={{ display: "grid", gridTemplateColumns: "minmax(80px, 38%) 1fr", alignItems: "center", gap: "8px", fontSize: "12px", padding: "2px 0" }}>
              <span style={{ color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ height: "14px", width: `${Math.max(2, (d.value / max) * 100)}%`, background: color, borderRadius: "0 4px 4px 0" }} />
                <span style={{ color: "#333", fontWeight: "bold", minWidth: "20px" }}>{d.value}{unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
