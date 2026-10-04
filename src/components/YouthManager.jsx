import { useState, useEffect } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, where, setDoc } from "firebase/firestore";
import { db } from "../firebase";

// --- HILFS-KOMPONENTEN ---

const InputField = ({ label, name, value, onChange, type = "text", placeholder = "", required = false }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 200px" }}>
    <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>{label}</label>
    <input
      type={type}
      name={name}
      value={value || ""}
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
      checked={checked || false}
      onChange={onChange}
      style={{ width: "18px", height: "18px" }}
    />
    {label}
  </label>
);

// --- SPIELER FORMULAR ---
const PlayerForm = ({ formData, handleChange, onSubmit, isSubmitting, title, buttonText, onCancel, teamsList }) => (
  <form onSubmit={onSubmit} style={{ background: "#eef2ff", padding: "20px", borderRadius: "10px", border: "1px solid #c7d2fe", color: "#333" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #c7d2fe", paddingBottom: "10px", marginBottom: "20px" }}>
      <h3 style={{ margin: 0, fontSize: "18px", color: "#3730a3" }}>{title}</h3>
      {onCancel && (
        <button type="button" onClick={onCancel} style={{ background: "#95a5a6", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold" }}>
          ✕ Abbrechen
        </button>
      )}
    </div>
    
    <h4 style={{ color: "#4f46e5", marginBottom: "10px", fontSize: "14px" }}>👤 Spielerdaten</h4>
    <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "20px" }}>
      <InputField label="Vorname *" name="firstName" value={formData.firstName} onChange={handleChange} required={true} />
      <InputField label="Nachname *" name="lastName" value={formData.lastName} onChange={handleChange} required={true} />
      <InputField label="Geburtsdatum" name="birthDate" value={formData.birthDate} onChange={handleChange} type="date" />
      <InputField label="Alter" name="age" value={formData.age} onChange={handleChange} type="number" placeholder="auto" />
      <InputField label="Jahrgang" name="birthYear" value={formData.birthYear} onChange={handleChange} type="number" placeholder="z.B. 2010" />
    </div>

    <h4 style={{ color: "#4f46e5", marginBottom: "10px", fontSize: "14px" }}>⚽ Vereinsdaten</h4>
    <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "15px", alignItems: "flex-end" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 200px" }}>
        <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Jugendmannschaft (Zuweisung)</label>
        <select
          name="youthTeam"
          value={formData.youthTeam}
          onChange={handleChange}
          style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "14px" }}
        >
          <option value="">-- Ohne Team --</option>
          {teamsList.map(team => (
            <option key={team.id} value={team.name}>{team.name} (Jg. {team.years})</option>
          ))}
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

    <button type="submit" disabled={isSubmitting} style={{ width: "100%", padding: "15px", background: "#2146d0", color: "white", border: "none", borderRadius: "8px", cursor: isSubmitting ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "16px" }}>
      {isSubmitting ? "Wird gespeichert..." : buttonText}
    </button>
  </form>
);

// --- TRAINER FORMULAR ---
const CoachForm = ({ formData, handleChange, onSubmit, isSubmitting, title, buttonText, onCancel, teamsList }) => (
  <form onSubmit={onSubmit} style={{ background: "#e8f8f5", padding: "20px", borderRadius: "10px", border: "1px solid #a3e4d7", marginBottom: "20px", color: "#333" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #a3e4d7", paddingBottom: "10px", marginBottom: "20px" }}>
      <h3 style={{ margin: 0, fontSize: "18px", color: "#117a65" }}>{title}</h3>
      {onCancel && (
        <button type="button" onClick={onCancel} style={{ background: "#95a5a6", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold" }}>
          ✕ Abbrechen
        </button>
      )}
    </div>
    
    <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "20px" }}>
      <InputField label="Vorname *" name="firstName" value={formData.firstName} onChange={handleChange} required={true} />
      <InputField label="Nachname *" name="lastName" value={formData.lastName} onChange={handleChange} required={true} />
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 200px" }}>
        <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Zuständig für Jugend *</label>
        <select name="youthTeam" value={formData.youthTeam} onChange={handleChange} required style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "14px" }}>
          <option value="">-- Bitte wählen --</option>
          <option value="Jugendleitung">Jugendleitung (Übergreifend)</option>
          {teamsList.map(team => (
            <option key={team.id} value={team.name}>{team.name}</option>
          ))}
        </select>
      </div>
    </div>
    <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "20px" }}>
      <InputField label="Handynummer" name="phone" value={formData.phone} onChange={handleChange} type="tel" />
      <InputField label="E-Mail Adresse" name="email" value={formData.email} onChange={handleChange} type="email" />
      <InputField label="Schlüssel-Nr." name="keyNumber" value={formData.keyNumber} onChange={handleChange} />
    </div>

    <button type="submit" disabled={isSubmitting} style={{ width: "100%", padding: "15px", background: "#1abc9c", color: "white", border: "none", borderRadius: "8px", cursor: isSubmitting ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "16px" }}>
      {isSubmitting ? "Wird gespeichert..." : buttonText}
    </button>
  </form>
);


