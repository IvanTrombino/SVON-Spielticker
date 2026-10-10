// Tests für firestore.rules mit dem Firestore-Emulator.
//
// Ausführen (Emulator auf 127.0.0.1:8085, Pakete @firebase/rules-unit-testing + firebase installiert):
//   node firestore-rules.test.mjs /pfad/zu/firestore.rules
//
// Jede Zeile prüft: darf diese Rolle diese Aktion (erlaubt) oder nicht (verboten)?

import { readFileSync } from "fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, getDocs, deleteDoc, updateDoc, collection, query, where, Timestamp, addDoc, serverTimestamp } from "firebase/firestore";

const rulesPath = process.argv[2] || "firestore.rules";
const env = await initializeTestEnvironment({
  projectId: "svon-test",
  firestore: { rules: readFileSync(rulesPath, "utf8"), host: "127.0.0.1", port: 8085 }
});

const future = Timestamp.fromMillis(Date.now() + 3600_000);
const past = Timestamp.fromMillis(Date.now() - 3600_000);

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "youth_coaches", "coachF"), { clubId: "svon", firstName: "F", assignedTeams: ["F-Jugend"] });
  await setDoc(doc(db, "youth_coaches", "leitung"), { clubId: "svon", firstName: "L", assignedTeams: ["Jugendleitung"] });
  await setDoc(doc(db, "youth_players", "pF"), { clubId: "svon", youthTeam: "F-Jugend", status: "aktiv", medicalComment: "Allergie" });
  await setDoc(doc(db, "youth_players", "pD"), { clubId: "svon", youthTeam: "D-Jugend", status: "aktiv" });
  await setDoc(doc(db, "youth_trainings", "tF"), { clubId: "svon", team: "F-Jugend" });
  await setDoc(doc(db, "youth_trainings", "tD"), { clubId: "svon", team: "D-Jugend" });
  await setDoc(doc(db, "youth_settings", "svon"), { teams: [] });
  await setDoc(doc(db, "ticker_codes", "svon"), { code: "ABC-123", expiresAt: future });
  await setDoc(doc(db, "ticker_codes", "old"), { code: "OLD-111", expiresAt: past });
  for (const id of ["svon_live_match_F-Jugend", "svon_matches", "svon_next_matches", "svon_teams", "svon_players", "svon_lineups", "svon_scorers",
    "svon_bookings", "svon_pitchConflicts", "svon_teamCoaches", "svon_pitches", "svon_closures", "svon_fussballde", "svon_nameDisplay"]) {
    await setDoc(doc(db, "ticker", id), { x: 1 });
  }
  await setDoc(doc(db, "summercamp_participants", "sc1"), { clubId: "svon", campYear: 2026, allergies: "Nüsse" });
  await setDoc(doc(db, "summercamp_staff", "st1"), { clubId: "svon", campYear: 2026 });
  await setDoc(doc(db, "summercamp_donations", "d1"), { clubId: "svon", campYear: 2026, amount: 50 });
  await setDoc(doc(db, "summercamp_settings", "svon"), { years: {} });
  await setDoc(doc(db, "backups", "2026-10-08"), { parts: 1 });
  await setDoc(doc(db, "backups", "2026-10-08", "parts", "0000"), { index: 0, data: "{}" });
  await setDoc(doc(db, "attendance_events", "evF"), { clubId: "svon", team: "F-Jugend", closed: false, roster: [{ key: "pF", name: "Lian B." }], rosterKeys: ["pF"] });
  await setDoc(doc(db, "attendance_events", "evD"), { clubId: "svon", team: "D-Jugend", closed: false, roster: [], rosterKeys: ["pD"] });
  const infoBase = { clubId: "svon", title: "Info", text: "", teams: [], from: "2026-10-01", until: "2026-10-31", authorName: "X", createdAt: past };
  await setDoc(doc(db, "trainer_infos", "infoF"), { ...infoBase, authorUid: "coachF", expiresAt: future });
  await setDoc(doc(db, "trainer_infos", "infoL"), { ...infoBase, authorUid: "leitung", expiresAt: future });
  await setDoc(doc(db, "trainer_infos", "infoL2"), { ...infoBase, authorUid: "leitung", expiresAt: future });
  await setDoc(doc(db, "trainer_infos", "infoOld"), { ...infoBase, authorUid: "leitung", expiresAt: past });
  await setDoc(doc(db, "attendance_events", "evClosed"), { clubId: "svon", team: "F-Jugend", closed: true, roster: [], rosterKeys: ["pF"] });
});

