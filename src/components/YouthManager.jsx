import { useState, useEffect } from "react";
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

export default function YouthManager({ clubId }) {
  const [players, setPlayers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  useEffect(() => {
    if (!clubId) return;

    const q = query(
      collection(db, "youth_players"),
      where("clubId", "==", clubId),
      where("status", "==", "aktiv")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedPlayers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      loadedPlayers.sort((a, b) => a.lastName.localeCompare(b.lastName));
      setPlayers(loadedPlayers);
    });

    return () => unsubscribe();
  }, [clubId]);

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

    setFormData(prev => ({
      ...prev,
      ...updatedValues
    }));
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

  const InputField = ({ label, name, type = "text", placeholder = "", required = false }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 200px" }}>
      <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>{label}</label>
      <input
        type={type}
        name={name}
        value={formData[name]}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "14px" }}
      />
    </div>
  );

  const CheckboxField = ({ label, name }) => (
    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#333", cursor: "pointer", padding: "5px 0" }}>
      <input
        type="checkbox"
        name={name}
        checked={formData[name]}
        onChange={handleChange}
        style={{ width: "18px", height: "18px" }}
      />
      {label}
    </label>
  );

  return (
    <div style={{ padding: "15px", maxWidth: "900px", margin: "0 auto", fontFamily: "sans-serif", color: "#333" }}>
      <h2 style={{ color: "#2146d0", marginBottom: "20px", textAlign: "center" }}>👦 Jugendabteilung ({clubId?.toUpperCase()})</h2>

      <form onSubmit={handleAddPlayer} style={{ background: "#eef2ff", padding: "20px", borderRadius: "10px", border: "1px solid #c7d2fe", marginBottom: "30px" }}>
        <h3 style={{ marginTop: 0, marginBottom: "20px", fontSize: "18px", color: "#3730a3", borderBottom: "2px solid #c7d2fe", paddingBottom: "10px" }}>
          Neuen Spieler anlegen
        </h3>
        
        <h4 style={{ color: "#4f46e5", marginBottom: "10px", fontSize: "14px" }}>👤 Spielerdaten</h4>
        <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "20px" }}>
          <InputField label="Vorname *" name="firstName" required={true} />
          <InputField label="Nachname (Familienname) *" name="lastName" required={true} />
          <InputField label="Geburtsdatum" name="birthDate" type="date" />
          <InputField label="Alter" name="age" type="number" placeholder="Wird auto-berechnet" />
          <InputField label="Jahrgang" name="birthYear" type="number" placeholder="z.B. 2010" />
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
          <InputField label="Passnummer" name="passNumber" />
        </div>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "20px", background: "rgba(255,255,255,0.5)", padding: "10px", borderRadius: "8px" }}>
          <CheckboxField label="Angemeldet bei SVON" name="registeredSVON" />
          <CheckboxField label="Angemeldet beim DFB" name="registeredDFB" />
          <CheckboxField label="Einverständnis Veröffentlichung Bilder" name="photoConsent" />
        </div>

        <h4 style={{ color: "#4f46e5", marginBottom: "10px", fontSize: "14px" }}>🏠 Eltern & Kontakt</h4>
        <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "15px" }}>
          <InputField label="Straße / Anschrift" name="address" />
          <InputField label="Wohnort" name="city" />
        </div>
        <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "25px" }}>
          <InputField label="Name Papa" name="fatherName" />
          <InputField label="Telefonnummer Papa" name="fatherPhone" type="tel" />
          <InputField label="Name Mama" name="motherName" />
          <InputField label="Telefonnummer Mama" name="motherPhone" type="tel" />
        </div>

        <button 
          type="submit"
          disabled={isSubmitting}
          style={{ width: "100%", padding: "15px", background: "#2146d0", color: "white", border: "none", borderRadius: "8px", cursor: isSubmitting ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "16px", opacity: isSubmitting ? 0.7 : 1 }}
        >
          {isSubmitting ? "Wird gespeichert..." : "💾 Spieler speichern"}
        </button>
      </form>

      <h3 style={{ fontSize: "18px", borderBottom: "2px solid #eee", paddingBottom: "10px", color: "#2146d0" }}>
        Aktive Jugendspieler ({players.length})
      </h3>
      
      {players.length === 0 ? (
        <p style={{ color: "#777", textAlign: "center", marginTop: "20px" }}>Keine aktiven Spieler gemeldet.</p>
      ) : (
        <div style={{ overflowX: "auto", background: "white", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
            <thead style={{ background: "#2146d0", color: "white" }}>
              <tr>
                <th style={{ padding: "12px", textAlign: "left" }}>Name, Vorname</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Jugend</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Jg. (Alter)</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Pässe (SVON/DFB)</th>
                <th style={{ padding: "12px", textAlign: "right" }}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player.id} style={{ borderBottom: "1px solid #eee", background: index % 2 === 0 ? "white" : "#f8f9fa" }}>
                  <td style={{ padding: "12px", fontWeight: "bold" }}>
                    {player.lastName}, {player.firstName}
                  </td>
                  <td style={{ padding: "12px", textAlign: "center", color: "#555" }}>
                    {player.youthTeam}
                  </td>
                  <td style={{ padding: "12px", textAlign: "center" }}>
                    {player.birthYear || "?"} {player.age ? `(${player.age}J)` : ""}
                  </td>
                  <td style={{ padding: "12px", textAlign: "center" }}>
                    <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: "4px", background: player.registeredSVON ? "#d4edda" : "#f8d7da", color: player.registeredSVON ? "#155724" : "#721c24", margin: "2px", fontSize: "12px", fontWeight: "bold" }}>
                      SVON
                    </span>
                    <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: "4px", background: player.registeredDFB ? "#d4edda" : "#f8d7da", color: player.registeredDFB ? "#155724" : "#721c24", margin: "2px", fontSize: "12px", fontWeight: "bold" }}>
                      DFB
                    </span>
                  </td>
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
  );
}