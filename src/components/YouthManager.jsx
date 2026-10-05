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
      style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "14px", width: "100%", boxSizing: "border-box" }}
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
  <form onSubmit={onSubmit} style={{ background: "#eef2ff", padding: "15px", borderRadius: "10px", border: "1px solid #c7d2fe", color: "#333" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #c7d2fe", paddingBottom: "10px", marginBottom: "15px" }}>
      <h3 style={{ margin: 0, fontSize: "16px", color: "#3730a3" }}>{title}</h3>
      {onCancel && (
        <button type="button" onClick={onCancel} style={{ background: "#95a5a6", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold" }}>
          ✕ Abbrechen
        </button>
      )}
    </div>
    
    <h4 style={{ color: "#4f46e5", marginBottom: "8px", fontSize: "13px" }}>👤 Spielerdaten</h4>
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "15px" }}>
      <InputField label="Vorname *" name="firstName" value={formData.firstName} onChange={handleChange} required={true} />
      <InputField label="Nachname *" name="lastName" value={formData.lastName} onChange={handleChange} required={true} />
      <InputField label="Geburtsdatum" name="birthDate" value={formData.birthDate} onChange={handleChange} type="date" />
      <InputField label="Alter" name="age" value={formData.age} onChange={handleChange} type="number" placeholder="auto" />
      <InputField label="Jahrgang" name="birthYear" value={formData.birthYear} onChange={handleChange} type="number" placeholder="z.B. 2010" />
    </div>

    <h4 style={{ color: "#4f46e5", marginBottom: "8px", fontSize: "13px" }}>⚽ Vereinsdaten</h4>
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px", alignItems: "flex-end" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 200px" }}>
        <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Jugendmannschaft (Zuweisung)</label>
        <select
          name="youthTeam"
          value={formData.youthTeam}
          onChange={handleChange}
          style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "14px", width: "100%", boxSizing: "border-box" }}
        >
          <option value="">-- Ohne Team --</option>
          {teamsList.map(team => (
            <option key={team.id} value={team.name}>{team.name} (Jg. {team.years})</option>
          ))}
        </select>
      </div>
      <InputField label="Passnummer" name="passNumber" value={formData.passNumber} onChange={handleChange} />
    </div>
    <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "15px", background: "rgba(255,255,255,0.5)", padding: "10px", borderRadius: "8px" }}>
      <CheckboxField label="Angemeldet bei SVON" name="registeredSVON" checked={formData.registeredSVON} onChange={handleChange} />
      <CheckboxField label="Angemeldet beim DFB" name="registeredDFB" checked={formData.registeredDFB} onChange={handleChange} />
      <CheckboxField label="Bilder-Veröffentlichung erlaubt" name="photoConsent" checked={formData.photoConsent} onChange={handleChange} />
    </div>

    <h4 style={{ color: "#4f46e5", marginBottom: "8px", fontSize: "13px" }}>🏠 Anschrift & Kontakt</h4>
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
      <InputField label="Straße / Anschrift" name="address" value={formData.address} onChange={handleChange} />
      <InputField label="PLZ" name="postalCode" value={formData.postalCode} onChange={handleChange} placeholder="z.B. 78333" />
      <InputField label="Wohnort" name="city" value={formData.city} onChange={handleChange} />
    </div>
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "15px" }}>
      <InputField label="Name Papa" name="fatherName" value={formData.fatherName} onChange={handleChange} />
      <InputField label="Telefonnummer Papa" name="fatherPhone" value={formData.fatherPhone} onChange={handleChange} type="tel" />
      <InputField label="Name Mama" name="motherName" value={formData.motherName} onChange={handleChange} />
      <InputField label="Telefonnummer Mama" name="motherPhone" value={formData.motherPhone} onChange={handleChange} type="tel" />
    </div>

    <h4 style={{ color: "#4f46e5", marginBottom: "8px", fontSize: "13px" }}>⚠️ Wichtige Hinweise / Einschränkungen</h4>
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "20px" }}>
      <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Kommentar (z.B. Allergien, Medikamente, Sonstiges)</label>
      <textarea
        name="medicalComment"
        value={formData.medicalComment || ""}
        onChange={handleChange}
        placeholder="Hier Allergien oder gesundheitliche Einschränkungen eintragen..."
        rows="3"
        style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "14px", width: "100%", boxSizing: "border-box", fontFamily: "sans-serif" }}
      />
    </div>

    <button type="submit" disabled={isSubmitting} style={{ width: "100%", padding: "14px", background: "#2146d0", color: "white", border: "none", borderRadius: "8px", cursor: isSubmitting ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "16px" }}>
      {isSubmitting ? "Wird gespeichert..." : buttonText}
    </button>
  </form>
);

