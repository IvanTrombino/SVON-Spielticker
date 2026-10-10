// Export der Platzbelegung (Zeitraum von–bis) als Excel (.xlsx) oder PDF – ohne externe Bibliothek.
// Aufbau: je Monat ein Abschnitt (Excel: ein Tabellenblatt), darin jeder Tag mit allen Buchungen.

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const SHARE_LABELS = { Halb: "½ Platz", Viertel: "¼ Platz" };

const parseDate = (dateStr) => new Date(`${dateStr}T12:00:00`);
const toDateStr = (d) => d.toLocaleDateString("sv-SE");
export const formatDayLong = (dateStr) => {
  const d = parseDate(dateStr);
  return `${DAY_NAMES[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};
const formatShort = (dateStr) => dateStr.split("-").reverse().join(".");

const occursOn = (b, dateStr) => {
  if (b.repetition === "Einmalig") return b.date === dateStr;
  return dateStr >= b.startDate && dateStr <= b.endDate
    && (b.days || []).includes(DAY_NAMES[parseDate(dateStr).getDay()])
    && !(b.exceptions || []).includes(dateStr);
};

// [{ key: "2026-10", title: "Oktober 2026", days: [{ date, entries: [...], closures: [...] }] }]
export const buildSchedule = ({ bookings, closures, pitches, from, to, pitchId = "", team = "" }) => {
  const pitchName = (id) => pitches.find(p => p.id === id)?.name || "Unbekannter Platz";
  const shownPitches = pitchId ? [pitchId] : null;
  const months = [];
  for (let d = parseDate(from); toDateStr(d) <= to; d.setDate(d.getDate() + 1)) {
    const date = toDateStr(d);
    const key = date.slice(0, 7);
    if (months.at(-1)?.key !== key) months.push({ key, title: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, days: [] });
    const entries = bookings
      .filter(b => occursOn(b, date) && (!shownPitches || shownPitches.includes(b.pitchId)) && (!team || b.team === team))
      .map(b => ({ start: b.startTime, end: b.endTime, team: b.team, type: b.type || "", pitch: pitchName(b.pitchId), share: SHARE_LABELS[b.share] || "", notes: b.notes || "" }))
      .sort((a, b) => a.start.localeCompare(b.start) || a.pitch.localeCompare(b.pitch));
    const dayClosures = closures
      .filter(c => c.date === date && (!shownPitches || shownPitches.includes(c.pitchId)))
      .map(c => ({ pitch: pitchName(c.pitchId), reason: c.reason || "" }));
    months.at(-1).days.push({ date, entries, closures: dayClosures });
  }
  return months;
};

export const entryLine = (e) =>
  `${e.start} - ${e.end} Uhr | ${e.team} ${e.type} | ${e.pitch}${e.share ? ` (${e.share})` : ""}${e.notes ? ` – ${e.notes}` : ""}`;

export const exportFileName = (from, to, ext) => `Platzbelegung_${formatShort(from)}-${formatShort(to)}.${ext}`;

export const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ---------- ZIP (unkomprimiert) für .xlsx ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const zip = (files) => {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name, content } of files) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(content);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true); entry.setUint16(8, 0x0800, true);
    entry.setUint32(16, crc, true); entry.setUint32(20, data.length, true); entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true); entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((sum, c) => sum + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

// ---------- Excel ----------
const xmlEscape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i) => String.fromCharCode(65 + i);
// style: 0 normal, 1 fett, 2 Titel, 3 Tageskopf (fett, grau hinterlegt), 4 grau/kursiv
const sheetXml = (rows, widths) => {
  const body = rows.map((row, r) => `<row r="${r + 1}">${row.cells.map((value, c) => value === "" ? "" :
    `<c r="${colName(c)}${r + 1}" t="inlineStr" s="${row.style || 0}"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${body}</sheetData><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
};

export const buildXlsx = (months, { from, to, filterText }) => {
  const header = ["Datum", "Wochentag", "Von", "Bis", "Mannschaft", "Art", "Platz", "Anteil", "Hinweis"];
  const sheets = months.map(month => {
    const rows = [
      { style: 2, cells: [`Platzbelegung ${month.title}`] },
      { style: 4, cells: [`Zeitraum ${formatShort(from)} – ${formatShort(to)}${filterText ? ` · ${filterText}` : ""}`] },
      { cells: [] },
      { style: 1, cells: header }
    ];
    month.days.forEach(day => {
      const d = parseDate(day.date);
      const [date, weekday] = [formatShort(day.date), DAY_NAMES[d.getDay()]];
      rows.push({ style: 3, cells: [date, weekday, "", "", "", "", "", "", ""] });
      day.closures.forEach(c => rows.push({ cells: [date, weekday, "", "", "PLATZ GESPERRT", "", c.pitch, "", c.reason] }));
      if (day.entries.length === 0 && day.closures.length === 0) rows.push({ style: 4, cells: [date, weekday, "", "", "keine Buchungen"] });
      day.entries.forEach(e => rows.push({ cells: [date, weekday, e.start, e.end, e.team, e.type, e.pitch, e.share, e.notes] }));
    });
    return { name: month.title.slice(0, 31), xml: sheetXml(rows, [12, 12, 8, 8, 22, 18, 20, 10, 40]) };
  });
  const files = [
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF2146D0"/><name val="Calibri"/></font><font><i/><sz val="11"/><color rgb="FF888888"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEFF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: s.xml }))
  ];
  return zip(files);
};

// ---------- PDF (A4, Helvetica, WinAnsi) ----------
const WIN_ANSI_EXTRA = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "–": 0x96, "—": 0x97, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95 };
const toWinAnsi = (text) => Array.from(text, ch => {
  const code = ch.codePointAt(0);
  if (WIN_ANSI_EXTRA[ch]) return WIN_ANSI_EXTRA[ch];
  return code < 256 ? code : 0x3f; // nicht darstellbar -> "?"
});
const pdfString = (text) => toWinAnsi(text).map(b => b === 0x28 || b === 0x29 || b === 0x5c ? `\\${String.fromCharCode(b)}` : b < 32 || b > 126 ? `\\${b.toString(8).padStart(3, "0")}` : String.fromCharCode(b)).join("");

// Breite (in 1/1000 Schriftgröße) für Zeilenumbruch – grobe Näherung für Helvetica
const charWidth = (ch, bold) => {
  if (" ,.:;|!ilIjt'".includes(ch)) return 280;
  if ("mwMW".includes(ch)) return 860;
  if (/[A-ZÄÖÜ]/.test(ch)) return bold ? 720 : 680;
  if (/[0-9]/.test(ch)) return 556;
  return bold ? 590 : 540;
};
const textWidth = (text, size, bold) => Array.from(text).reduce((w, ch) => w + charWidth(ch, bold), 0) * size / 1000;
const wrap = (text, size, bold, maxWidth) => {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(candidate, size, bold) > maxWidth) { lines.push(line); line = word; } else line = candidate;
  }
  return [...lines, line];
};

export const buildPdf = (months, { from, to, filterText }) => {
  const [pageW, pageH, margin] = [595.28, 841.89, 50];
  const pages = [];
  let ops = [];
  let y = 0;
  const newPage = () => { ops = []; pages.push(ops); y = pageH - margin; };
  const ensure = (height) => { if (y - height < margin + 20) newPage(); };
  const text = (str, { size = 10, bold = false, x = margin, color = "0 0 0" } = {}) => {
    for (const line of wrap(str, size, bold, pageW - x - margin)) {
      ensure(size + 4);
      ops.push(`BT ${color} rg /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${(y - size).toFixed(1)} Td (${pdfString(line)}) Tj ET`);
      y -= size + 4;
    }
  };
  const rule = () => { ops.push(`0.8 0.8 0.8 RG 0.5 w ${margin} ${y.toFixed(1)} m ${pageW - margin} ${y.toFixed(1)} l S`); y -= 6; };

  newPage();
  text("Platzbelegung", { size: 18, bold: true, color: "0.13 0.27 0.82" });
  text(`Zeitraum ${formatShort(from)} – ${formatShort(to)}${filterText ? ` · ${filterText}` : ""}`, { size: 10, color: "0.4 0.4 0.4" });
  y -= 6;
  months.forEach((month, mi) => {
    if (mi > 0) newPage(); // jeder Monat beginnt auf einer neuen Seite
    text(month.title, { size: 15, bold: true, color: "0.13 0.27 0.82" });
    rule();
    month.days.forEach(day => {
      ensure(44); // Tageskopf nicht allein am Seitenende
      y -= 4;
      text(formatDayLong(day.date), { size: 11, bold: true });
      day.closures.forEach(c => text(`PLATZ GESPERRT | ${c.pitch}${c.reason ? ` – ${c.reason}` : ""}`, { x: margin + 12, color: "0.75 0.22 0.17", bold: true }));
      if (day.entries.length === 0 && day.closures.length === 0) text("keine Buchungen", { x: margin + 12, color: "0.55 0.55 0.55" });
      day.entries.forEach(e => text(entryLine(e), { x: margin + 12 }));
    });
  });

  // Seitenzahlen
  pages.forEach((p, i) => p.push(`BT 0.5 0.5 0.5 rg /F1 8 Tf ${margin} 30 Td (${pdfString(`Platzbelegung ${formatShort(from)} – ${formatShort(to)}`)}) Tj ET`,
    `BT 0.5 0.5 0.5 rg /F1 8 Tf ${pageW - margin - 50} 30 Td (${pdfString(`Seite ${i + 1} von ${pages.length}`)}) Tj ET`));

  // Objekte: 1 Katalog, 2 Seitenbaum, 3/4 Schriften, danach je Seite Seite + Inhalt
  const objects = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((p, i) => {
    const content = p.join("\n");
    objects[pageIds[i]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`;
    objects[pageIds[i] + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  // Inhalt ist reines ASCII (Sonderzeichen oktal maskiert) -> Länge in Zeichen = Bytes
  let out = "%PDF-1.4\n";
  const offsets = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([out], { type: "application/pdf" });
};
