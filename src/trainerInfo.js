import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import { isSameTeam } from "./teamOrder";

// --- INFOS FÜR TRAINER: Platzsperren (Banner) und Pinnwand ---

export const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const addDays = (dateString, days) => {
  const d = new Date(`${dateString}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const formatInfoDate = (dateString) =>
  new Date(`${dateString}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

// Push an alle Trainer, die den ntfy-Kanal abonniert haben (z. B. "svontrainerinfo")
export const trainerChannel = (clubId) => `${clubId}trainerinfo`;
export const sendTrainerPush = (clubId, text) =>
  fetch(`https://ntfy.sh/${trainerChannel(clubId)}`, { method: "POST", body: text, headers: { "Priority": "high" } }).catch(() => {});

export const shareViaWhatsApp = (text) => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");

// Betrifft eine Mannschaftsliste (Info/Sperre) diesen Trainer? teams = null -> sieht alles
export const concernsTeams = (targetTeams, viewerTeams) =>
  !viewerTeams || targetTeams.some(t => viewerTeams.some(v => isSameTeam(t, v)));

// Text einer Platzsperre für WhatsApp/Push
export const closureText = (closure, pitchName, targetPitchName) => {
  const lines = [`🚫 Platzsperre: ${pitchName} am ${formatInfoDate(closure.date)}`];
  if (closure.reason) lines.push(`Grund: ${closure.reason}`);
  const affected = closure.affected || [];
  if (affected.length > 0) {
    lines.push("", targetPitchName ? `Verlegt nach ${targetPitchName}:` : "Abgesagt:");
    affected.forEach(a => lines.push(`• ${a.startTime}–${a.endTime} ${a.team}`));
  }
  return lines.join("\n");
};

// Pinnwand-Infos eines Vereins live laden; abgelaufene werden dabei gelöscht
export const useTrainerInfos = (clubId, enabled = true) => {
  const [infos, setInfos] = useState([]);

  useEffect(() => {
    if (!clubId || !enabled) return;
    const q = query(collection(db, "trainer_infos"), where("clubId", "==", clubId));
    return onSnapshot(q, (snap) => {
      const now = Date.now();
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      all.filter(i => i.expiresAt && i.expiresAt.toMillis() < now)
        .forEach(i => deleteDoc(doc(db, "trainer_infos", i.id)).catch(error => console.error("Abgelaufene Info löschen:", error)));
      setInfos(all
        .filter(i => !i.expiresAt || i.expiresAt.toMillis() >= now)
        .sort((a, b) => (b.createdAt?.toMillis?.() || now) - (a.createdAt?.toMillis?.() || now)));
    }, (error) => console.error("Infos laden:", error));
  }, [clubId, enabled]);

  return infos;
};

// Sichtbar = Zeitraum hat begonnen und Mannschaft passt (eigene Infos sieht man immer)
export const visibleInfos = (infos, viewerTeams, uid) => {
  const today = todayString();
  return infos.filter(i => i.authorUid === uid || (i.from <= today && (i.teams.length === 0 || concernsTeams(i.teams, viewerTeams))));
};

// Ungelesen-Zähler (pro Gerät gespeichert)
const seenKey = (clubId) => `svon_infos_seen_${clubId}`;
export const readSeenInfos = (clubId) => {
  try { return JSON.parse(localStorage.getItem(seenKey(clubId)) || "[]"); } catch { return []; }
};
export const markInfosSeen = (clubId, ids) => {
  try { localStorage.setItem(seenKey(clubId), JSON.stringify(ids)); } catch { /* privater Modus o. Ä. */ }
};
