#!/usr/bin/env node
// Datensicherung zurückspielen (in der Google Cloud Shell ausführen).
//
//   node restore-backup.mjs <sicherung.json>                                  Inhalt anzeigen
//   node restore-backup.mjs <sicherung.json> --bereich ticker                 einen Bereich zurückholen
//   node restore-backup.mjs <sicherung.json> --bereich ticker --eintrag svon_bookings   einen Eintrag
//   node restore-backup.mjs <sicherung.json> --alles                          alles zurückholen
//
// Zusätzlich:  --exakt   Einträge löschen, die es in der Sicherung nicht gab (sonst bleiben sie erhalten)
//
// Ablauf: Vorschau -> aktueller Stand wird als Datei gesichert -> Bestätigung mit "JA" -> Schreiben.
// Die Datei "vor-wiederherstellung-....json" kann mit demselben Skript wieder eingespielt werden.

import { readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline/promises";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, DocumentReference } from "firebase-admin/firestore";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "svon-spielticker";
const NAMES = {
  youth_players: "Spieler", youth_coaches: "Trainer", youth_trainings: "Trainings", youth_settings: "Mannschaften",
  ticker: "Ticker & Plätze", ticker_codes: "Ticker-Codes", attendance_events: "Zusagen",
  summercamp_participants: "Sommercamp Kinder", summercamp_staff: "Sommercamp Betreuer",
  summercamp_donations: "Spenden", summercamp_settings: "Sommercamp Preise"
};
const SUBCOLLECTIONS = { attendance_events: ["responses", "contacts"] };

// --- Argumente ---
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--bereich" && args[args.indexOf(a) - 1] !== "--eintrag");
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const area = option("--bereich");
const entry = option("--eintrag");
const all = args.includes("--alles");
const exact = args.includes("--exakt");
const autoYes = args.includes("--ja"); // nur für automatische Tests

if (!file) {
  console.log("Bitte die Sicherungsdatei angeben, z. B.:  node restore-backup.mjs SVON-Sicherung_2026-10-08.json");
  process.exit(1);
}

const backup = JSON.parse(readFileSync(file, "utf8"));
const collections = backup.collections || {};
const label = (id) => NAMES[id] ? `${NAMES[id]} (${id})` : id;

console.log(`\n📦 Sicherung vom ${new Date(backup.createdAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`);
for (const [id, docs] of Object.entries(collections)) console.log(`   ${label(id)}: ${Object.keys(docs).length} ${Object.keys(docs).length === 1 ? "Eintrag" : "Einträge"}`);

if (!area && !all) {
  console.log("\nNichts geändert. Zum Zurückholen z. B.:  --bereich ticker   oder   --bereich youth_players --eintrag <ID>   oder   --alles\n");
  process.exit(0);
}
if (area && !collections[area]) {
  console.log(`\n❌ Bereich "${area}" ist nicht in der Sicherung. Mögliche Bereiche: ${Object.keys(collections).join(", ")}\n`);
  process.exit(1);
}
if (entry && !area) {
  console.log("\n❌ --eintrag geht nur zusammen mit --bereich.\n");
  process.exit(1);
}
if (entry && !collections[area][entry]) {
  console.log(`\n❌ Eintrag "${entry}" gibt es im Bereich "${area}" der Sicherung nicht.\n`);
  process.exit(1);
}

// --- Firestore ---
const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);

const fromJSON = (value) => {
  if (Array.isArray(value)) return value.map(fromJSON);
  if (value && typeof value === "object") {
    if (value.__type === "timestamp") return Timestamp.fromDate(new Date(value.value));
    if (value.__type === "ref") return db.doc(value.path);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromJSON(v)]));
  }
  return value;
};
const toJSON = (value) => {
  if (value instanceof Timestamp) return { __type: "timestamp", value: value.toDate().toISOString() };
  if (value instanceof DocumentReference) return { __type: "ref", path: value.path };
  if (Array.isArray(value)) return value.map(toJSON);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJSON(v)]));
  return value;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const entries = (n) => `${n} ${n === 1 ? "Eintrag" : "Einträge"}`;

