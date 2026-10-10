import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { findMoveConflicts } from "../pitchConflicts";
import { HOME_ADDRESS, isAtHomeVenue, fetchTeamMatches } from "../fussballde";

// Belegung pro Mannschaft: Vorlauf vor Anpfiff, Spieldauer inkl. Halbzeit, Nachlauf nach Spielende (Minuten).
// Standard = 1 Stunde vor bis 2 Stunden nach Anpfiff.
const DEFAULT_TIMING = { before: 60, duration: 105, after: 15, share: "Ganz" };
const SHARE_OPTIONS = [{ v: "Ganz", t: "Ganzer Platz" }, { v: "Halb", t: "½ Platz" }, { v: "Viertel", t: "¼ Platz" }];
const TIMING_FIELDS = [
  { key: "before", label: "Vorlauf" },
  { key: "duration", label: "Spieldauer" },
  { key: "after", label: "Nachlauf" }
];

const toMinutes = (time) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
const toTime = (minutes) => {
  const clamped = Math.min(Math.max(minutes, 0), 23 * 60 + 59);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
};

const bookingTypeFor = (competition) => {
  const c = competition.toLowerCase();
  if (c.includes("pokal")) return "Pokalspiel";
  if (c.includes("freundschaft")) return "Freundschaftsspiel";
  return "Ligaspiel";
};

// "https://www.fussball.de/mannschaft/.../team-id/011MIE..." oder direkt die ID
const extractTeamId = (input) => {
  const fromUrl = input.match(/team-id\/([A-Z0-9]+)/i);
  const raw = (fromUrl ? fromUrl[1] : input.trim()).toUpperCase();
  return /^[A-Z0-9]{20,40}$/.test(raw) ? raw : null;
};

// Platz anhand des Spielorts erraten, z. B. "Sportpark ... Pl.1" -> Platz mit "1" im Namen
const guessPitch = (venue, pitches, fallback) => {
  const number = (venue.match(/Pl(?:atz)?\.?\s*(\d)/i) || [])[1];
  const match = number && pitches.find(p => p.name.includes(number));
  return match ? match.id : fallback;
};

