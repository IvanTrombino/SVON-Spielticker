// Vercel Serverless Function: Spielplan bzw. Tabelle einer Mannschaft von fussball.de als JSON.
// Aufruf: /api/fussballde?teamId=011MIE1124000000VTVG0001VTR8C1K7            (Spielplan)
//         /api/fussballde?teamId=011MIE1124000000VTVG0001VTR8C1K7&type=table (aktuelle Tabelle)
// (Der Browser darf fussball.de nicht direkt abfragen, deshalb läuft der Abruf hier auf dem Server.)

const BASE = "https://www.fussball.de";
const HEADERS = { "User-Agent": "Mozilla/5.0 (SVON-Spielticker)" };

const decode = (s) => s
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, " ")
  .trim();

// Zerlegt das HTML des Spielplans in einzelne Spiele
export const parseMatches = (html, teamId) => {
  const chunks = html.split(/<tr class="row-headline[^"]*">/).slice(1);
  return chunks.map((chunk) => {
    const headline = decode((chunk.match(/<td[^>]*>([^<]*)<\/td>/) || [])[1] || "");
    // z. B. "Samstag, 10.10.2026 - 16:00 Uhr | Bezirksliga"
    const m = headline.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s*-\s*(\d{1,2}:\d{2}))?[^|]*\|\s*(.*)$/);
    if (!m) return null;

    const clubs = [...chunk.matchAll(/<td class="column-club[^"]*">\s*<a href="([^"]*)"[\s\S]*?<div class="club-name">([\s\S]*?)<\/div>/g)]
      .map(([, href, name]) => ({ teamId: (href.match(/team-id\/([A-Z0-9]+)/) || [])[1] || "", name: decode(name) }));
    if (clubs.length < 2) return null;

    const matchId = (chunk.match(/\/-\/spiel\/([A-Z0-9]+)/) || [])[1];
    const venue = decode((chunk.match(/<tr class="[^"]*row-venue[^"]*">\s*<td><\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/) || [])[1] || "");

    return {
      matchId,
      date: `${m[3]}-${m[2]}-${m[1]}`,
      time: m[4] ? m[4].padStart(5, "0") : null,
      competition: decode(m[5]),
      home: clubs[0].name,
      away: clubs[1].name,
      isHome: clubs[0].teamId === teamId,
      venue
    };
  }).filter(Boolean);
};

// Zerlegt die Tabelle (Platz, Mannschaft, Spiele, S/U/N, Tore, Differenz, Punkte)
export const parseTable = (html, teamId) => {
  let lastRank = null;
  return [...html.matchAll(/<tr( class="[^"]*")?>\s*<td class="column-icon">([\s\S]*?)<\/tr>/g)].map(([, cls, row]) => {
    const rankText = decode((row.match(/<td class="column-rank">([\s\S]*?)<\/td>/) || [])[1] || "");
    const rank = parseInt(rankText, 10) || lastRank; // bei Punktgleichheit steht der Platz nur einmal
    lastRank = rank;
    const rowTeamId = (row.match(/team-id\/([A-Z0-9]+)/) || [])[1] || "";
    const name = decode((row.match(/<div class="club-name">([\s\S]*?)<\/div>/) || [])[1] || "");
    const cells = [...row.matchAll(/<td(?: class="(?:hidden-small|no-wrap|column-points)")?>([^<]*)<\/td>/g)].map(c => decode(c[1]));
    if (!name || cells.length < 7) return null;
    const [played, won, draw, lost, goals, diff, points] = cells.slice(-7);
    return {
      rank,
      team: name,
      played: Number(played),
      won: Number(won),
      draw: Number(draw),
      lost: Number(lost),
      goals,
      diff: Number(diff),
      points: Number(points),
      own: rowTeamId === teamId || /\bown\b/.test(cls || "")
    };
  }).filter(Boolean);
};

const loadTable = async (teamId) => {
  // Tabellen-Navigation enthält die aktuelle Staffel (Liga) der Mannschaft
  const nav = await fetch(`${BASE}/ajax.team.table.nav/-/team-id/${teamId}`, { headers: HEADERS });
  if (!nav.ok) throw new Error(`fussball.de antwortet mit ${nav.status}`);
  const navHtml = await nav.text();
  const tableUrl = (navHtml.match(/data-ajax-resource="([^"]*\/ajax\.team\.table\/-\/[^"]*)"/) || [])[1];
  if (!tableUrl) return { league: null, rows: [] };
  const league = decode((navHtml.match(/<option value="[A-Z0-9]+-G"[^>]*selected[^>]*>([^<]*)/) || [])[1] || "");

  const table = await fetch(tableUrl, { headers: HEADERS });
  if (!table.ok) throw new Error(`fussball.de antwortet mit ${table.status}`);
  return { league, rows: parseTable(await table.text(), teamId) };
};

export default async function handler(req, res) {
  const teamId = String(req.query.teamId || "");
  if (!/^[A-Z0-9]{20,40}$/.test(teamId)) {
    return res.status(400).json({ error: "Ungültige team-id" });
  }

  try {
    if (req.query.type === "table") {
      const { league, rows } = await loadTable(teamId);
      res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
      return res.status(200).json({ teamId, league, rows, own: rows.find(row => row.own) || null });
    }

    // 1. Erste Seite holen – sie enthält den Link zum vollständigen Spielplan (mit Vereins-ID und Saisonzeitraum)
    const firstPage = await fetch(`${BASE}/ajax.team.matchplan/-/mode/PAGE/team-id/${teamId}`, { headers: HEADERS });
    if (!firstPage.ok) throw new Error(`fussball.de antwortet mit ${firstPage.status}`);
    const firstHtml = await firstPage.text();

    const loadMore = (firstHtml.match(/data-ajax-resource="([^"]*ajax\.team\.matchplan\.loadmore[^"]*)"/) || [])[1];
    let html = firstHtml;

    // 2. Alle Spiele inkl. Spielort auf einmal laden
    if (loadMore) {
      const url = loadMore.replace("/show-venues/false", "/show-venues/true") + "/max/200/offset/0";
      const full = await fetch(url, { headers: HEADERS });
      if (full.ok) {
        const data = await full.json();
        if (data && data.html) html = data.html;
      }
    }

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json({ teamId, matches: parseMatches(html, teamId) });
  } catch (error) {
    console.error("fussball.de Fehler:", error);
    return res.status(502).json({ error: "Spielplan konnte nicht von fussball.de geladen werden." });
  }
}