const ctx = (uid, token) => env.authenticatedContext(uid, token).firestore();
const admin = ctx("adminUid", { email: "ivan.trombino@outlook.de", firebase: { sign_in_provider: "password" } });
const coachF = ctx("coachF", { email: "f@x.de", firebase: { sign_in_provider: "password" } });
const leitung = ctx("leitung", { email: "l@x.de", firebase: { sign_in_provider: "password" } });
const stranger = ctx("stranger", { email: "fremd@x.de", firebase: { sign_in_provider: "password" } });
const fakeAdminAnon = ctx("anonAdmin", { email: "ivan.trombino@outlook.de", firebase: { sign_in_provider: "anonymous" } });
const ticker = ctx("anonT", { firebase: { sign_in_provider: "anonymous" } });
const tickerNoCode = ctx("anonX", { firebase: { sign_in_provider: "anonymous" } });
const publicDb = env.unauthenticatedContext().firestore();

let passed = 0, failed = 0;
const t = async (name, expectOk, fn) => {
  try {
    await (expectOk ? assertSucceeds(fn()) : assertFails(fn()));
    passed++;
  } catch (e) {
    failed++;
    console.log(`❌ ${name} (erwartet: ${expectOk ? "erlaubt" : "verboten"}) – ${e.message.split("\n")[0]}`);
  }
};
const tick = (id) => doc(ticker, "ticker", id);

// --- Zuschauer (nicht angemeldet) ---
await t("Zuschauer liest Live-Spiel", true, () => getDoc(doc(publicDb, "ticker", "svon_live_match_F-Jugend")));
await t("Zuschauer liest Spielhistorie", true, () => getDoc(doc(publicDb, "ticker", "svon_matches")));
await t("Zuschauer liest nächste Spiele", true, () => getDoc(doc(publicDb, "ticker", "svon_next_matches")));
await t("Zuschauer liest Teamliste", true, () => getDoc(doc(publicDb, "ticker", "svon_teams")));
await t("Zuschauer liest fussball.de-Links", true, () => getDoc(doc(publicDb, "ticker", "svon_fussballde")));
await t("Zuschauer liest Jugend-Teams", true, () => getDoc(doc(publicDb, "youth_settings", "svon")));
await t("Zuschauer liest Spielerliste Ticker", false, () => getDoc(doc(publicDb, "ticker", "svon_players")));
await t("Zuschauer liest Initialen-Liste", false, () => getDoc(doc(publicDb, "ticker", "svon_nameDisplay")));
await t("Zuschauer liest Buchungen", false, () => getDoc(doc(publicDb, "ticker", "svon_bookings")));
await t("Zuschauer liest Platzkonflikte", false, () => getDoc(doc(publicDb, "ticker", "svon_pitchConflicts")));
await t("Zuschauer schreibt Live-Spiel", false, () => setDoc(doc(publicDb, "ticker", "svon_live_match_F-Jugend"), { y: 1 }));
await t("Zuschauer schreibt fussball.de-Links", false, () => setDoc(doc(publicDb, "ticker", "svon_fussballde"), { links: {} }));
await t("Zuschauer liest Jugendspieler", false, () => getDoc(doc(publicDb, "youth_players", "pF")));
await t("Zuschauer liest Tagescode", false, () => getDoc(doc(publicDb, "ticker_codes", "svon")));

