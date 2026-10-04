import { useState, useEffect } from "react";
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

// --- WICHTIG: Diese Felder sind jetzt AUSSERHALB der Hauptkomponente! ---
// Das behebt den Fehler, dass du nach jedem Buchstaben neu ins Feld klicken musstest.
const InputField = ({ label, name, value, onChange, type = "text", placeholder = "", required = false }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 200px" }}>
    <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>{label}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "14px" }}
    />
  </div>
);

const CheckboxField = ({ label, name, checked, onChange }) => (
  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#333", cursor: "pointer", padding: "5px 0" }}>
    <input
      type="checkbox"
      name={name}
      checked={checked}
      onChange={onChange}
      style={{ width: "18px", height: "18px" }}
    />
    {label}
  </label>
);

export default function YouthManager({ clubId }) {
  const [allPlayers, setAllPlayers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard", "add", "active", "history"

  const youthTeams = ["U19 (A-Jugend)", "U17 (B-Jugend)", "U15 (C-Jugend)", "U13 (D-Jugend)", "U11 (E-Jugend)", "U9 (F-Jugend)", "U7 (Bambini)"];

  const initialFormState = {
    youthTeam: "U19 (A-Jugend)",
    firstName: "",
    lastName: "",
    birthDate: "",
    age: "",
    birthYear: "",
    registeredSVON: false,
    registeredDFB: false,
    passNumber: "",
    photoConsent: false,
    address: "",
    city: "",
    fatherName: "",
    fatherPhone: "",
    motherName: "",
    motherPhone: ""
  };

  const [formData, setFormData] = useState(initialFormState);

  // Alle Jugendspieler laden (Aktiv & Abgemeldet)
  useEffect(() => {
    if (!clubId) return;

    const q = query(
      collection(db, "youth_players"),
      where("clubId", "==", clubId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedPlayers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Alphabetisch nach Nachname sortieren
      loadedPlayers.sort((a, b) => (a.lastName || "").localeCompare(b.lastName || ""));
      setAllPlayers(loadedPlayers);
    });

    return () => unsubscribe();
  }, [clubId]);

  // Gefilterte Listen
  const activePlayers = allPlayers.filter(p => p.status === "aktiv");
  const inactivePlayers = allPlayers.filter(p => p.status === "abgemeldet");

  // Dashboard-Logik: Spieler pro Jahrgang zählen
  const playersPerYear = activePlayers.reduce((acc, player) => {
    const year = player.birthYear || "Unbekannt";
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {});
  
  // Jahrgänge absteigend sortieren (jüngste zuerst)
  const sortedYears = Object.keys(playersPerYear).sort((a, b) => b.localeCompare(a));

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let updatedValues = { [name]: type === "checkbox" ? checked : value };
    
    if (name === "birthDate" && value) {
      const year = value.split("-")[0];
      updatedValues.birthYear = year;
      
      const birthDateObj = new Date(value);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDateObj.getFullYear();
      const m = today.getMonth() - birthDateObj.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
        calculatedAge--;
      }
      updatedValues.age = calculatedAge.toString();
    }

    setFormData(prev => ({ ...prev, ...updatedValues }));
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      alert("Bitte mindestens Vor- und Nachname eingeben!");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "youth_players"), {
        ...formData,
        clubId: clubId,
        status: "aktiv",
        registeredAt: new Date().toISOString()
      });
      
      setFormData(initialFormState);
      alert("Spieler erfolgreich angelegt!");
      setActiveTab("active"); // Springt nach Erfolg direkt zur Liste
    } catch (error) {
      console.error("Fehler beim Anlegen:", error);
      alert("Fehler beim Speichern in der Datenbank.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeregisterPlayer = async (player) => {
    const confirmDeregister = window.confirm(`Möchtest du ${player.firstName} ${player.lastName} wirklich abmelden?`);
    if (!confirmDeregister) return;

    try {
      const playerRef = doc(db, "youth_players", player.id);
      await updateDoc(playerRef, {
        status: "abgemeldet",
        deregisteredAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Fehler beim Abmelden:", error);
      alert("Fehler beim Abmelden des Spielers.");
    }
  };

  const handleReactivatePlayer = async (player) => {
    const confirmReactivate = window.confirm(`Möchtest du ${player.firstName} ${player.lastName} wieder AKTIV setzen?`);
    if (!confirmReactivate) return;

    try {
      const playerRef = doc(db, "youth_players", player.id);
      await updateDoc(playerRef, {
        status: "aktiv",
        reactivatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Fehler beim Reaktivieren:", error);
      alert("Fehler beim Wiederanmelden des Spielers.");
    }
  };

  // UI-Hilfskomponente für die Tabs
  const TabButton = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: "10px 15px",
        border: "none",
        borderRadius: "8px",
        background: activeTab === id ? "#2146d0" : "#e0e7ff",
        color: activeTab === id ? "white" : "#3730a3",
        fontWeight: "bold",
        cursor: "pointer",
        flex: "1 1 auto",
        fontSize: "14px",
        transition: "background 0.2s"
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: "15px", maxWidth: "900px", margin: "0 auto", fontFamily: "sans-serif", color: "#333" }}>
      <h2 style={{ color: "#2146d0", marginBottom: "20px", textAlign: "center" }}>👦 Jugendabteilung ({clubId?.toUpperCase()})</h2>

      {/* --- TAB NAVIGATION --- */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "25px" }}>
        <TabButton id="dashboard" label="📊 Dashboard" />
        <TabButton id="add" label="➕ Neu Anlegen" />
        <TabButton id="active" label={`👦 Aktive (${activePlayers.length})`} />
        <TabButton id="history" label={`🕰️ Historie (${inactivePlayers.length})`} />
      </div>

      {/* --- 1. DASHBOARD --- */}
      {activeTab === "dashboard" && (
        <div style={{ background: "white", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
          <h3 style={{ marginTop: 0, color: "#2146d0", borderBottom: "2px solid #eee", paddingBottom: "10px" }}>
            Übersicht: Aktive Spieler pro Jahrgang
          </h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "15px", marginTop: "20px" }}>
            {sortedYears.length === 0 ? (
              <p style={{ color: "#777" }}>Keine Daten vorhanden.</p>
            ) : (
              sortedYears.map(year => (
                <div key={year} style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: "8px", padding: "15px", textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#3730a3" }}>{playersPerYear[year]}</div>
                  <div style={{ fontSize: "14px", color: "#555", fontWeight: "bold", marginTop: "5px" }}>Jg. {year}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- 2. FORMULAR: NEU ANLEGEN --- */}
      {activeTab === "add" && (
        <form onSubmit={handleAddPlayer} style={{ background: "#eef2ff", padding: "20px", borderRadius: "10px", border: "1px solid #c7d2fe" }}>
          <h3 style={{ marginTop: 0, marginBottom: "20px", fontSize: "18px", color: "#3730a3", borderBottom: "2px solid #c7d2fe", paddingBottom: "10px" }}>
            Neuen Spieler anlegen
          </h3>
          
          <h4 style={{ color: "#4f46e5", marginBottom: "10px", fontSize: "14px" }}>👤 Spielerdaten</h4>
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "20px" }}>
            <InputField label="Vorname *" name="firstName" value={formData.firstName} onChange={handleChange} required={true} />
            <InputField label="Nachname *" name="lastName" value={formData.lastName} onChange={handleChange} required={true} />
            <InputField label="Geburtsdatum" name="birthDate" value={formData.birthDate} onChange={handleChange} type="date" />
            <InputField label="Alter" name="age" value={formData.age} onChange={handleChange} type="number" placeholder="Wird auto-berechnet" />
            <InputField label="Jahrgang" name="birthYear" value={formData.birthYear} onChange={handleChange} type="number" placeholder="z.B. 2010" />
          </div>

          <h4 style={{ color: "#4f46e5", marginBottom: "10px", fontSize: "14px" }}>⚽ Vereinsdaten</h4>
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "15px", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 200px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Jugendmannschaft</label>
              <select
                name="youthTeam"
                value={formData.youthTeam}
                onChange={handleChange}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "14px" }}
              >
                {youthTeams.map(team => <option key={team} value={team}>{team}</option>)}
              </select>
            </div>
            <InputField label="Passnummer" name="passNumber" value={formData.passNumber} onChange={handleChange} />
          </div>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "20px", background: "rgba(255,255,255,0.5)", padding: "10px", borderRadius: "8px" }}>
            <CheckboxField label="Angemeldet bei SVON" name="registeredSVON" checked={formData.registeredSVON} onChange={handleChange} />
            <CheckboxField label="Angemeldet beim DFB" name="registeredDFB" checked={formData.registeredDFB} onChange={handleChange} />
            <CheckboxField label="Bilder-Veröffentlichung erlaubt" name="photoConsent" checked={formData.photoConsent} onChange={handleChange} />
          </div>

          <h4 style={{ color: "#4f46e5", marginBottom: "10px", fontSize: "14px" }}>🏠 Eltern & Kontakt</h4>
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "15px" }}>
            <InputField label="Straße / Anschrift" name="address" value={formData.address} onChange={handleChange} />
            <InputField label="Wohnort" name="city" value={formData.city} onChange={handleChange} />
          </div>
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "25px" }}>
            <InputField label="Name Papa" name="fatherName" value={formData.fatherName} onChange={handleChange} />
            <InputField label="Telefonnummer Papa" name="fatherPhone" value={formData.fatherPhone} onChange={handleChange} type="tel" />
            <InputField label="Name Mama" name="motherName" value={formData.motherName} onChange={handleChange} />
            <InputField label="Telefonnummer Mama" name="motherPhone" value={formData.motherPhone} onChange={handleChange} type="tel" />
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            style={{ width: "100%", padding: "15px", background: "#2146d0", color: "white", border: "none", borderRadius: "8px", cursor: isSubmitting ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "16px" }}
          >
            {isSubmitting ? "Wird gespeichert..." : "💾 Spieler speichern"}
          </button>
        </form>
      )}

      {/* --- 3. AKTIVE SPIELER --- */}
      {activeTab === "active" && (
        <div style={{ background: "white", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", padding: "15px" }}>
          {activePlayers.length === 0 ? (
            <p style={{ color: "#777", textAlign: "center", margin: "20px 0" }}>Keine aktiven Spieler gemeldet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                <thead style={{ background: "#2146d0", color: "white" }}>
                  <tr>
                    <th style={{ padding: "12px", textAlign: "left" }}>Name, Vorname</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Jugend</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Jahrgang</th>
                    <th style={{ padding: "12px", textAlign: "right" }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {activePlayers.map((player, index) => (
                    <tr key={player.id} style={{ borderBottom: "1px solid #eee", background: index % 2 === 0 ? "white" : "#f8f9fa" }}>
                      <td style={{ padding: "12px", fontWeight: "bold" }}>{player.lastName}, {player.firstName}</td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#555" }}>{player.youthTeam}</td>
                      <td style={{ padding: "12px", textAlign: "center" }}>{player.birthYear || "?"}</td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <button
                          onClick={() => handleDeregisterPlayer(player)}
                          style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}
                        >
                          Abmelden
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- 4. HISTORIE (ABGEMELDETE SPIELER) --- */}
      {activeTab === "history" && (
        <div style={{ background: "white", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", padding: "15px" }}>
          {inactivePlayers.length === 0 ? (
            <p style={{ color: "#777", textAlign: "center", margin: "20px 0" }}>Bisher keine abgemeldeten Spieler.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                <thead style={{ background: "#95a5a6", color: "white" }}>
                  <tr>
                    <th style={{ padding: "12px", textAlign: "left" }}>Name, Vorname</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Abgemeldet am</th>
                    <th style={{ padding: "12px", textAlign: "right" }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {inactivePlayers.map((player, index) => (
                    <tr key={player.id} style={{ borderBottom: "1px solid #eee", background: index % 2 === 0 ? "white" : "#f8f9fa" }}>
                      <td style={{ padding: "12px", fontWeight: "bold", color: "#7f8c8d" }}>{player.lastName}, {player.firstName}</td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#7f8c8d" }}>
                        {player.deregisteredAt ? new Date(player.deregisteredAt).toLocaleDateString("de-DE") : "Unbekannt"}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <button
                          onClick={() => handleReactivatePlayer(player)}
                          style={{ background: "#27ae60", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}
                        >
                          Wieder anmelden
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}