// --- HAUPTKOMPONENTE ---
export default function YouthManager({ clubId }) {
  const [allPlayers, setAllPlayers] = useState([]);
  const [teamSettings, setTeamSettings] = useState([]);
  const [coaches, setCoaches] = useState([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Sortierung Historie
  const [historySortBy, setHistorySortBy] = useState("name"); // "name" oder "date"

  // States Teamverwaltung
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamYears, setNewTeamYears] = useState("");
  const [newTeamCount, setNewTeamCount] = useState(1); // Anzahl gemeldeter Mannschaften

  // States Spieler
  const initialPlayerState = { youthTeam: "", firstName: "", lastName: "", birthDate: "", age: "", birthYear: "", registeredSVON: false, registeredDFB: false, passNumber: "", photoConsent: false, address: "", city: "", fatherName: "", fatherPhone: "", motherName: "", motherPhone: "" };
  const [playerFormData, setPlayerFormData] = useState(initialPlayerState);
  const [editPlayerFormData, setEditPlayerFormData] = useState(null);

  // States Trainer
  const initialCoachState = { firstName: "", lastName: "", youthTeam: "", phone: "", email: "", keyNumber: "" };
  const [coachFormData, setCoachFormData] = useState(initialCoachState);
  const [editCoachFormData, setEditCoachFormData] = useState(null);
  const [showCoachForm, setShowCoachForm] = useState(false);

  // 1. Teams laden
  useEffect(() => {
    if (!clubId) return;
    const unsub = onSnapshot(doc(db, "youth_settings", clubId), (docSnap) => {
      let loadedTeams = [];
      if (docSnap.exists() && docSnap.data().teams) {
        loadedTeams = docSnap.data().teams;
      } else {
        loadedTeams = [
          { id: "1", name: "A-Jugend", years: "2006, 2007", count: 1 },
          { id: "2", name: "B-Jugend", years: "2008, 2009", count: 1 },
          { id: "3", name: "C-Jugend", years: "2010, 2011", count: 1 },
          { id: "4", name: "D-Jugend", years: "2012, 2013", count: 1 },
          { id: "5", name: "E-Jugend", years: "2014, 2015", count: 1 },
          { id: "6", name: "F-Jugend", years: "2016, 2017", count: 1 },
          { id: "7", name: "Bambini", years: "2018 u. jünger", count: 0 }
        ];
      }
      loaded.sort((a, b) => a.name.localeCompare(b.name));
      setTeamSettings(loadedTeams);
    });
    return () => unsub();
  }, [clubId]);

  // 2. Spieler laden
  useEffect(() => {
    if (!clubId) return;
    const q = query(collection(db, "youth_players"), where("clubId", "==", clubId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      loaded.sort((a, b) => (a.lastName || "").localeCompare(b.lastName || ""));
      setAllPlayers(loaded);
    });
    return () => unsubscribe();
  }, [clubId]);

  // 3. Trainer laden
  useEffect(() => {
    if (!clubId) return;
    const q = query(collection(db, "youth_coaches"), where("clubId", "==", clubId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      loaded.sort((a, b) => (a.lastName || "").localeCompare(b.lastName || ""));
      setCoaches(loaded);
    });
    return () => unsubscribe();
  }, [clubId]);

  const activePlayers = allPlayers.filter(p => p.status === "aktiv");
  const inactivePlayers = allPlayers.filter(p => p.status === "abgemeldet");

  // Historie Sortierung anwenden
  const sortedHistoryPlayers = [...inactivePlayers].sort((a, b) => {
    if (historySortBy === "name") {
      return (a.lastName || "").localeCompare(b.lastName || "");
    } else {
      const dateA = a.deregisteredAt ? new Date(a.deregisteredAt).getTime() : 0;
      const dateB = b.deregisteredAt ? new Date(b.deregisteredAt).getTime() : 0;
      return dateB - dateA;
    }
  });

  const sortedTeamsList = [...teamSettings].sort((a, b) => a.name.localeCompare(b.name));

  // DASHBOARD BERECHNUNGEN
  const totalRegisteredTeams = teamSettings.reduce((sum, t) => sum + (Number(t.count) || 0), 0);
  
  const playersPerYear = activePlayers.reduce((acc, p) => {
    const year = p.birthYear || "Unbekannt";
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {});
  const sortedYears = Object.keys(playersPerYear).sort((a, b) => b.localeCompare(a));

  const playersPerTeam = activePlayers.reduce((acc, p) => {
    const team = p.youthTeam || "Ohne Team";
    acc[team] = (acc[team] || 0) + 1;
    return acc;
  }, {});
  const dashboardSortedTeams = Object.keys(playersPerTeam).sort((a, b) => a.localeCompare(b));

  // --- HANDLER: SPIELER ---
  const handlePlayerChange = (e, isEditMode = false) => {
    const { name, value, type, checked } = e.target;
    let updatedValues = { [name]: type === "checkbox" ? checked : value };
    
    if (name === "birthDate" && value) {
      const year = value.split("-")[0];
      updatedValues.birthYear = year;
      const bd = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - bd.getFullYear();
      if (today.getMonth() < bd.getMonth() || (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate())) age--;
      updatedValues.age = age.toString();
    }
    if (isEditMode) setEditPlayerFormData(prev => ({ ...prev, ...updatedValues }));
    else setPlayerFormData(prev => ({ ...prev, ...updatedValues }));
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "youth_players"), { ...playerFormData, clubId, status: "aktiv", registeredAt: new Date().toISOString() });
      setPlayerFormData(initialPlayerState); alert("Spieler angelegt!"); setActiveTab("active");
    } catch (error) { console.error(error); alert("Fehler!"); } finally { setIsSubmitting(false); }
  };

  const handleUpdatePlayer = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { id, ...updateData } = editPlayerFormData;
      await updateDoc(doc(db, "youth_players", id), updateData);
      setEditPlayerFormData(null); alert("Daten aktualisiert!"); setActiveTab("active");
    } catch (error) { console.error(error); alert("Fehler!"); } finally { setIsSubmitting(false); }
  };

  const handleDeregisterPlayer = async (player) => {
    if (!window.confirm(`${player.firstName} wirklich abmelden?`)) return;
    await updateDoc(doc(db, "youth_players", player.id), { status: "abgemeldet", deregisteredAt: new Date().toISOString() });
  };
  const handleReactivatePlayer = async (player) => {
    if (!window.confirm(`${player.firstName} wieder AKTIV setzen?`)) return;
    await updateDoc(doc(db, "youth_players", player.id), { status: "aktiv", reactivatedAt: new Date().toISOString() });
  };

  // --- HANDLER: TRAINER ---
  const handleCoachChange = (e, isEditMode = false) => {
    const { name, value } = e.target;
    if (isEditMode) setEditCoachFormData(prev => ({ ...prev, [name]: value }));
    else setCoachFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddCoach = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "youth_coaches"), { ...coachFormData, clubId });
      setCoachFormData(initialCoachState); setShowCoachForm(false); alert("Trainer angelegt!");
    } catch (error) { console.error(error); alert("Fehler!"); } finally { setIsSubmitting(false); }
  };

  const handleUpdateCoach = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { id, ...updateData } = editCoachFormData;
      await updateDoc(doc(db, "youth_coaches", id), updateData);
      setEditCoachFormData(null); alert("Trainer aktualisiert!");
    } catch (error) { console.error(error); alert("Fehler!"); } finally { setIsSubmitting(false); }
  };

  const handleDeleteCoach = async (coach) => {
    if (!window.confirm(`Trainer ${coach.firstName} ${coach.lastName} wirklich löschen?`)) return;
    await deleteDoc(doc(db, "youth_coaches", coach.id));
  };

  // --- HANDLER: TEAMS ---
  const saveTeamsToDb = async (newTeamsList) => await setDoc(doc(db, "youth_settings", clubId), { teams: newTeamsList });
  
  const handleAddTeam = async () => {
    if (!newTeamName.trim() || !newTeamYears.trim()) return alert("Bitte ausfüllen!");
    const updated = [...teamSettings, { id: Date.now().toString(), name: newTeamName.trim(), years: newTeamYears.trim(), count: Number(newTeamCount) || 0 }];
    updated.sort((a, b) => a.name.localeCompare(b.name));
    setTeamSettings(updated); 
    await saveTeamsToDb(updated); 
    setNewTeamName(""); 
    setNewTeamYears(""); 
    setNewTeamCount(1);
  };
  
  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm("Mannschaft löschen?")) return;
    const updated = teamSettings.filter(t => t.id !== teamId);
    setTeamSettings(updated); 
    await saveTeamsToDb(updated);
  };

  const handleUpdateTeamCount = async (teamId, newCount) => {
    const updated = teamSettings.map(t => t.id === teamId ? { ...t, count: Math.max(0, Number(newCount) || 0) } : t);
    setTeamSettings(updated);
    await saveTeamsToDb(updated);
  };

  const TabButton = ({ id, label }) => (
    <button onClick={() => setActiveTab(id)} style={{ padding: "10px 15px", border: "none", borderRadius: "8px", background: activeTab === id ? "#2146d0" : "#e0e7ff", color: activeTab === id ? "white" : "#3730a3", fontWeight: "bold", cursor: "pointer", flex: "1 1 auto", fontSize: "14px", transition: "background 0.2s" }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: "15px", maxWidth: "900px", margin: "0 auto", fontFamily: "sans-serif", color: "#333" }}>
      <h2 style={{ color: "#2146d0", marginBottom: "20px", textAlign: "center" }}>👦 Jugendabteilung ({clubId?.toUpperCase()})</h2>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "25px" }}>
        <TabButton id="dashboard" label="📊 Dashboard" />
        <TabButton id="add" label="➕ Neuer Spieler" />
        <TabButton id="active" label={`👦 Aktive (${activePlayers.length})`} />
        <TabButton id="coaches" label={`🧑‍🏫 Trainer (${coaches.length})`} />
        <TabButton id="teams" label="⚙️ Teams" />
        <TabButton id="history" label={`🕰️ Historie (${inactivePlayers.length})`} />
      </div>

      {activeTab === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* DASHBOARD: GESAMT-GEMELDETE MANNSCHAFTEN */}
          <div style={{ background: "#2146d0", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", color: "white", textAlign: "center" }}>
            <h3 style={{ marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: "10px", fontSize: "16px" }}>🏆 Gemeldete Teams im Spielbetrieb</h3>
            <div style={{ fontSize: "36px", fontWeight: "bold", margin: "10px 0" }}>
              {totalRegisteredTeams} <span style={{ fontSize: "18px", fontWeight: "normal", opacity: 0.8 }}>Mannschaften insgesamt</span>
            </div>
            <p style={{ margin: 0, fontSize: "13px", opacity: 0.9 }}>Du kannst die Anzahl pro Altersklasse im Reiter "⚙️ Teams" anpassen (z.B. 2x E-Jugend).</p>
          </div>

          {/* DASHBOARD: TEAMS */}
          <div style={{ background: "white", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", color: "#333" }}>
            <h3 style={{ marginTop: 0, color: "#27ae60", borderBottom: "2px solid #eee", paddingBottom: "10px" }}>Übersicht: Spieler pro Mannschaft</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "15px", marginTop: "20px" }}>
              {dashboardSortedTeams.length === 0 ? <p style={{ color: "#777" }}>Keine Zuweisungen vorhanden.</p> : dashboardSortedTeams.map(team => (
                <div key={team} style={{ background: "#e8f8f5", border: "1px solid #a3e4d7", borderRadius: "8px", padding: "15px", textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#16a085" }}>{playersPerTeam[team]}</div>
                  <div style={{ fontSize: "14px", color: "#555", fontWeight: "bold", marginTop: "5px" }}>{team}</div>
                </div>
              ))}
            </div>
          </div>

          {/* DASHBOARD: JAHRGÄNGE */}
          <div style={{ background: "white", padding: "20px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", color: "#333" }}>
            <h3 style={{ marginTop: 0, color: "#2146d0", borderBottom: "2px solid #eee", paddingBottom: "10px" }}>Übersicht: Spieler pro Jahrgang</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "15px", marginTop: "20px" }}>
              {sortedYears.length === 0 ? <p style={{ color: "#777" }}>Keine Daten vorhanden.</p> : sortedYears.map(year => (
                <div key={year} style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: "8px", padding: "15px", textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#3730a3" }}>{playersPerYear[year]}</div>
                  <div style={{ fontSize: "14px", color: "#555", fontWeight: "bold", marginTop: "5px" }}>Jg. {year}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {activeTab === "add" && <PlayerForm formData={playerFormData} handleChange={(e) => handlePlayerChange(e, false)} onSubmit={handleAddPlayer} isSubmitting={isSubmitting} title="Neuen Spieler anlegen" buttonText="💾 Spieler anlegen" teamsList={sortedTeamsList} />}
      {activeTab === "edit" && editPlayerFormData && <PlayerForm formData={editPlayerFormData} handleChange={(e) => handlePlayerChange(e, true)} onSubmit={handleUpdatePlayer} isSubmitting={isSubmitting} title={`✏️ Bearbeiten: ${editPlayerFormData.firstName} ${editPlayerFormData.lastName}`} buttonText="💾 Änderungen speichern" onCancel={() => setActiveTab("active")} teamsList={sortedTeamsList} />}

      {activeTab === "active" && (
        <div style={{ background: "white", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", padding: "15px", color: "#333" }}>
          <p style={{ fontSize: "13px", color: "#666", marginBottom: "15px" }}>💡 Klicke auf den Namen eines Spielers, um das Team zuzuweisen oder Daten zu bearbeiten.</p>
          {activePlayers.length === 0 ? <p style={{ color: "#777", textAlign: "center", margin: "20px 0" }}>Keine aktiven Spieler gemeldet.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                <thead style={{ background: "#2146d0", color: "white" }}>
                  <tr>
                    <th style={{ padding: "12px", textAlign: "left" }}>Name, Vorname</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Jugend</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Jahrgang</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Passnummer</th>
                    <th style={{ padding: "12px", textAlign: "right" }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {activePlayers.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#f8f9fa" }}>
                      <td onClick={() => { setEditPlayerFormData({ ...initialPlayerState, ...p }); setActiveTab("edit"); }} style={{ padding: "12px", fontWeight: "bold", color: "#2980b9", cursor: "pointer", textDecoration: "underline" }}>{p.lastName}, {p.firstName} ✏️</td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#555", fontWeight: "bold" }}>{p.youthTeam || "-"}</td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#333" }}>{p.birthYear || "?"}</td>
                      <td style={{ padding: "12px", textAlign: "center", color: p.passNumber ? "#333" : "#aaa", fontWeight: "bold" }}>{p.passNumber || "-"}</td>
                      <td style={{ padding: "12px", textAlign: "right" }}><button onClick={() => handleDeregisterPlayer(p)} style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>Abmelden</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- TRAINER BEREICH --- */}
      {activeTab === "coaches" && (
        <div style={{ background: "white", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", padding: "15px", color: "#333" }}>
          
          {!showCoachForm && !editCoachFormData && (
            <button onClick={() => setShowCoachForm(true)} style={{ marginBottom: "20px", padding: "10px 15px", background: "#1abc9c", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
              ➕ Neuen Trainer anlegen
            </button>
          )}

          {showCoachForm && <CoachForm formData={coachFormData} handleChange={(e) => handleCoachChange(e, false)} onSubmit={handleAddCoach} isSubmitting={isSubmitting} title="Neuen Trainer anlegen" buttonText="💾 Trainer speichern" onCancel={() => setShowCoachForm(false)} teamsList={sortedTeamsList} />}
          {editCoachFormData && <CoachForm formData={editCoachFormData} handleChange={(e) => handleCoachChange(e, true)} onSubmit={handleUpdateCoach} isSubmitting={isSubmitting} title={`✏️ Bearbeiten: ${editCoachFormData.firstName} ${editCoachFormData.lastName}`} buttonText="💾 Änderungen speichern" onCancel={() => setEditCoachFormData(null)} teamsList={sortedTeamsList} />}

          {!showCoachForm && !editCoachFormData && (
            coaches.length === 0 ? <p style={{ color: "#777", textAlign: "center", margin: "20px 0" }}>Keine Trainer erfasst.</p> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                  <thead style={{ background: "#16a085", color: "white" }}>
                    <tr>
                      <th style={{ padding: "12px", textAlign: "left" }}>Trainer</th>
                      <th style={{ padding: "12px", textAlign: "left" }}>Zuständigkeit</th>
                      <th style={{ padding: "12px", textAlign: "left" }}>Kontakt / Schlüssel</th>
                      <th style={{ padding: "12px", textAlign: "right" }}>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coaches.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#f4fdfb" }}>
                        <td onClick={() => setEditCoachFormData(c)} style={{ padding: "12px", fontWeight: "bold", color: "#16a085", cursor: "pointer", textDecoration: "underline" }}>{c.lastName}, {c.firstName} ✏️</td>
                        <td style={{ padding: "12px", color: "#555", fontWeight: "bold" }}>{c.youthTeam}</td>
                        <td style={{ padding: "12px", fontSize: "13px", color: "#333" }}>
                          <div>📞 {c.phone || "-"}</div>
                          <div>✉️ {c.email || "-"}</div>
                          <div>🔑 {c.keyNumber || "-"}</div>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}><button onClick={() => handleDeleteCoach(c)} style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>Löschen</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {activeTab === "teams" && (
        <div style={{ background: "white", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", padding: "20px", color: "#333" }}>
          <h3 style={{ marginTop: 0, color: "#2146d0", borderBottom: "2px solid #eee", paddingBottom: "10px", marginBottom: "20px" }}>Jugend-Mannschaften & Jahrgänge</h3>
          
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px", background: "#f8f9fa", padding: "15px", borderRadius: "8px", border: "1px solid #ddd", alignItems: "center" }}>
            <input type="text" placeholder="Team-Name (z.B. E-Jugend)" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} style={{ flex: "1 1 130px", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", background: "#fff", color: "#333" }} />
            <input type="text" placeholder="Jahrgänge (z.B. 2016/2017)" value={newTeamYears} onChange={(e) => setNewTeamYears(e.target.value)} style={{ flex: "1 1 130px", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", background: "#fff", color: "#333" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "11px", fontWeight: "bold", color: "#555" }}>Anzahl gemeldet:</label>
              <input type="number" min="0" value={newTeamCount} onChange={(e) => setNewTeamCount(e.target.value)} style={{ width: "70px", padding: "9px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", background: "#fff", color: "#333", textAlign: "center" }} />
            </div>
            <button onClick={handleAddTeam} style={{ padding: "10px 15px", background: "#27ae60", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", marginLeft: "auto" }}>➕ Team hinzufügen</button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#34495e", color: "white" }}>
                <tr>
                  <th style={{ padding: "12px", textAlign: "left" }}>Mannschaft</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Erlaubte Jahrgänge</th>
                  <th style={{ padding: "12px", textAlign: "center" }}>Gemeldete Teams</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeamsList.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "12px", fontWeight: "bold", color: "#333" }}>{t.name}</td>
                    <td style={{ padding: "12px", color: "#555" }}>{t.years}</td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <input 
                        type="number" 
                        min="0"
                        value={t.count !== undefined ? t.count : 1} 
                        onChange={(e) => handleUpdateTeamCount(t.id, e.target.value)}
                        style={{ width: "60px", padding: "6px", textAlign: "center", borderRadius: "6px", border: "1px solid #ccc", fontWeight: "bold", background: "#fff", color: "#333" }}
                      />
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}><button onClick={() => handleDeleteTeam(t.id)} style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" }}>Löschen</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div style={{ background: "white", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", padding: "15px", color: "#333" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0, color: "#7f8c8d" }}>Abgemeldete Spieler</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: "bold", color: "#555" }}>Sortieren nach:</label>
              <select value={historySortBy} onChange={(e) => setHistorySortBy(e.target.value)} style={{ padding: "6px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", background: "#fff", color: "#333" }}>
                <option value="name">Alphabetisch (Name)</option>
                <option value="date">Abmeldedatum (Neu nach Alt)</option>
              </select>
            </div>
          </div>

          {sortedHistoryPlayers.length === 0 ? <p style={{ color: "#777", textAlign: "center", margin: "20px 0" }}>Bisher keine abgemeldeten Spieler.</p> : (
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
                  {sortedHistoryPlayers.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#f8f9fa" }}>
                      <td style={{ padding: "12px", fontWeight: "bold", color: "#7f8c8d" }}>{p.lastName}, {p.firstName}</td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#7f8c8d" }}>{p.deregisteredAt ? new Date(p.deregisteredAt).toLocaleDateString("de-DE") : "Unbekannt"}</td>
                      <td style={{ padding: "12px", textAlign: "right" }}><button onClick={() => handleReactivatePlayer(p)} style={{ background: "#27ae60", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>Wieder anmelden</button></td>
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