// --- Ticker-Person (anonym, Tagescode) ---
await t("Ticker: falscher Code", false, () => setDoc(doc(ticker, "ticker_sessions", "anonT"), { clubId: "svon", code: "XXX-999" }));
await t("Ticker: abgelaufener Code", false, () => setDoc(doc(ticker, "ticker_sessions", "anonT"), { clubId: "old", code: "OLD-111" }));
await t("Ticker: Sitzung für fremde UID", false, () => setDoc(doc(ticker, "ticker_sessions", "someoneElse"), { clubId: "svon", code: "ABC-123" }));
await t("Ticker: Zusatzfelder in Sitzung", false, () => setDoc(doc(ticker, "ticker_sessions", "anonT"), { clubId: "svon", code: "ABC-123", admin: true }));
await t("Ticker: richtiger Code", true, () => setDoc(doc(ticker, "ticker_sessions", "anonT"), { clubId: "svon", code: "ABC-123" }));
await t("Ticker: liest Tagescode", true, () => getDoc(doc(ticker, "ticker_codes", "svon")));
await t("Ticker: schreibt Live-Spiel", true, () => setDoc(tick("svon_live_match_F-Jugend"), { y: 2 }));
await t("Ticker: schreibt Aufstellung", true, () => setDoc(tick("svon_lineups"), { y: 2 }));
await t("Ticker: schreibt Torschützen", true, () => setDoc(tick("svon_scorers"), { y: 2 }));
await t("Ticker: liest Spielerliste", true, () => getDoc(tick("svon_players")));
await t("Ticker: liest Initialen-Liste", true, () => getDoc(tick("svon_nameDisplay")));
await t("Ticker: schreibt Initialen-Liste", false, () => setDoc(tick("svon_nameDisplay"), { map: {} }));
await t("Ticker: schreibt Spielerliste", false, () => setDoc(tick("svon_players"), { y: 2 }));
await t("Ticker: schreibt Buchungen", false, () => setDoc(tick("svon_bookings"), { y: 2 }));
await t("Ticker: schreibt Platzkonflikte", false, () => setDoc(tick("svon_pitchConflicts"), { y: 2 }));
await t("Ticker: schreibt Teamliste", false, () => setDoc(tick("svon_teams"), { y: 2 }));
await t("Ticker: liest Buchungen", false, () => getDoc(tick("svon_bookings")));
await t("Ticker: liest Jugendspieler", false, () => getDoc(doc(ticker, "youth_players", "pF")));
await t("Ticker: schreibt fremden Verein", false, () => setDoc(doc(ticker, "ticker", "fcx_live_match_A"), { y: 2 }));
await t("Ticker ohne Code: schreibt Live-Spiel", false, () => setDoc(doc(tickerNoCode, "ticker", "svon_live_match_F-Jugend"), { y: 3 }));
await t("Anonym mit Admin-E-Mail im Token", false, () => getDoc(doc(fakeAdminAnon, "youth_players", "pF")));

