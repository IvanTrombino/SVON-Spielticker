import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // <-- NEU HINZUGEFÜGT

const firebaseConfig = {
  apiKey: "AIzaSyADsOUKkPH1r9GeYUPXPZNWkvfvW-0SFfc",
  authDomain: "svon-spielticker.firebaseapp.com",
  projectId: "svon-spielticker",
  storageBucket: "svon-spielticker.firebasestorage.app",
  messagingSenderId: "902812259818",
  appId: "1:902812259818:web:1ed3e9cb608300f37c8e93",
  measurementId: "G-E8RT2KYE0D"
};

// Firebase initialisieren
const app = initializeApp(firebaseConfig);

// Datenbank exportieren, damit andere Dateien sie nutzen können
export const db = getFirestore(app);

// Authentifizierung exportieren für den geschützten Jugend-Bereich
export const auth = getAuth(app); // <-- NEU HINZUGEFÜGT