// Aktuellen Stand eines Bereichs (oder einzelner Einträge) lesen – im selben Format wie die Sicherung
const readCurrent = async (colId, onlyId) => {
  const docs = onlyId ? [await db.collection(colId).doc(onlyId).get()].filter(d => d.exists) : (await db.collection(colId).get()).docs;
  const result = {};
  for (const d of docs) {
    const item = { data: toJSON(d.data()) };
    for (const sub of SUBCOLLECTIONS[colId] || []) {
      const subSnap = await d.ref.collection(sub).get();
      item.subcollections = { ...(item.subcollections || {}), [sub]: Object.fromEntries(subSnap.docs.map(s => [s.id, { data: toJSON(s.data()) }])) };
    }
    result[d.id] = item;
  }
  return result;
};

// --- Plan erstellen ---
const targets = all ? Object.keys(collections) : [area];
const plan = [];
const current = {};
for (const colId of targets) {
  const fromBackup = entry ? { [entry]: collections[colId][entry] } : collections[colId];
  const now = await readCurrent(colId, entry);
  current[colId] = now;
  const counts = { neu: 0, geändert: 0, gleich: 0, löschen: 0 };
  for (const [id, item] of Object.entries(fromBackup)) {
    const existing = now[id];
    if (!existing) counts.neu++;
    else if (same(existing, item)) counts.gleich++;
    else counts.geändert++;
    plan.push({ type: "set", colId, id, item });
  }
  if (exact && !entry) {
    for (const id of Object.keys(now).filter(id => !fromBackup[id])) {
      counts.löschen++;
      plan.push({ type: "delete", colId, id });
    }
  }
  console.log(`\n🔎 ${label(colId)}${entry ? ` – Eintrag ${entry}` : ""}: ${Object.keys(now).length} aktuell → ${Object.keys(fromBackup).length} aus Sicherung`);
  console.log(`   wiederherstellen: ${counts.neu} fehlende, ${counts.geändert} geänderte (${counts.gleich} unverändert)` +
    (exact && !entry ? `, ${counts.löschen} löschen (nicht in der Sicherung)` : `, ${Math.max(0, Object.keys(now).length - Object.keys(fromBackup).length)} neuere bleiben erhalten`));
}

const changes = plan.filter(p => p.type === "delete" || !same(current[p.colId][p.id], p.item));
if (changes.length === 0) {
  console.log("\n✅ Der aktuelle Stand entspricht bereits der Sicherung – nichts zu tun.\n");
  process.exit(0);
}

// --- Aktuellen Stand vorher sichern ---
const stamp = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).replace(" ", "_").replace(/:/g, "-");
const safetyFile = `vor-wiederherstellung-${stamp}.json`;
writeFileSync(safetyFile, JSON.stringify({ createdAt: new Date().toISOString(), collections: current }));
console.log(`\n💾 Aktueller Stand gesichert in: ${safetyFile}  (damit lässt sich die Wiederherstellung rückgängig machen)`);

// --- Bestätigung ---
if (!autoYes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\n⚠️  ${entries(changes.length)} werden überschrieben/gelöscht. Zum Fortfahren JA eingeben: `);
  rl.close();
  if (answer.trim() !== "JA") {
    console.log("Abgebrochen – nichts geändert.\n");
    process.exit(0);
  }
}

// --- Schreiben (in Paketen) ---
let batch = db.batch();
let ops = 0;
const flush = async () => { if (ops > 0) { await batch.commit(); batch = db.batch(); ops = 0; } };
const queue = async (fn) => { fn(batch); if (++ops >= 400) await flush(); };

for (const p of changes) {
  const ref = db.collection(p.colId).doc(p.id);
  if (p.type === "delete") {
    await flush();
    await db.recursiveDelete(ref);
    continue;
  }
  await queue(b => b.set(ref, fromJSON(p.item.data)));
  for (const [sub, docs] of Object.entries(p.item.subcollections || {})) {
    for (const [subId, subItem] of Object.entries(docs)) await queue(b => b.set(ref.collection(sub).doc(subId), fromJSON(subItem.data)));
  }
}
await flush();
console.log(`\n✅ Fertig: ${entries(changes.length)} wiederhergestellt.\n`);
process.exit(0);