// --- Trainer F-Jugend ---
await t("Trainer F: eigener Spieler", true, () => getDoc(doc(coachF, "youth_players", "pF")));
await t("Trainer F: fremder Spieler (D)", false, () => getDoc(doc(coachF, "youth_players", "pD")));
await t("Trainer F: Abfrage eigenes Team", true, () => getDocs(query(collection(coachF, "youth_players"), where("clubId", "==", "svon"), where("youthTeam", "==", "F-Jugend"), where("status", "==", "aktiv"))));
await t("Trainer F: Abfrage fremdes Team", false, () => getDocs(query(collection(coachF, "youth_players"), where("clubId", "==", "svon"), where("youthTeam", "==", "D-Jugend"))));
await t("Trainer F: Abfrage alle Spieler", false, () => getDocs(query(collection(coachF, "youth_players"), where("clubId", "==", "svon"))));
await t("Trainer F: Spieler ändern", false, () => setDoc(doc(coachF, "youth_players", "pF"), { youthTeam: "F-Jugend", hacked: true }));
await t("Trainer F: eigenes Profil", true, () => getDoc(doc(coachF, "youth_coaches", "coachF")));
await t("Trainer F: fremdes Profil", false, () => getDoc(doc(coachF, "youth_coaches", "leitung")));
await t("Trainer F: sich selbst Jugendleitung geben", false, () => setDoc(doc(coachF, "youth_coaches", "coachF"), { assignedTeams: ["Jugendleitung"] }));
await t("Trainer F: Jugend-Teams ändern", false, () => setDoc(doc(coachF, "youth_settings", "svon"), { teams: ["x"] }));
await t("Trainer F: Training eigenes Team anlegen", true, () => addDoc(collection(coachF, "youth_trainings"), { clubId: "svon", team: "F-Jugend" }));
await t("Trainer F: Training fremdes Team anlegen", false, () => addDoc(collection(coachF, "youth_trainings"), { clubId: "svon", team: "D-Jugend" }));
await t("Trainer F: Trainings eigenes Team abfragen", true, () => getDocs(query(collection(coachF, "youth_trainings"), where("clubId", "==", "svon"), where("team", "==", "F-Jugend"))));
await t("Trainer F: fremdes Training lesen", false, () => getDoc(doc(coachF, "youth_trainings", "tD")));
await t("Trainer F: Training auf fremdes Team umschreiben", false, () => setDoc(doc(coachF, "youth_trainings", "tF"), { clubId: "svon", team: "D-Jugend" }));
await t("Trainer F: Buchungen schreiben", true, () => setDoc(doc(coachF, "ticker", "svon_bookings"), { list: [] }));
await t("Trainer F: Platzkonflikt melden", true, () => setDoc(doc(coachF, "ticker", "svon_pitchConflicts"), { list: [] }));
await t("Trainer F: Spielerliste Ticker pflegen", true, () => setDoc(doc(coachF, "ticker", "svon_players"), { a: 1 }));
await t("Trainer F: Plätze ändern", false, () => setDoc(doc(coachF, "ticker", "svon_pitches"), { list: [] }));
await t("Trainer F: Platz sperren", false, () => setDoc(doc(coachF, "ticker", "svon_closures"), { list: [] }));
await t("Trainer F: Ticker-Teams ändern", false, () => setDoc(doc(coachF, "ticker", "svon_teams"), { teamsList: [] }));
await t("Trainer F: fussball.de-Links ändern", false, () => setDoc(doc(coachF, "ticker", "svon_fussballde"), { links: {} }));
await t("Trainer F: Initialen-Liste ändern", false, () => setDoc(doc(coachF, "ticker", "svon_nameDisplay"), { map: {} }));
await t("Trainer F: Tagescode erzeugen", true, () => setDoc(doc(coachF, "ticker_codes", "svon"), { code: "ABC-123", expiresAt: future }));

// --- Jugendleitung ---
await t("Jugendleitung: Spieler D", true, () => getDoc(doc(leitung, "youth_players", "pD")));
await t("Jugendleitung: Abfrage D-Jugend", true, () => getDocs(query(collection(leitung, "youth_players"), where("clubId", "==", "svon"), where("youthTeam", "==", "D-Jugend"))));
await t("Jugendleitung: Spieler ändern", false, () => setDoc(doc(leitung, "youth_players", "pD"), { youthTeam: "D-Jugend", x: 1 }));
await t("Jugendleitung: Spieler löschen", false, () => deleteDoc(doc(leitung, "youth_players", "pF")));

// --- Admin ---
await t("Admin: alle Spieler abfragen", true, () => getDocs(query(collection(admin, "youth_players"), where("clubId", "==", "svon"))));
await t("Admin: Spieler anlegen", true, () => addDoc(collection(admin, "youth_players"), { clubId: "svon", youthTeam: "E-Jugend" }));
await t("Admin: Trainer anlegen", true, () => setDoc(doc(admin, "youth_coaches", "neu"), { assignedTeams: ["E-Jugend"] }));
await t("Admin: alle Trainer lesen", true, () => getDocs(query(collection(admin, "youth_coaches"), where("clubId", "==", "svon"))));
await t("Admin: Jugend-Teams ändern", true, () => setDoc(doc(admin, "youth_settings", "svon"), { teams: [] }));
await t("Admin: Vereins-Einstellungen im Ticker", true, async () => {
  for (const id of ["svon_pitches", "svon_closures", "svon_teams", "svon_fussballde", "svon_teamCoaches", "svon_nameDisplay"]) await setDoc(doc(admin, "ticker", id), { a: 1 });
});
await t("Admin: Live-Spiel schreiben", true, () => setDoc(doc(admin, "ticker", "svon_live_match_F-Jugend"), { a: 1 }));
await t("Admin: Spieler endgültig löschen", true, () => deleteDoc(doc(admin, "youth_players", "pD")));

