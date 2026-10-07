import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase"; 
import { ADMIN_EMAILS } from "../admins";
import YouthManager from "./YouthManager"; 

export default function YouthAdminPage({ clubId }) {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);


  // Prüfen, ob der Nutzer eingeloggt ist und zur harten Admin-Liste gehört
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (currentUser.email && ADMIN_EMAILS.includes(currentUser.email.toLowerCase())) {
          setUser(currentUser); 
        } else {
          // Falscher Account -> Sofort wieder ausloggen!
          await signOut(auth);
          setUser(null);
          setError("Zugriff verweigert: Dieser Bereich ist ausschließlich für die Jugendleitung.");
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe(); 
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const enteredEmailLower = email.trim().toLowerCase();

    // Vorab-Prüfung der E-Mail
    if (!ADMIN_EMAILS.includes(enteredEmailLower)) {
      setError("Zugriff verweigert: Diese E-Mail-Adresse hat keine Administrator-Rechte.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
    } catch (err) {
      console.error(err);
      setError("Zugangsdaten falsch. Bitte überprüfe E-Mail und Passwort.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Bitte trage zuerst deine E-Mail-Adresse oben ein.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      alert("Eine E-Mail zum Zurücksetzen des Passworts wurde an " + email + " gesendet. Bitte prüfe auch deinen Spam-Ordner.");
      setError("");
    } catch (err) {
      console.error("Fehler beim Passwort-Reset:", err);
      setError("Fehler beim Senden der Reset-E-Mail.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: "50px", color: "#333" }}>Lade...</div>;
  }

  // WENN NICHT EINGELOGGT: Zeige das Login-Formular
  if (!user) {
    return (
      <div style={{ padding: "20px", maxWidth: "400px", margin: "50px auto", fontFamily: "sans-serif", color: "#333" }}>
        <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "10px", border: "1px solid #ccc", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
          <h2 style={{ textAlign: "center", color: "#2146d0", marginBottom: "10px" }}>🔒 Jugend-Admin</h2>
          <p style={{ fontSize: "13px", color: "#e74c3c", textAlign: "center", fontWeight: "bold", marginBottom: "20px" }}>
            Nur für Jugendleitung.
          </p>
          
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <input
              type="email"
              placeholder="E-Mail-Adresse"
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
            
            {error && <p style={{ color: "#e74c3c", fontSize: "13px", margin: 0, fontWeight: "bold", textAlign: "center" }}>{error}</p>}
            
            <button 
              type="submit" 
              style={{ padding: "12px", background: "#2146d0", color: "white", border: "none", borderRadius: "6px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", marginTop: "5px" }}
            >
              Admin-Login
            </button>
          </form>

          {/* Passwort-Vergessen Button */}
          <div style={{ textAlign: "center", marginTop: "15px" }}>
            <button 
              type="button" 
              onClick={handleResetPassword}
              style={{ background: "transparent", color: "#2980b9", border: "none", fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}
            >
              Passwort vergessen?
            </button>
          </div>
        </div>
      </div>
    );
  }

  // WENN EINGELOGGT: Zeige Datenbank
  return (
    <div>
      <div style={{ background: "#333", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white" }}>
        <span style={{ fontSize: "14px" }}>Admin-Bereich | Angemeldet als: <strong>{user.email}</strong></span>
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