// Admin: fussball.de-Links pro Mannschaft hinterlegen und Heimspiele in die Platzbelegung importieren
export default function FussballImport({ clubId, teams, pitches, bookings }) {
  const [links, setLinks] = useState({});
  const [linkInputs, setLinkInputs] = useState({});
  const [timings, setTimings] = useState({});
  const [timingInputs, setTimingInputs] = useState({});
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState({});
  const [pitchFor, setPitchFor] = useState({});
  const [loadErrors, setLoadErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [strays, setStrays] = useState([]); // importierte Buchungen, deren Spielort nicht unser Sportpark ist
  const [isCleaning, setIsCleaning] = useState(false);

  const linksRef = doc(db, "ticker", `${clubId}_fussballde`);

  useEffect(() => {
    if (!clubId) return;
    return onSnapshot(doc(db, "ticker", `${clubId}_fussballde`), (snap) => {
      setLinks(snap.exists() ? snap.data().links || {} : {});
      setTimings(snap.exists() ? snap.data().timings || {} : {});
    });
  }, [clubId]);

  const saveLink = async (team) => {
    const teamId = extractTeamId(linkInputs[team] || "");
    if (!teamId) return alert("Bitte den Link zur Mannschaftsseite auf fussball.de einfügen (enthält \"team-id/...\").");
    await setDoc(linksRef, { links: { ...links, [team]: teamId }, timings });
    setLinkInputs({ ...linkInputs, [team]: "" });
  };

  const removeLink = async (team) => {
    if (!window.confirm(`Verknüpfung für ${team} entfernen?`)) return;
    const updated = { ...links };
    delete updated[team];
    await setDoc(linksRef, { links: updated, timings });
  };

  const timingOf = (team) => ({ ...DEFAULT_TIMING, ...(timings[team] || {}) });
  const inputValue = (team, key) => timingInputs[team]?.[key] ?? String(timingOf(team)[key]);

  // Zeiten einer Mannschaft speichern (beim Verlassen eines Feldes)
  const saveTiming = async (team) => {
    const current = timingOf(team);
    const updated = {
      ...current,
      ...Object.fromEntries(TIMING_FIELDS.map(({ key }) => {
        const value = parseInt(inputValue(team, key), 10);
        return [key, Number.isFinite(value) && value >= 0 && value <= 300 ? value : current[key]];
      }))
    };
    setTimingInputs({ ...timingInputs, [team]: undefined });
    if (TIMING_FIELDS.every(({ key }) => updated[key] === current[key])) return;
    await setDoc(linksRef, { links, timings: { ...timings, [team]: updated } });
  };

  const saveShare = async (team, share) => {
    await setDoc(linksRef, { links, timings: { ...timings, [team]: { ...timingOf(team), share } } });
  };

  // Beispiel für die Anzeige: Anpfiff 16:00 -> belegt 15:00–18:00
  const exampleRange = (team) => {
    const t = timingOf(team);
    const kickoff = 16 * 60;
    return `Anpfiff 16:00 → belegt ${toTime(kickoff - t.before)}–${toTime(kickoff + t.duration + t.after)}`;
  };

  // Status eines Spiels im Vergleich zum aktuellen Kalender
  const statusOf = (c, pitchId = pitchFor[c.matchId]) => {
    const existing = bookings.find(b => b.fussballMatchId === c.matchId);
    if (existing) {
      const unchanged = existing.date === c.date && existing.startTime === c.startTime && existing.endTime === c.endTime;
      return unchanged ? { kind: "imported", text: "✔ bereits im Kalender" } : { kind: "changed", text: "🔁 Termin geändert", existing };
    }
    const conflicts = findMoveConflicts(bookings, { id: null, startTime: c.startTime, endTime: c.endTime, share: c.share }, pitchId, c.date);
    if (conflicts.length > 0) return { kind: "conflict", text: `⚠️ Konflikt mit ${[...new Set(conflicts.map(b => b.team))].join(", ")}` };
    return { kind: "new", text: "🆕 neu" };
  };

  const loadMatches = async () => {
    const linked = Object.entries(links).filter(([team]) => teams.includes(team));
    if (linked.length === 0) return alert("Bitte zuerst mindestens eine Mannschaft mit fussball.de verknüpfen.");
    if (pitches.length === 0) return alert("Bitte zuerst unter \"Plätze verwalten\" einen Platz anlegen.");

    setIsLoading(true);
    setLoadErrors([]);
    const today = new Date().toLocaleDateString("sv-SE");
    const errors = [];
    const found = [];
    const awayVenues = {}; // matchId -> Spielort (nicht bei uns)

    await Promise.all(linked.map(async ([team, teamId]) => {
      try {
        const matches = await fetchTeamMatches(teamId);
        matches.filter(m => m.matchId && m.venue && !isAtHomeVenue(m.venue)).forEach(m => { awayVenues[m.matchId] = m.venue; });
        matches
          .filter(m => isAtHomeVenue(m.venue) && m.time && m.matchId && m.date >= today)
          .forEach(m => {
            const kickoff = toMinutes(m.time);
            const timing = timingOf(team);
            found.push({
              ...m,
              team,
              kickoff: m.time,
              opponent: m.isHome ? m.away : m.home,
              startTime: toTime(kickoff - timing.before),
              endTime: toTime(kickoff + timing.duration + timing.after),
              share: timing.share,
              type: bookingTypeFor(m.competition)
            });
          });
      } catch (error) {
        console.error(`fussball.de (${team}):`, error);
        errors.push(team);
      }
    }));

    found.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    // Bereits importierte Spiele behalten ihren (evtl. von Hand geänderten) Platz
    const pitchDefaults = Object.fromEntries(found.map(c => [
      c.matchId,
      bookings.find(b => b.fussballMatchId === c.matchId)?.pitchId || guessPitch(c.venue, pitches, pitches[0].id)
    ]));
    setPitchFor(pitchDefaults);
    setCandidates(found);
    // Neue und geänderte Spiele vorauswählen, Konflikte nicht
    setSelected(Object.fromEntries(found.map(c => {
      const kind = statusOf(c, pitchDefaults[c.matchId]).kind;
      return [c.matchId, kind === "new" || kind === "changed"];
    })));
    // Früher importierte Spiele, die laut fussball.de nicht bei uns stattfinden (z. B. SG-Spiele beim Partnerverein)
    setStrays(bookings.filter(b => b.fussballMatchId && awayVenues[b.fussballMatchId]).map(b => ({ ...b, venue: awayVenues[b.fussballMatchId] }))
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)));
    setLoadErrors(errors);
    setIsLoading(false);
  };

  const handleCleanup = async () => {
    if (!window.confirm(`${strays.length} Eintrag/Einträge ohne Spielort ${HOME_ADDRESS} aus der Platzbelegung entfernen?`)) return;
    setIsCleaning(true);
    try {
      const ids = new Set(strays.map(b => b.id));
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "ticker", `${clubId}_bookings`);
        const snap = await transaction.get(ref);
        const list = snap.exists() ? snap.data().list || [] : [];
        transaction.set(ref, { list: list.filter(b => !ids.has(b.id)) });
      });
      alert(`✅ ${ids.size} Eintrag/Einträge entfernt.`);
      setStrays([]);
    } catch (error) {
      console.error("Bereinigen fehlgeschlagen:", error);
      alert("Fehler beim Bereinigen.");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleImport = async () => {
    const chosen = candidates.filter(c => selected[c.matchId] && statusOf(c).kind !== "imported");
    if (chosen.length === 0) return alert("Keine Spiele ausgewählt.");
    if (!window.confirm(`${chosen.length} Heimspiel(e) in die Platzbelegung übernehmen?`)) return;

    setIsImporting(true);
    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "ticker", `${clubId}_bookings`);
        const snap = await transaction.get(ref);
        let list = snap.exists() ? snap.data().list || [] : [];

        chosen.forEach(c => {
          const fields = {
            team: c.team,
            type: c.type,
            date: c.date,
            pitchId: pitchFor[c.matchId],
            startTime: c.startTime,
            endTime: c.endTime,
            notes: `${c.home} – ${c.away} (${c.competition}), Anpfiff ${c.kickoff}`
          };
          const index = list.findIndex(b => b.fussballMatchId === c.matchId);
          if (index >= 0) {
            list = list.map((b, i) => i === index ? { ...b, ...fields } : b);
          } else {
            list.push({
              ...fields,
              id: `fb-${c.matchId}`,
              repetition: "Einmalig",
              startDate: null,
              endDate: null,
              days: [],
              exceptions: [],
              share: c.share || "Ganz",
              bookedBy: "fussball.de-Import",
              fussballMatchId: c.matchId
            });
          }
        });
        transaction.set(ref, { list });
      });
      alert(`✅ ${chosen.length} Heimspiel(e) übernommen!`);
    } catch (error) {
      console.error("Import-Fehler:", error);
      alert("Fehler beim Importieren.");
    } finally {
      setIsImporting(false);
    }
  };

  const cellStyle = { padding: "8px", fontSize: "12px", borderBottom: "1px solid #eee", textAlign: "left" };
  const statusColors = { new: "#27ae60", changed: "#2980b9", conflict: "#e67e22", imported: "#999" };

  return (
    <div style={{ background: "white", padding: "15px", borderRadius: "10px", border: "1px solid #ddd", textAlign: "left" }}>
      <h3 style={{ marginTop: 0, fontSize: "16px", color: "#2146d0" }}>📥 Heimspiele von fussball.de</h3>
      <p style={{ fontSize: "12px", color: "#666", marginTop: 0 }}>
        Heimspiele werden als Belegung eingetragen – Vorlauf, Spieldauer und Nachlauf legst du pro Mannschaft fest. Als Heimspiel zählen nur Spiele mit Spielort {HOME_ADDRESS}. Bereits importierte Spiele werden erkannt, geänderte Termine aktualisiert.
      </p>

      {/* 1. Verknüpfungen */}
      <h4 style={{ fontSize: "14px", margin: "15px 0 8px 0" }}>1. Mannschaften verknüpfen</h4>
      <p style={{ fontSize: "11px", color: "#888", margin: "0 0 8px 0" }}>Link zur Mannschaftsseite auf fussball.de einfügen, z. B. https://www.fussball.de/mannschaft/…/team-id/011MIE…</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {teams.map(team => (
          <div key={team} style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", fontSize: "13px" }}>
            <strong style={{ width: "120px" }}>{team}</strong>
            {links[team] ? (
              <>
                <span style={{ color: "#27ae60", flex: 1 }}>✔ verknüpft</span>
                <button onClick={() => removeLink(team)} style={{ background: "transparent", border: "1px solid #ccc", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "11px" }}>Entfernen</button>
                <div style={{ flexBasis: "100%", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", fontSize: "12px", color: "#555", padding: "2px 0 8px 0", borderBottom: "1px dashed #eee" }}>
                  <span>⏱</span>
                  {TIMING_FIELDS.map(({ key, label }) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {label}
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={inputValue(team, key)}
                        onChange={(e) => setTimingInputs({ ...timingInputs, [team]: { ...(timingInputs[team] || {}), [key]: e.target.value } })}
                        onBlur={() => saveTiming(team)}
                        style={{ width: "55px", padding: "4px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "12px", textAlign: "center", background: "#fff", color: "#333" }}
                      />
                      Min
                    </label>
                  ))}
                  <select value={timingOf(team).share} onChange={(e) => saveShare(team, e.target.value)} style={{ padding: "4px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "12px", background: "#fff", color: "#333" }}>
                    {SHARE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
                  </select>
                  <span style={{ color: "#888", fontSize: "11px" }}>{exampleRange(team)}</span>
                </div>
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="fussball.de-Link..."
                  value={linkInputs[team] || ""}
                  onChange={(e) => setLinkInputs({ ...linkInputs, [team]: e.target.value })}
                  style={{ flex: "1 1 200px", padding: "6px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "12px", background: "#fff", color: "#333" }}
                />
                <button onClick={() => saveLink(team)} style={{ background: "#2146d0", color: "white", border: "none", borderRadius: "4px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>Speichern</button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 2. Laden & Vorschau */}
      <h4 style={{ fontSize: "14px", margin: "20px 0 8px 0" }}>2. Heimspiele laden und prüfen</h4>
      <button onClick={loadMatches} disabled={isLoading} style={{ background: "#27ae60", color: "white", border: "none", borderRadius: "6px", padding: "10px 15px", cursor: isLoading ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "13px" }}>
        {isLoading ? "Lade von fussball.de..." : "🔄 Heimspiele laden"}
      </button>
      {loadErrors.length > 0 && <p style={{ color: "#e74c3c", fontSize: "12px" }}>Konnte nicht geladen werden: {loadErrors.join(", ")}</p>}

      {strays.length > 0 && (
        <div style={{ marginTop: "12px", background: "#fdecea", border: "1px solid #f5b7b1", borderRadius: "8px", padding: "10px 12px" }}>
          <strong style={{ fontSize: "13px", color: "#922b21" }}>🧹 {strays.length} Eintrag/Einträge in der Platzbelegung finden nicht bei uns statt</strong>
          <p style={{ fontSize: "11px", color: "#922b21", margin: "4px 0 8px 0" }}>Diese Spiele wurden früher übernommen, haben laut fussball.de aber einen anderen Spielort als {HOME_ADDRESS}.</p>
          <ul style={{ margin: "0 0 10px 0", paddingLeft: "18px", fontSize: "12px", color: "#333" }}>
            {strays.map(b => (
              <li key={b.id} style={{ marginBottom: "3px" }}>
                <strong>{new Date(`${b.date}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" })} {b.startTime}–{b.endTime}</strong> · {b.team} · {b.notes}
                <div style={{ color: "#888", fontSize: "11px" }}>📍 {b.venue}</div>
              </li>
            ))}
          </ul>
          <button onClick={handleCleanup} disabled={isCleaning} style={{ background: "#c0392b", color: "white", border: "none", borderRadius: "6px", padding: "8px 12px", cursor: isCleaning ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "12px" }}>
            {isCleaning ? "Wird bereinigt..." : `🗑️ ${strays.length} Eintrag/Einträge aus der Platzbelegung entfernen`}
          </button>
        </div>
      )}

      {candidates.length > 0 && (
        <>
          <div style={{ overflowX: "auto", marginTop: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
              <thead style={{ background: "#f4f6f8" }}>
                <tr>
                  <th style={cellStyle}></th>
                  <th style={cellStyle}>Datum</th>
                  <th style={cellStyle}>Belegung</th>
                  <th style={cellStyle}>Mannschaft</th>
                  <th style={cellStyle}>Gegner</th>
                  <th style={cellStyle}>Platz</th>
                  <th style={cellStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(c => {
                  const status = statusOf(c);
                  return (
                    <tr key={c.matchId} style={{ opacity: status.kind === "imported" ? 0.55 : 1 }}>
                      <td style={cellStyle}>
                        <input type="checkbox" disabled={status.kind === "imported"} checked={!!selected[c.matchId] && status.kind !== "imported"} onChange={(e) => setSelected({ ...selected, [c.matchId]: e.target.checked })} />
                      </td>
                      <td style={cellStyle}>{new Date(c.date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" })}</td>
                      <td style={cellStyle}>{c.startTime}–{c.endTime}<div style={{ color: "#888", fontSize: "11px" }}>Anpfiff {c.kickoff}{c.share && c.share !== "Ganz" ? ` · ${c.share === "Halb" ? "½" : "¼"} Platz` : ""}</div></td>
                      <td style={cellStyle}>{c.team}<div style={{ color: "#888", fontSize: "11px" }}>{c.competition}</div></td>
                      <td style={cellStyle}>{c.opponent}</td>
                      <td style={cellStyle}>
                        <select value={pitchFor[c.matchId] || ""} onChange={(e) => setPitchFor({ ...pitchFor, [c.matchId]: e.target.value })} style={{ padding: "4px", fontSize: "12px", borderRadius: "4px", border: "1px solid #ccc" }}>
                          {pitches.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <div style={{ color: "#888", fontSize: "10px", marginTop: "2px" }}>{c.venue}</div>
                      </td>
                      <td style={{ ...cellStyle, color: statusColors[status.kind], fontWeight: "bold" }}>{status.text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button onClick={handleImport} disabled={isImporting} style={{ marginTop: "12px", width: "100%", background: "#2146d0", color: "white", border: "none", borderRadius: "6px", padding: "12px", cursor: isImporting ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "14px" }}>
            {isImporting ? "Wird übernommen..." : `📥 ${candidates.filter(c => selected[c.matchId] && statusOf(c).kind !== "imported").length} ausgewählte Spiele übernehmen`}
          </button>
          <p style={{ fontSize: "11px", color: "#888" }}>Spiele mit Konflikt sind nicht vorausgewählt. Wenn du sie trotzdem anhakst, stehen beide Belegungen im Kalender.</p>
        </>
      )}
    </div>
  );
}