// --- Sommercamp: nur Admins ---
for (const [col, id] of [["summercamp_participants", "sc1"], ["summercamp_staff", "st1"], ["summercamp_donations", "d1"], ["summercamp_settings", "svon"]]) {
  await t(`Admin: ${col} lesen`, true, () => getDoc(doc(admin, col, id)));
  await t(`Admin: ${col} schreiben`, true, () => setDoc(doc(admin, col, `${id}x`), { clubId: "svon", campYear: 2026 }));
  await t(`Jugendleitung: ${col} lesen`, false, () => getDoc(doc(leitung, col, id)));
  await t(`Trainer: ${col} lesen`, false, () => getDoc(doc(coachF, col, id)));
  await t(`Trainer: ${col} schreiben`, false, () => setDoc(doc(coachF, col, "hack"), { clubId: "svon" }));
  await t(`Ticker: ${col} lesen`, false, () => getDoc(doc(ticker, col, id)));
  await t(`Zuschauer: ${col} lesen`, false, () => getDoc(doc(publicDb, col, id)));
  await t(`Fremder: ${col} lesen`, false, () => getDoc(doc(stranger, col, id)));
}
await t("Admin: Sommercamp-Teilnehmer abfragen", true, () => getDocs(query(collection(admin, "summercamp_participants"), where("clubId", "==", "svon"), where("campYear", "==", 2026))));
await t("Trainer: Sommercamp-Teilnehmer abfragen", false, () => getDocs(query(collection(coachF, "summercamp_participants"), where("clubId", "==", "svon"), where("campYear", "==", 2026))));

