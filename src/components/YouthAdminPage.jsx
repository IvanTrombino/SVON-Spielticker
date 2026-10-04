import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase"; 
import YouthManager from "./YouthManager"; 

export default function YouthAdminPage({ clubId }) {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Prüfen, ob der Nutzer schon eingeloggt ist
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe(); // Cleanup
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      setError("Zugangsdaten falsch. Bitte überprüfe E-Mail und Passwort.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: "50px", color: "#333" }}>Lade...</div>;
  }

  // WENN NICHT EINGELOGGT: Zeige das Login-Formular
  if (!user) {
    return (
      <div style={{ padding: "20px", maxWidth: "400px", margin: "50px auto", fontFamily: "sans-serif", color: "#333" }}>
        <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "10px", border: "1px solid #ccc", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
          <h2 style={{ textAlign: "center", color: "#2146d0", marginBottom: "20px" }}>🔒 Geschützter Bereich</h2>
          <p style={{ fontSize: "14px", color: "#555", textAlign: "center", marginBottom: "20px" }}>
            Bitte logge dich ein, um die Jugend-Datenbank zu verwalten.
          </p>
          
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <input
              type="email"
              placeholder="E-Mail / Benutzername"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ padding: "12px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "15px" }}
            />
            <input
              type="password"
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ padding: "12px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: "15px" }}
            />
            
            {error && <p style={{ color: "#e74c3c", fontSize: "13px", margin: 0, fontWeight: "bold" }}>{error}</p>}
            
            <button 
              type="submit" 
              style={{ padding: "12px", background: "#2146d0", color: "white", border: "none", borderRadius: "6px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", marginTop: "10px" }}
            >
              Einloggen
            </button>
          </form>
        </div>
      </div>
    );
  }

  // WENN EINGELOGGT: Zeige Datenbank
  return (
    <div>
      <div style={{ background: "#333", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white" }}>
        <span style={{ fontSize: "14px" }}>Angemeldet als: <strong>{user.email}</strong></span>
        <button 
          onClick={handleLogout}
          style={{ background: "#e74c3c", color: "white", border: "none", borderRadius: "4px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold" }}
        >
          Logout
        </button>
      </div>

      <YouthManager clubId={clubId} />
    </div>
  );
}