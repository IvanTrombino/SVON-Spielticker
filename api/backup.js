// Vercel Serverless Function: Datensicherung aller Firestore-Daten.
// - automatisch jede Nacht (Vercel Cron, siehe vercel.json; Header "Authorization: Bearer <CRON_SECRET>")
// - manuell aus dem Admin Portal (Header "Authorization: Bearer <Firebase-ID-Token eines Admins>")
// Gespeichert wird in backups/<id> (Übersicht) + backups/<id>/parts/<n> (JSON in Teilen, je < 1 MB).
// Benötigte Umgebungsvariablen bei Vercel: FIREBASE_SERVICE_ACCOUNT (JSON des Dienstkontos), CRON_SECRET.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, DocumentReference } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { ADMIN_EMAILS } from "../src/admins.js";

const KEEP_BACKUPS = 30;
const PART_SIZE = 500000; // Zeichen pro Teil (Firestore-Dokumente dürfen max. 1 MB groß sein)
const SKIP_COLLECTIONS = ["backups", "ticker_sessions"]; // Sicherungen selbst und kurzlebige Ticker-Sitzungen
const SUBCOLLECTIONS = { attendance_events: ["responses", "contacts"] };

const getApp = () => {
  if (getApps().length) return getApps()[0];
  if (process.env.FIRESTORE_EMULATOR_HOST) return initializeApp({ projectId: process.env.GCLOUD_PROJECT || "svon-spielticker" });
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("FIREBASE_SERVICE_ACCOUNT fehlt in Vercel (Environment Variables speichern und danach Redeploy auslösen)");
  let account;
  try {
    account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT ist kein gültiges JSON – bitte den kompletten Inhalt der Schlüsseldatei einfügen, von { bis }");
  }
  if (account.type !== "service_account" || !account.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT enthält keinen Dienstkonto-Schlüssel");
  return initializeApp({ credential: cert(account) });
};

// Firestore-Werte in reines JSON umwandeln (Zeitstempel und Verweise bleiben erkennbar)
const toJSON = (value) => {
  if (value instanceof Timestamp) return { __type: "timestamp", value: value.toDate().toISOString() };
  if (value instanceof DocumentReference) return { __type: "ref", path: value.path };
  if (Array.isArray(value)) return value.map(toJSON);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJSON(v)]));
  return value;
};

const exportCollection = async (colRef) => {
  const snap = await colRef.get();
  const subNames = SUBCOLLECTIONS[colRef.id] || [];
  const entries = await Promise.all(snap.docs.map(async (d) => {
    const entry = { data: toJSON(d.data()) };
    if (subNames.length) {
      entry.subcollections = {};
      for (const name of subNames) entry.subcollections[name] = await exportCollection(d.ref.collection(name));
    }
    return [d.id, entry];
  }));
  return Object.fromEntries(entries);
};

// Wer darf auslösen? Cron mit Geheimnis oder ein angemeldeter Admin
const whoTriggered = async (req) => {
  const header = req.headers.authorization || "";
  if (process.env.CRON_SECRET && header === `Bearer ${process.env.CRON_SECRET}`) return "automatisch";
  if (!header.startsWith("Bearer ")) return null;
  const app = getApp(); // Konfigurationsfehler sollen als solche gemeldet werden, nicht als "nicht berechtigt"
  try {
    const token = await getAuth(app).verifyIdToken(header.slice(7));
    const isAdmin = token.firebase?.sign_in_provider === "password" && ADMIN_EMAILS.includes((token.email || "").toLowerCase());
    return isAdmin ? `manuell (${token.email})` : null;
  } catch {
    return null;
  }
};

export const runBackup = async (trigger) => {
  const db = getFirestore(getApp());
  const collections = (await db.listCollections()).filter(c => !SKIP_COLLECTIONS.includes(c.id));

  const data = {};
  for (const col of collections) data[col.id] = await exportCollection(col);
  const counts = Object.fromEntries(Object.entries(data).map(([name, docs]) => [name, Object.keys(docs).length]));

  const now = new Date();
  const berlin = now.toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }); // "2026-10-08 03:00:12"
  const id = trigger === "automatisch" ? berlin.slice(0, 10) : `${berlin.slice(0, 10)}_${berlin.slice(11, 16).replace(":", "")}_manuell`;
  const json = JSON.stringify({ createdAt: now.toISOString(), collections: data });
  const parts = [];
  for (let i = 0; i < json.length; i += PART_SIZE) parts.push(json.slice(i, i + PART_SIZE));

  const ref = db.collection("backups").doc(id);
  await db.recursiveDelete(ref); // gleiche ID (z. B. Cron zweimal am Tag) sauber überschreiben
  await Promise.all(parts.map((chunk, i) => ref.collection("parts").doc(String(i).padStart(4, "0")).set({ index: i, data: chunk })));
  await ref.set({ createdAt: Timestamp.fromDate(now), trigger, sizeBytes: Buffer.byteLength(json), parts: parts.length, counts });

  // Nur die letzten KEEP_BACKUPS Sicherungen aufbewahren
  const all = await db.collection("backups").orderBy("createdAt", "desc").get();
  const old = all.docs.slice(KEEP_BACKUPS);
  for (const d of old) await db.recursiveDelete(d.ref);

  return { id, trigger, parts: parts.length, sizeBytes: Buffer.byteLength(json), counts, deletedOld: old.length };
};

export default async function handler(req, res) {
  try {
    const trigger = await whoTriggered(req);
    if (!trigger) return res.status(401).json({ error: "Nicht berechtigt" });
    const result = await runBackup(trigger);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Datensicherung fehlgeschlagen:", error);
    return res.status(500).json({ error: error.message || "Datensicherung fehlgeschlagen" });
  }
}