// --- Zu-/Absage ---
const resp = (db, ev, key) => doc(db, "attendance_events", ev, "responses", key);
await t("Eltern: Termin öffnen (Link)", true, () => getDoc(doc(publicDb, "attendance_events", "evF")));
await t("Eltern: alle Termine auflisten", false, () => getDocs(collection(publicDb, "attendance_events")));
await t("Eltern: zusagen", true, () => setDoc(resp(publicDb, "evF", "pF"), { status: "yes", comment: "", updatedAt: serverTimestamp() }));
await t("Eltern: Antwort ändern", true, () => setDoc(resp(publicDb, "evF", "pF"), { status: "no", comment: "krank", updatedAt: serverTimestamp() }));
await t("Eltern: Antworten sehen", true, () => getDocs(collection(publicDb, "attendance_events", "evF", "responses")));
await t("Eltern: Kind nicht im Termin", false, () => setDoc(resp(publicDb, "evF", "fremd"), { status: "yes", comment: "", updatedAt: serverTimestamp() }));
await t("Eltern: ungültiger Status", false, () => setDoc(resp(publicDb, "evF", "pF"), { status: "vielleicht", comment: "", updatedAt: serverTimestamp() }));
await t("Eltern: Zusatzfelder", false, () => setDoc(resp(publicDb, "evF", "pF"), { status: "yes", comment: "", updatedAt: serverTimestamp(), name: "x" }));
await t("Eltern: Kommentar zu lang", false, () => setDoc(resp(publicDb, "evF", "pF"), { status: "yes", comment: "x".repeat(201), updatedAt: serverTimestamp() }));
await t("Eltern: falsche Zeit", false, () => setDoc(resp(publicDb, "evF", "pF"), { status: "yes", comment: "", updatedAt: Timestamp.fromMillis(0) }));
await t("Eltern: beendeter Termin", false, () => setDoc(resp(publicDb, "evClosed", "pF"), { status: "yes", comment: "", updatedAt: serverTimestamp() }));
await t("Eltern: nicht existierender Termin", false, () => setDoc(resp(publicDb, "gibtsnicht", "pF"), { status: "yes", comment: "", updatedAt: serverTimestamp() }));
await t("Eltern: unsicher (abgeschafft)", false, () => setDoc(resp(publicDb, "evF", "pF"), { status: "maybe", comment: "", updatedAt: serverTimestamp() }));
await t("Eltern: Trikotwäsche übernehmen", true, () => setDoc(resp(publicDb, "evF", "pF"), { status: "yes", comment: "", laundry: true, updatedAt: serverTimestamp() }));
await t("Eltern: Trikotwäsche kein bool", false, () => setDoc(resp(publicDb, "evF", "pF"), { status: "yes", comment: "", laundry: "ja", updatedAt: serverTimestamp() }));
const contact = (db, ev, key) => doc(db, "attendance_events", ev, "contacts", key);
await t("Eltern: Telefonnummer hinterlegen", true, () => setDoc(contact(publicDb, "evF", "pF"), { phone: "0170 1234567", updatedAt: serverTimestamp() }));
await t("Eltern: Telefonnummer ändern", true, () => setDoc(contact(publicDb, "evF", "pF"), { phone: "0171 7654321", updatedAt: serverTimestamp() }));
await t("Eltern: Telefonnummern lesen", false, () => getDoc(contact(publicDb, "evF", "pF")));
await t("Eltern: Telefonnummer zu lang", false, () => setDoc(contact(publicDb, "evF", "pF"), { phone: "1".repeat(31), updatedAt: serverTimestamp() }));
await t("Eltern: Telefonnummer fremdes Kind", false, () => setDoc(contact(publicDb, "evF", "fremd"), { phone: "1", updatedAt: serverTimestamp() }));
await t("Eltern: Telefonnummer beendeter Termin", false, () => setDoc(contact(publicDb, "evClosed", "pF"), { phone: "1", updatedAt: serverTimestamp() }));
await t("Trainer F: Telefonnummern lesen", true, () => getDocs(collection(coachF, "attendance_events", "evF", "contacts")));
await t("Trainer F: Bestätigung/Warteliste setzen", true, () => updateDoc(doc(coachF, "attendance_events", "evF"), { maxPlayers: 8, selection: { pF: "confirmed" } }));
await t("Eltern: Antwort löschen", false, () => deleteDoc(resp(publicDb, "evF", "pF")));
await t("Eltern: Termin ändern", false, () => setDoc(doc(publicDb, "attendance_events", "evF"), { closed: true }, { merge: true }));
await t("Trainer F: eigene Termine abfragen", true, () => getDocs(query(collection(coachF, "attendance_events"), where("clubId", "==", "svon"), where("team", "==", "F-Jugend"))));
await t("Trainer F: fremde Termine abfragen", false, () => getDocs(query(collection(coachF, "attendance_events"), where("clubId", "==", "svon"), where("team", "==", "D-Jugend"))));
await t("Trainer F: Termin anlegen", true, () => addDoc(collection(coachF, "attendance_events"), { clubId: "svon", team: "F-Jugend", closed: false, rosterKeys: [] }));
await t("Trainer F: Termin für D-Jugend anlegen", false, () => addDoc(collection(coachF, "attendance_events"), { clubId: "svon", team: "D-Jugend", closed: false, rosterKeys: [] }));
await t("Trainer F: Termin beenden", true, () => setDoc(doc(coachF, "attendance_events", "evF"), { closed: true }, { merge: true }));
await t("Trainer F: Termin auf D-Jugend umschreiben", false, () => setDoc(doc(coachF, "attendance_events", "evClosed"), { team: "D-Jugend" }, { merge: true }));
await t("Trainer F: D-Termin löschen", false, () => deleteDoc(doc(coachF, "attendance_events", "evD")));
await t("Trainer F: Antwort löschen", true, () => deleteDoc(resp(coachF, "evF", "pF")));
await t("Admin: Termin löschen", true, () => deleteDoc(doc(admin, "attendance_events", "evD")));

// --- Datensicherungen ---
await t("Admin: Sicherungen auflisten", true, () => getDocs(collection(admin, "backups")));
await t("Admin: Sicherung herunterladen", true, () => getDocs(collection(admin, "backups", "2026-10-08", "parts")));
await t("Admin: Sicherung schreiben (nur Server)", false, () => setDoc(doc(admin, "backups", "x"), { a: 1 }));
await t("Admin: Sicherung löschen (nur Server)", false, () => deleteDoc(doc(admin, "backups", "2026-10-08")));
await t("Jugendleitung: Sicherungen lesen", false, () => getDocs(collection(leitung, "backups")));
await t("Trainer: Sicherungsteil lesen", false, () => getDoc(doc(coachF, "backups", "2026-10-08", "parts", "0000")));
await t("Ticker: Sicherungen lesen", false, () => getDocs(collection(ticker, "backups")));
await t("Zuschauer: Sicherungen lesen", false, () => getDocs(collection(publicDb, "backups")));