// --- TRAINER FORMULAR ---
const CoachForm = ({ formData, handleChange, onSubmit, isSubmitting, title, buttonText, onCancel, teamsList }) => (
  <form onSubmit={onSubmit} style={{ background: "#e8f8f5", padding: "15px", borderRadius: "10px", border: "1px solid #a3e4d7", marginBottom: "20px", color: "#333" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #a3e4d7", paddingBottom: "10px", marginBottom: "15px" }}>
      <h3 style={{ margin: 0, fontSize: "16px", color: "#117a65" }}>{title}</h3>
      {onCancel && (
        <button type="button" onClick={onCancel} style={{ background: "#95a5a6", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold" }}>
          ✕ Abbrechen
        </button>
      )}
    </div>
    
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "15px" }}>
      <InputField label="Vorname *" name="firstName" value={formData.firstName} onChange={handleChange} required={true} />
      <InputField label="Nachname *" name="lastName" value={formData.lastName} onChange={handleChange} required={true} />
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 200px" }}>
        <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Zuständig für Jugend *</label>
        <select name="youthTeam" value={formData.youthTeam} onChange={handleChange} required style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "14px", width: "100%", boxSizing: "border-box" }}>
          <option value="">-- Bitte wählen --</option>
          <option value="Jugendleitung">Jugendleitung (Übergreifend)</option>
          {teamsList.map(team => (
            <option key={team.id} value={team.name}>{team.name}</option>
          ))}
        </select>
      </div>
    </div>
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "15px" }}>
      <InputField label="Handynummer" name="phone" value={formData.phone} onChange={handleChange} type="tel" />
      <InputField label="E-Mail Adresse" name="email" value={formData.email} onChange={handleChange} type="email" />
      <InputField label="Schlüssel-Nr." name="keyNumber" value={formData.keyNumber} onChange={handleChange} />
    </div>

    <button type="submit" disabled={isSubmitting} style={{ width: "100%", padding: "14px", background: "#1abc9c", color: "white", border: "none", borderRadius: "8px", cursor: isSubmitting ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "16px" }}>
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
  
  // Sortierung & Aufklappen Historie
  const [historySortBy, setHistorySortBy] = useState("name");
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  // States für Abmelde-Modal
  const [playerToDeregister, setPlayerToDeregister] = useState(null);
  const [deregisterData, setDeregisterData] = useState({
    date: new Date().toISOString().split("T")[0],
    method: "E-Mail",
    confirmedDate: "",
    reportedToSVON: false,
    svonReportDate: new Date().toISOString().split("T")[0]
  });

  // States Teamverwaltung
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamYears, setNewTeamYears] = useState("");
  const [newTeamCount, setNewTeamCount] = useState(1);

  // States Spieler
  const initialPlayerState = { youthTeam: "", firstName: "", lastName: "", birthDate: "", age: "", birthYear: "", registeredSVON: false, registeredDFB: false, passNumber: "", photoConsent: false, address: "", postalCode: "", city: "", fatherName: "", fatherPhone: "", motherName: "", motherPhone: "", medicalComment: "" };
  const [playerFormData, setPlayerFormData] = useState(initialPlayerState);
  const [editPlayerFormData, setEditPlayerFormData] = useState(null);

  // States Trainer
  const initialCoachState = { firstName: "", lastName: "", youthTeam: "", phone: "", email: "", keyNumber: "" };
  const [coachFormData, setCoachFormData] = useState(initialCoachState);
  const [editCoachFormData, setEditCoachFormData] = useState(null);
  const [showCoachForm, setShowCoachForm] = useState(false);

  // NEU: States für Massenbearbeitung (Zuweisung)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [bulkTeam, setBulkTeam] = useState("none");
  const [isBulking, setIsBulking] = useState(false);

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
      loadedTeams.sort((a, b) => a.name.localeCompare(b.name));
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

  // Historie Sortierung
  const sortedHistoryPlayers = [...inactivePlayers].sort((a, b) => {
    if (historySortBy === "name") {
      return (a.lastName || "").localeCompare(b.lastName || "");
    } else {
      const dateA = a.deregistrationDetails?.date ? new Date(a.deregistrationDetails.date).getTime() : 0;
      const dateB = b.deregistrationDetails?.date ? new Date(b.deregistrationDetails.date).getTime() : 0;
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

  // --- CSV EXPORT (AKTIVE ODER HISTORIE) ---
  const exportCSV = (type) => {
    let dataList = type === "active" ? activePlayers : inactivePlayers;
    if (dataList.length === 0) {
      alert(type === "active" ? "Keine aktiven Spieler vorhanden." : "Keine abgemeldeten Spieler in der Historie.");
      return;
    }

    let headers = [];
    let rows = [];

    if (type === "active") {
      headers = ["Nachname", "Vorname", "Jugend", "Geburtsdatum", "Alter", "Jahrgang", "Passnummer", "SVON", "DFB", "Bilderrechte", "Strasse", "PLZ", "Wohnort", "Vater", "Tel. Vater", "Mutter", "Tel. Mutter", "Medizinische Hinweise / Allergien"];
      rows = activePlayers.map(p => [
        `"${p.lastName || ""}"`, `"${p.firstName || ""}"`, `"${p.youthTeam || ""}"`, `"${p.birthDate || ""}"`, `"${p.age || ""}"`, `"${p.birthYear || ""}"`, `"${p.passNumber || ""}"`,
        `"${p.registeredSVON ? "Ja" : "Nein"}"`, `"${p.registeredDFB ? "Ja" : "Nein"}"`, `"${p.photoConsent ? "Ja" : "Nein"}"`,
        `"${p.address || ""}"`, `"${p.postalCode || ""}"`, `"${p.city || ""}"`, `"${p.fatherName || ""}"`, `"${p.fatherPhone || ""}"`, `"${p.motherName || ""}"`, `"${p.motherPhone || ""}"`, `"${(p.medicalComment || "").replace(/\n/g, " ")}"`
      ]);
    } else {
      headers = ["Nachname", "Vorname", "Abmeldedatum", "Art der Abmeldung", "Bestätigt auf", "An SVON gemeldet", "Meldungsdatum SVON"];
      rows = inactivePlayers.map(p => {
        const d = p.deregistrationDetails || {};
        return [
          `"${p.lastName || ""}"`, `"${p.firstName || ""}"`, `"${d.date || ""}"`, `"${d.method || ""}"`, `"${d.confirmedDate || ""}"`, `"${d.reportedToSVON ? "Ja" : "Nein"}"`, `"${d.svonReportDate || ""}"`
        ];
      });
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${type === "active" ? "Jugendspieler_aktiv" : "Jugendspieler_Historie"}_${clubId?.toUpperCase()}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- TEILEN FUNKTION ---
  const shareDeregistration = (p, details) => {
    const subject = encodeURIComponent(`Abmeldung Jugendspieler: ${p.lastName}, ${p.firstName}`);
    const body = encodeURIComponent(
      `Hallo Vorstand / Jugendleitung,\n\nhiermit wird folgende Abmeldung dokumentiert:\n\n` +
      `Spieler: ${p.firstName} ${p.lastName}\n` +
      `Mannschaft: ${p.youthTeam || "Keine Zuweisung"}\n` +
      `Abmeldung erfolgt am: ${details.date || "-"}\n` +
      `Art der Abmeldung: ${details.method || "-"}\n` +
      `Bestätigt auf: ${details.confirmedDate || "-"}\n` +
      `An SVON gemeldet: ${details.reportedToSVON ? `Ja (am ${details.svonReportDate || "-"})` : "Nein"}\n\n` +
      `Mit sportlichen Grüßen\nJugendleitung SVON`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // --- NEU: HANDLER MASSENBEARBEITUNG ---
  const togglePlayerSelection = (id) => {
    setSelectedPlayerIds(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedPlayerIds.length === activePlayers.length && activePlayers.length > 0) {
      setSelectedPlayerIds([]); // Alle abwählen
    } else {
      setSelectedPlayerIds(activePlayers.map(p => p.id)); // Alle auswählen
    }
  };

  const handleBulkUpdateTeam = async () => {
    if (bulkTeam === "none") return;
    setIsBulking(true);
    try {
      // Wir iterieren über alle ausgewählten IDs und aktualisieren sie parallel
      await Promise.all(
        selectedPlayerIds.map(id =>
          updateDoc(doc(db, "youth_players", id), { youthTeam: bulkTeam })
        )
      );
      alert(`${selectedPlayerIds.length} Spieler erfolgreich verschoben!`);
      setSelectedPlayerIds([]); // Selektion leeren
      setBulkTeam("none"); // Dropdown zurücksetzen
    } catch (error) {
      console.error(error);
      alert("Fehler beim Verschieben der Spieler!");
    } finally {
      setIsBulking(false);
    }
  };

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

  const confirmDeregistration = async (e) => {
    e.preventDefault();
    if (!playerToDeregister) return;

    try {
      const playerRef = doc(db, "youth_players", playerToDeregister.id);
      await updateDoc(playerRef, {
        status: "abgemeldet",
        deregistrationDetails: {
          date: deregisterData.date,
          method: deregisterData.method,
          confirmedDate: deregisterData.confirmedDate || "Nicht angegeben",
          reportedToSVON: deregisterData.reportedToSVON,
          svonReportDate: deregisterData.reportedToSVON ? (deregisterData.svonReportDate || "Nicht angegeben") : "Nicht gemeldet"
        }
      });
      setPlayerToDeregister(null);
      alert("Spieler erfolgreich abgemeldet und dokumentiert!");
    } catch (error) {
      console.error("Fehler beim Abmelden:", error);
      alert("Fehler beim Speichern der Abmeldung.");
    }
  };

  const handleReactivatePlayer = async (player) => {
    if (!window.confirm(`${player.firstName} wieder AKTIV setzen?`)) return;
    await updateDoc(doc(db, "youth_players", player.id), { status: "aktiv", deregistrationDetails: null });
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
    <button onClick={() => setActiveTab(id)} style={{ padding: "10px 12px", border: "none", borderRadius: "8px", background: activeTab === id ? "#2146d0" : "#e0e7ff", color: activeTab === id ? "white" : "#3730a3", fontWeight: "bold", cursor: "pointer", fontSize: "13px", textAlign: "center", flex: "1 1 calc(33% - 10px)", minWidth: "100px", transition: "background 0.2s" }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: "10px", maxWidth: "900px", margin: "0 auto", fontFamily: "sans-serif", color: "#333", boxSizing: "border-box" }}>
      <h2 style={{ color: "#2146d0", marginBottom: "15px", textAlign: "center", fontSize: "20px" }}>👦 Jugendabteilung ({clubId?.toUpperCase()})</h2>

      {/* MOBIL OPTIMIERTES MENÜ */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "15px" }}>
        <TabButton id="dashboard" label="📊 Dashboard" />
        <TabButton id="add" label="➕ Neuer Spieler" />
        <TabButton id="active" label={`👦 Aktive (${activePlayers.length})`} />
        <TabButton id="coaches" label={`🧑‍🏫 Trainer (${coaches.length})`} />
        <TabButton id="teams" label="⚙️ Teams" />
        <TabButton id="history" label={`🕰️ Historie (${inactivePlayers.length})`} />
      </div>

      {/* EXPORT BUTTONS BEREICH */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button 
          onClick={() => exportCSV("active")}
          style={{ flex: 1, minWidth: "160px", padding: "10px", background: "#27ae60", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
        >
          📥 Aktive Spieler (CSV)
        </button>
        <button 
          onClick={() => exportCSV("history")}
          style={{ flex: 1, minWidth: "160px", padding: "10px", background: "#7f8c8d", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
        >
          📥 Historie (CSV)
        </button>
      </div>

      {activeTab === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          
          <div style={{ background: "#2146d0", padding: "15px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", color: "white", textAlign: "center" }}>
            <h3 style={{ marginTop: 0, borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: "8px", fontSize: "15px" }}>🏆 Gemeldete Teams im Spielbetrieb ({totalRegisteredTeams} gesamt)</h3>
            
            {/* Sofortige Auflistung, welche Mannschaften in welcher Anzahl gemeldet sind */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", marginTop: "12px" }}>
              {teamSettings.map(t => (
                <div key={t.id} style={{ background: "rgba(255,255,255,0.15)", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", fontWeight: "bold" }}>
                  {t.name}: <span style={{ color: "#f1c40f", fontSize: "15px" }}>{t.count || 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", color: "#333" }}>
            <h3 style={{ marginTop: 0, color: "#27ae60", borderBottom: "2px solid #eee", paddingBottom: "8px", fontSize: "15px" }}>Übersicht: Spieler pro Mannschaft</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px", marginTop: "15px" }}>
              {dashboardSortedTeams.length === 0 ? <p style={{ color: "#777" }}>Keine Zuweisungen vorhanden.</p> : dashboardSortedTeams.map(team => (
                <div key={team} style={{ background: "#e8f8f5", border: "1px solid #a3e4d7", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "22px", fontWeight: "bold", color: "#16a085" }}>{playersPerTeam[team]}</div>
                  <div style={{ fontSize: "13px", color: "#555", fontWeight: "bold", marginTop: "4px" }}>{team}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", color: "#333" }}>
            <h3 style={{ marginTop: 0, color: "#2146d0", borderBottom: "2px solid #eee", paddingBottom: "8px", fontSize: "15px" }}>Übersicht: Spieler pro Jahrgang</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "10px", marginTop: "15px" }}>
              {sortedYears.length === 0 ? <p style={{ color: "#777" }}>Keine Daten vorhanden.</p> : sortedYears.map(year => (
                <div key={year} style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "22px", fontWeight: "bold", color: "#3730a3" }}>{playersPerYear[year]}</div>
                  <div style={{ fontSize: "13px", color: "#555", fontWeight: "bold", marginTop: "4px" }}>Jg. {year}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {activeTab === "add" && <PlayerForm formData={playerFormData} handleChange={(e) => handlePlayerChange(e, false)} onSubmit={handleAddPlayer} isSubmitting={isSubmitting} title="Neuen Spieler anlegen" buttonText="💾 Spieler anlegen" teamsList={sortedTeamsList} />}
      {activeTab === "edit" && editPlayerFormData && <PlayerForm formData={editPlayerFormData} handleChange={(e) => handlePlayerChange(e, true)} onSubmit={handleUpdatePlayer} isSubmitting={isSubmitting} title={`✏️ Bearbeiten: ${editPlayerFormData.firstName} ${editPlayerFormData.lastName}`} buttonText="💾 Änderungen speichern" onCancel={() => setActiveTab("active")} teamsList={sortedTeamsList} />}

      {activeTab === "active" && (
        <div style={{ background: "white", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", padding: "10px", color: "#333" }}>
          
          {/* NEU: MASSENBEARBEITUNGS-TOOLBAR */}
          {selectedPlayerIds.length > 0 && (
            <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: "8px", padding: "12px", marginBottom: "15px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: "bold", color: "#3730a3", fontSize: "14px", flexGrow: 1 }}>
                ✅ {selectedPlayerIds.length} Spieler ausgewählt
              </span>
              <select
                value={bulkTeam}
                onChange={(e) => setBulkTeam(e.target.value)}
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "13px", minWidth: "200px" }}
              >
                <option value="none">-- Neue Mannschaft wählen --</option>
                <option value="">-- Ohne Team --</option>
                {sortedTeamsList.map(team => (
                  <option key={team.id} value={team.name}>{team.name}</option>
                ))}
              </select>
              <button
                onClick={handleBulkUpdateTeam}
                disabled={isBulking || bulkTeam === "none"}
                style={{ padding: "8px 15px", background: bulkTeam === "none" ? "#ccc" : "#2146d0", color: "white", border: "none", borderRadius: "6px", cursor: bulkTeam === "none" ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "13px" }}
              >
                {isBulking ? "Wird zugewiesen..." : "Ausgewählte zuweisen"}
              </button>
            </div>
          )}

          <p style={{ fontSize: "12px", color: "#666", marginBottom: "12px" }}>💡 Klicke auf den Namen eines Spielers zum Bearbeiten, oder nutze die Checkboxen für die Massenzuweisung.</p>
          {activePlayers.length === 0 ? <p style={{ color: "#777", textAlign: "center", margin: "20px 0" }}>Keine aktiven Spieler gemeldet.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                <thead style={{ background: "#2146d0", color: "white" }}>
                  <tr>
                    {/* NEU: SELECT ALL CHECKBOX */}
                    <th style={{ padding: "10px", width: "40px", textAlign: "center" }}>
                      <input 
                        type="checkbox" 
                        checked={activePlayers.length > 0 && selectedPlayerIds.length === activePlayers.length} 
                        onChange={toggleSelectAll} 
                        style={{ width: "16px", height: "16px", cursor: "pointer" }} 
                      />
                    </th>
                    <th style={{ padding: "10px", textAlign: "left", fontSize: "13px" }}>Name, Vorname</th>
                    <th style={{ padding: "10px", textAlign: "center", fontSize: "13px" }}>Jugend</th>
                    <th style={{ padding: "10px", textAlign: "center", fontSize: "13px" }}>Jg.</th>
                    <th style={{ padding: "10px", textAlign: "center", fontSize: "13px" }}>Pass-Nr.</th>
                    <th style={{ padding: "10px", textAlign: "right", fontSize: "13px" }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {activePlayers.map((p, i) => {
                    const isSelected = selectedPlayerIds.includes(p.id);
                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid #eee", background: isSelected ? "#dbeafe" : (i % 2 === 0 ? "white" : "#f8f9fa") }}>
                        {/* NEU: CHECKBOX PRO REIHE */}
                        <td style={{ padding: "10px", textAlign: "center" }}>
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={() => togglePlayerSelection(p.id)} 
                            style={{ width: "16px", height: "16px", cursor: "pointer" }} 
                          />
                        </td>
                        <td onClick={() => { setEditPlayerFormData({ ...initialPlayerState, ...p }); setActiveTab("edit"); }} style={{ padding: "10px", fontWeight: "bold", color: "#2980b9", cursor: "pointer", textDecoration: "underline", fontSize: "13px" }}>{p.lastName}, {p.firstName} ✏️</td>
                        <td style={{ padding: "10px", textAlign: "center", color: "#555", fontWeight: "bold", fontSize: "13px" }}>{p.youthTeam || "-"}</td>
                        <td style={{ padding: "10px", textAlign: "center", color: "#333", fontSize: "13px" }}>{p.birthYear || "?"}</td>
                        <td style={{ padding: "10px", textAlign: "center", color: p.passNumber ? "#333" : "#aaa", fontWeight: "bold", fontSize: "13px" }}>{p.passNumber || "-"}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}><button onClick={() => setPlayerToDeregister(p)} style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>Abmelden</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- TRAINER BEREICH --- */}
      {activeTab === "coaches" && (
        <div style={{ background: "white", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", padding: "10px", color: "#333" }}>
          
          {!showCoachForm && !editCoachFormData && (
            <button onClick={() => setShowCoachForm(true)} style={{ marginBottom: "15px", padding: "10px 15px", background: "#1abc9c", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
              ➕ Neuen Trainer anlegen
            </button>
          )}

          {showCoachForm && <CoachForm formData={coachFormData} handleChange={(e) => handleCoachChange(e, false)} onSubmit={handleAddCoach} isSubmitting={isSubmitting} title="Neuen Trainer anlegen" buttonText="💾 Trainer speichern" onCancel={() => setShowCoachForm(false)} teamsList={sortedTeamsList} />}
          {editCoachFormData && <CoachForm formData={editCoachFormData} handleChange={(e) => handleCoachChange(e, true)} onSubmit={handleUpdateCoach} isSubmitting={isSubmitting} title={`✏️ Bearbeiten: ${editCoachFormData.firstName} ${editCoachFormData.lastName}`} buttonText="💾 Änderungen speichern" onCancel={() => setEditCoachFormData(null)} teamsList={sortedTeamsList} />}

          {!showCoachForm && !editCoachFormData && (
            coaches.length === 0 ? <p style={{ color: "#777", textAlign: "center", margin: "20px 0" }}>Keine Trainer erfasst.</p> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "650px" }}>
                  <thead style={{ background: "#16a085", color: "white" }}>
                    <tr>
                      <th style={{ padding: "10px", textAlign: "left", fontSize: "13px" }}>Trainer</th>
                      <th style={{ padding: "10px", textAlign: "left", fontSize: "13px" }}>Zuständig</th>
                      <th style={{ padding: "10px", textAlign: "left", fontSize: "13px" }}>Kontakt / Schlüssel</th>
                      <th style={{ padding: "10px", textAlign: "right", fontSize: "13px" }}>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coaches.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#f4fdfb" }}>
                        <td onClick={() => setEditCoachFormData(c)} style={{ padding: "10px", fontWeight: "bold", color: "#16a085", cursor: "pointer", textDecoration: "underline", fontSize: "13px" }}>{c.lastName}, {c.firstName} ✏️</td>
                        <td style={{ padding: "10px", color: "#555", fontWeight: "bold", fontSize: "13px" }}>{c.youthTeam}</td>
                        <td style={{ padding: "10px", fontSize: "12px", color: "#333" }}>
                          <div>📞 {c.phone || "-"}</div>
                          <div>✉️ {c.email || "-"}</div>
                          <div>🔑 {c.keyNumber || "-"}</div>
                        </td>
                        <td style={{ padding: "10px", textAlign: "right" }}><button onClick={() => handleDeleteCoach(c)} style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>Löschen</button></td>
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
        <div style={{ background: "white", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", padding: "15px", color: "#333" }}>
          <h3 style={{ marginTop: 0, color: "#2146d0", borderBottom: "2px solid #eee", paddingBottom: "8px", marginBottom: "15px", fontSize: "16px" }}>Jugend-Mannschaften & Jahrgänge</h3>
          
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "15px", background: "#f8f9fa", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", alignItems: "center" }}>
            <input type="text" placeholder="Team-Name (z.B. E-Jugend)" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} style={{ flex: "1 1 120px", padding: "9px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", background: "#fff", color: "#333" }} />
            <input type="text" placeholder="Jahrgänge (z.B. 2016/2017)" value={newTeamYears} onChange={(e) => setNewTeamYears(e.target.value)} style={{ flex: "1 1 120px", padding: "9px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", background: "#fff", color: "#333" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <label style={{ fontSize: "10px", fontWeight: "bold", color: "#555" }}>Anzahl:</label>
              <input type="number" min="0" value={newTeamCount} onChange={(e) => setNewTeamCount(e.target.value)} style={{ width: "60px", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", background: "#fff", color: "#333", textAlign: "center" }} />
            </div>
            <button onClick={handleAddTeam} style={{ width: "100%", padding: "10px", background: "#27ae60", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" }}>➕ Team hinzufügen</button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#34495e", color: "white" }}>
                <tr>
                  <th style={{ padding: "10px", textAlign: "left", fontSize: "13px" }}>Mannschaft</th>
                  <th style={{ padding: "10px", textAlign: "left", fontSize: "13px" }}>Jahrgänge</th>
                  <th style={{ padding: "10px", textAlign: "center", fontSize: "13px" }}>Gemeldet</th>
                  <th style={{ padding: "10px", textAlign: "right", fontSize: "13px" }}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeamsList.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px", fontWeight: "bold", color: "#333", fontSize: "13px" }}>{t.name}</td>
                    <td style={{ padding: "10px", color: "#555", fontSize: "13px" }}>{t.years}</td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      <input 
                        type="number" 
                        min="0"
                        value={t.count !== undefined ? t.count : 1} 
                        onChange={(e) => handleUpdateTeamCount(t.id, e.target.value)}
                        style={{ width: "50px", padding: "5px", textAlign: "center", borderRadius: "6px", border: "1px solid #ccc", fontWeight: "bold", background: "#fff", color: "#333", fontSize: "13px" }}
                      />
                    </td>
                    <td style={{ padding: "10px", textAlign: "right" }}><button onClick={() => handleDeleteTeam(t.id)} style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "6px", padding: "5px 8px", cursor: "pointer", fontSize: "12px" }}>Löschen</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div style={{ background: "white", borderRadius: "10px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", padding: "10px", color: "#333" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
            <h3 style={{ margin: 0, color: "#7f8c8d", fontSize: "15px" }}>Abgemeldete Spieler</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Sortieren:</label>
              <select value={historySortBy} onChange={(e) => setHistorySortBy(e.target.value)} style={{ padding: "5px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "12px", background: "#fff", color: "#333" }}>
                <option value="name">Alphabetisch</option>
                <option value="date">Datum (Neu-Alt)</option>
              </select>
            </div>
          </div>

          {sortedHistoryPlayers.length === 0 ? <p style={{ color: "#777", textAlign: "center", margin: "20px 0" }}>Bisher keine abgemeldeten Spieler.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "650px" }}>
                <thead style={{ background: "#95a5a6", color: "white" }}>
                  <tr>
                    <th style={{ padding: "10px", textAlign: "left", fontSize: "13px" }}>Name, Vorname</th>
                    <th style={{ padding: "10px", textAlign: "center", fontSize: "13px" }}>Abgemeldet am</th>
                    <th style={{ padding: "10px", textAlign: "right", fontSize: "13px" }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHistoryPlayers.map((p, i) => {
                    const isExpanded = expandedHistoryId === p.id;
                    const details = p.deregistrationDetails || {};

                    return (
                      <>
                        <tr key={p.id} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#f8f9fa" }}>
                          <td style={{ padding: "10px", fontWeight: "bold", color: "#7f8c8d", fontSize: "13px" }}>{p.lastName}, {p.firstName}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: "#7f8c8d", fontSize: "13px" }}>{details.date ? new Date(details.date).toLocaleDateString("de-DE") : "Unbekannt"}</td>
                          <td style={{ padding: "10px", textAlign: "right", display: "flex", gap: "4px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <button 
                              onClick={() => setExpandedHistoryId(isExpanded ? null : p.id)} 
                              style={{ background: "#34495e", color: "white", border: "none", borderRadius: "6px", padding: "5px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}
                            >
                              {isExpanded ? "▲ Details" : "▼ Details"}
                            </button>
                            <button onClick={() => shareDeregistration(p, details)} style={{ background: "#2980b9", color: "white", border: "none", borderRadius: "6px", padding: "5px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }} title="Teilen">
                              📤 Teilen
                            </button>
                            <button onClick={() => handleReactivatePlayer(p)} style={{ background: "#27ae60", color: "white", border: "none", borderRadius: "6px", padding: "5px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>Aktiv</button>
                          </td>
                        </tr>

                        {/* AUFGEKLAPPTE DETAILS */}
                        {isExpanded && (
                          <tr key={`${p.id}-details`} style={{ background: "#f1f2f6" }}>
                            <td colSpan="3" style={{ padding: "12px", fontSize: "12px", color: "#333", borderBottom: "2px solid #ddd" }}>
                              <div style={{ fontWeight: "bold", marginBottom: "6px", color: "#2c3e50" }}>📋 Abmeldedokumentation für {p.firstName} {p.lastName}:</div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "4px" }}>
                                <div>📅 <strong>Erfolgt am:</strong> {details.date ? new Date(details.date).toLocaleDateString("de-DE") : "-"}</div>
                                <div>📞 <strong>Art:</strong> {details.method || "-"}</div>
                                <div>⏱ <strong>Bestätigt auf:</strong> {details.confirmedDate ? new Date(details.confirmedDate).toLocaleDateString("de-DE") : "-"}</div>
                                <div>🏛️ <strong>An SVON gemeldet:</strong> {details.reportedToSVON ? `✅ Ja (am ${details.svonReportDate ? new Date(details.svonReportDate).toLocaleDateString("de-DE") : "-"})` : "❌ Nein"}</div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL FÜR ABMELDUNG --- */}
      {playerToDeregister && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "10px", boxSizing: "border-box" }}>
          <form onSubmit={confirmDeregistration} style={{ background: "white", padding: "20px", borderRadius: "10px", width: "100%", maxWidth: "450px", boxShadow: "0 4px 10px rgba(0,0,0,0.2)", color: "#333", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ marginTop: 0, color: "#c0392b", borderBottom: "2px solid #eee", paddingBottom: "8px", fontSize: "16px" }}>
              ⚠️ Abmeldung: {playerToDeregister.firstName} {playerToDeregister.lastName}
            </h3>
            
            <p style={{ fontSize: "12px", color: "#666", marginBottom: "12px" }}>
              Bitte dokumentiere die Details zur Abmeldung für die Vereinsakten:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Abmeldung erfolgt wann:</label>
                <input 
                  type="date" 
                  value={deregisterData.date} 
                  onChange={(e) => setDeregisterData({ ...deregisterData, date: e.target.value })} 
                  required 
                  style={{ padding: "9px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333" }} 
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Art der Abmeldung:</label>
                <select 
                  value={deregisterData.method} 
                  onChange={(e) => setDeregisterData({ ...deregisterData, method: e.target.value })} 
                  style={{ padding: "9px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333" }}
                >
                  <option value="E-Mail">E-Mail</option>
                  <option value="Textnachricht">Textnachricht (WhatsApp/SMS)</option>
                  <option value="Telefon">Telefon</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Abmeldung bestätigt auf (Datum):</label>
                <input 
                  type="date" 
                  value={deregisterData.confirmedDate} 
                  onChange={(e) => setDeregisterData({ ...deregisterData, confirmedDate: e.target.value })} 
                  style={{ padding: "9px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333" }} 
                />
              </div>

              <div style={{ background: "#f8f9fa", padding: "10px", borderRadius: "6px", border: "1px solid #ddd" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={deregisterData.reportedToSVON} 
                    onChange={(e) => setDeregisterData({ ...deregisterData, reportedToSVON: e.target.checked })} 
                    style={{ width: "16px", height: "16px" }} 
                  />
                  An SVON gemeldet
                </label>

                {deregisterData.reportedToSVON && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}>Meldungsdatum an SVON:</label>
                    <input 
                      type="date" 
                      value={deregisterData.svonReportDate} 
                      onChange={(e) => setDeregisterData({ ...deregisterData, svonReportDate: e.target.value })} 
                      style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333" }} 
                    />
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" style={{ flex: 1, padding: "11px", background: "#e74c3c", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>
                💾 Speichern
              </button>
              <button type="button" onClick={() => setPlayerToDeregister(null)} style={{ padding: "11px", background: "#95a5a6", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}