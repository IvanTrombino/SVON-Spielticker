import { doc, getDoc, runTransaction, setDoc, Timestamp } from "firebase/firestore";
import { signInAnonymously, signOut } from "firebase/auth";
import { db, auth } from "./firebase";

// Ohne 0/O/1/I/L, damit beim Abtippen nichts verwechselt wird
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_VALIDITY_MS = 24 * 60 * 60 * 1000;

const todayString = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD in lokaler Zeit

const generateCode = () => {
  const values = crypto.getRandomValues(new Uint32Array(6));
  const chars = Array.from(values, (v) => CODE_CHARS[v % CODE_CHARS.length]).join("");
  return `${chars.slice(0, 3)}-${chars.slice(3)}`;
};

// "k7p4xm", "K7P 4XM" usw. -> "K7P-4XM"
const normalizeCode = (input) => {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.length === 6 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
};

// Tagescode des Vereins holen oder neu erzeugen (nur für eingeloggte Trainer/Admins).
// Pro Kalendertag gibt es einen neuen Code, jeder Code ist max. 24 Stunden gültig.
export const getOrCreateDailyCode = (clubId) =>
  runTransaction(db, async (transaction) => {
    const ref = doc(db, "ticker_codes", clubId);
    const snap = await transaction.get(ref);
    const current = snap.exists() ? snap.data() : null;
    if (current && current.date === todayString() && current.expiresAt.toMillis() > Date.now()) {
      return current;
    }
    const fresh = {
      code: generateCode(),
      date: todayString(),
      expiresAt: Timestamp.fromMillis(Date.now() + CODE_VALIDITY_MS)
    };
    transaction.set(ref, fresh);
    return fresh;
  });

// Ticker-Person meldet sich anonym an und hinterlegt den Code.
// Ob der Code stimmt, prüfen die Firestore-Regeln – bei falschem Code schlägt setDoc fehl.
export const redeemTickerCode = async (clubId, input) => {
  const { user } = await signInAnonymously(auth);
  try {
    await setDoc(doc(db, "ticker_sessions", user.uid), { clubId, code: normalizeCode(input) });
  } catch (error) {
    await signOut(auth);
    throw error;
  }
};

// Den Tagescode darf eine Ticker-Person nur lesen, solange ihr Code noch gültig ist
export const isTickerSessionValid = async (clubId) => {
  try {
    await getDoc(doc(db, "ticker_codes", clubId));
    return true;
  } catch (error) {
    // Offline o. Ä. zählt nicht als abgelaufen
    return error.code !== "permission-denied";
  }
};