// --- Pinnwand für Trainer ---
const newInfo = (uid, extra = {}) => ({ clubId: "svon", title: "Platz zu", text: "Regen", teams: ["F-Jugend"], from: "2026-10-08", until: "2026-10-09",
  expiresAt: future, authorUid: uid, authorName: "F", createdAt: serverTimestamp(), ...extra });
const inDays = (d) => Timestamp.fromMillis(Date.now() + d * 86400_000);
await t("Trainer: Infos lesen", true, () => getDocs(query(collection(coachF, "trainer_infos"), where("clubId", "==", "svon"))));
await t("Trainer: Info anlegen", true, () => addDoc(collection(coachF, "trainer_infos"), newInfo("coachF")));
await t("Admin: Info anlegen", true, () => addDoc(collection(admin, "trainer_infos"), newInfo("adminUid")));
await t("Trainer: Info ohne Zeitraum", false, () => addDoc(collection(coachF, "trainer_infos"), (({ expiresAt, until, ...rest }) => rest)(newInfo("coachF"))));
await t("Trainer: Info schon abgelaufen", false, () => addDoc(collection(coachF, "trainer_infos"), newInfo("coachF", { expiresAt: past })));
await t("Trainer: Info länger als 1 Jahr", false, () => addDoc(collection(coachF, "trainer_infos"), newInfo("coachF", { expiresAt: inDays(400) })));
await t("Trainer: Info Ende vor Start", false, () => addDoc(collection(coachF, "trainer_infos"), newInfo("coachF", { from: "2026-10-10", until: "2026-10-09" })));
await t("Trainer: Info im Namen eines anderen", false, () => addDoc(collection(coachF, "trainer_infos"), newInfo("leitung")));
await t("Trainer: Info mit Zusatzfeld", false, () => addDoc(collection(coachF, "trainer_infos"), newInfo("coachF", { hack: 1 })));
await t("Trainer: eigene Info ändern", true, () => updateDoc(doc(coachF, "trainer_infos", "infoF"), { title: "Neu", expiresAt: inDays(5) }));
await t("Trainer: fremde Info ändern", false, () => updateDoc(doc(coachF, "trainer_infos", "infoL"), { title: "Neu" }));
await t("Trainer: Verfasser ändern", false, () => updateDoc(doc(coachF, "trainer_infos", "infoF"), { authorUid: "leitung" }));
await t("Admin: fremde Info ändern", true, () => updateDoc(doc(admin, "trainer_infos", "infoL"), { title: "Admin" }));
await t("Trainer: fremde Info löschen", false, () => deleteDoc(doc(coachF, "trainer_infos", "infoL2")));
await t("Trainer: abgelaufene Info löschen", true, () => deleteDoc(doc(coachF, "trainer_infos", "infoOld")));
await t("Trainer: eigene Info löschen", true, () => deleteDoc(doc(coachF, "trainer_infos", "infoF")));
await t("Admin: fremde Info löschen", true, () => deleteDoc(doc(admin, "trainer_infos", "infoL2")));
await t("Ticker: Infos lesen", false, () => getDocs(collection(ticker, "trainer_infos")));
await t("Zuschauer: Infos lesen", false, () => getDocs(collection(publicDb, "trainer_infos")));
await t("Fremder: Info anlegen", false, () => addDoc(collection(stranger, "trainer_infos"), newInfo("stranger")));

// --- Fremdes, selbst registriertes Konto ---
await t("Fremder: Spieler lesen", false, () => getDoc(doc(stranger, "youth_players", "pF")));
await t("Fremder: Buchungen lesen", false, () => getDoc(doc(stranger, "ticker", "svon_bookings")));
await t("Fremder: Live-Spiel schreiben", false, () => setDoc(doc(stranger, "ticker", "svon_live_match_F-Jugend"), { y: 1 }));
await t("Fremder: Tagescode lesen", false, () => getDoc(doc(stranger, "ticker_codes", "svon")));
await t("Fremder: sich Trainerprofil anlegen", false, () => setDoc(doc(stranger, "youth_coaches", "stranger"), { assignedTeams: ["Jugendleitung"] }));
await t("Fremder: Live-Spiel lesen (öffentlich)", true, () => getDoc(doc(stranger, "ticker", "svon_live_match_F-Jugend")));

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
await env.cleanup();
process.exit(failed ? 1 : 0);
