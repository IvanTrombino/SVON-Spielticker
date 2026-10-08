import { LEGAL } from "../legal";

const missing = <em style={{ color: "#b9770e" }}>Angabe folgt</em>;
const value = (v) => v || missing;

const h = { color: "#2146d0", fontSize: "15px", margin: "18px 0 6px 0" };
const pStyle = { margin: "0 0 8px 0" };

function Impressum() {
  return (
    <>
      <h3 style={h}>Angaben gemäß § 5 DDG</h3>
      <p style={pStyle}>
        <strong>{LEGAL.clubName}</strong><br />
        {value(LEGAL.address)}
      </p>
      <p style={pStyle}><strong>Vertreten durch:</strong> {value(LEGAL.representedBy)}</p>
      <p style={pStyle}><strong>Registereintrag:</strong> {value(LEGAL.register)}</p>
      <p style={pStyle}>
        <strong>Kontakt:</strong> {value(LEGAL.email)}
        {LEGAL.phone && <><br />Telefon: {LEGAL.phone}</>}
      </p>

      <h3 style={h}>Verantwortlich für den Inhalt</h3>
      <p style={pStyle}>{value(LEGAL.representedBy)} (Anschrift wie oben)</p>

      <h3 style={h}>Umsetzung der App</h3>
      <p style={pStyle}>{LEGAL.appCreator}</p>
    </>
  );
}

function Datenschutz() {
  return (
    <>
      <p style={{ ...pStyle, color: "#888", fontSize: "12px" }}>Stand: {LEGAL.lastUpdated}</p>

      <h3 style={h}>1. Verantwortlicher</h3>
      <p style={pStyle}>
        {LEGAL.clubName}, {value(LEGAL.address)}<br />
        Vertreten durch: {value(LEGAL.representedBy)}<br />
        Kontakt: {value(LEGAL.email)}
        {LEGAL.privacyContact && <><br />Ansprechpartner Datenschutz: {LEGAL.privacyContact}</>}
      </p>

      <h3 style={h}>2. Live-Ticker für Zuschauer</h3>
      <p style={pStyle}>
        Die Zuschauer-Ansicht kann ohne Anmeldung genutzt werden. Dabei werden keine Konten angelegt und keine Tracking- oder Analysedienste eingesetzt.
        Beim Aufruf verarbeitet unser Hosting-Anbieter technisch notwendige Verbindungsdaten (z. B. IP-Adresse, Zeitpunkt, aufgerufene Seite), um die App auszuliefern (Art. 6 Abs. 1 lit. f DSGVO).
      </p>
      <p style={pStyle}>
        Im Live-Ticker werden Spielereignisse veröffentlicht. Namen von Spielerinnen und Spielern erscheinen nur, wenn eine Einwilligung zur Namensnennung vorliegt (Art. 6 Abs. 1 lit. a DSGVO, bei Minderjährigen durch die Erziehungsberechtigten); andernfalls werden nur Initialen angezeigt.
      </p>

      <h3 style={h}>3. Lokale Speicherung im Browser</h3>
      <p style={pStyle}>
        Die App speichert im Browser (Local Storage) den zuletzt gewählten Verein und die zuletzt geöffnete Ansicht. Bei Anmeldung wird außerdem die Anmeldesitzung gespeichert.
        Diese Daten verbleiben auf Ihrem Gerät und dienen nur der Funktion der App (§ 25 Abs. 2 TDDDG).
      </p>

      <h3 style={h}>4. Trainer-, Ticker- und Admin-Bereich</h3>
      <p style={pStyle}>
        Für Trainer und Administratoren verarbeiten wir E-Mail-Adresse und Anmeldedaten, um den Zugang zu ermöglichen (Art. 6 Abs. 1 lit. b und f DSGVO).
        Wer den Live-Ticker mit einem Tagescode bedient, wird anonym angemeldet; dabei werden keine Namen oder E-Mail-Adressen erfasst.
      </p>

      <h3 style={h}>5. Mitgliederverwaltung der Jugendabteilung</h3>
      <p style={pStyle}>
        Zur Organisation des Spiel- und Trainingsbetriebs verarbeiten wir Stammdaten der Spielerinnen und Spieler (Name, Geburtsdatum, Mannschaft, Passnummer, Anschrift, Kontaktdaten der Erziehungsberechtigten),
        Trainingsanwesenheiten sowie Angaben zur Abmeldung (Art. 6 Abs. 1 lit. b DSGVO i. V. m. der Mitgliedschaft).
      </p>
      <p style={pStyle}>
        Freiwillige Angaben zu Allergien, Medikamenten oder gesundheitlichen Einschränkungen sind Gesundheitsdaten (Art. 9 DSGVO). Sie werden nur mit ausdrücklicher Einwilligung der Erziehungsberechtigten gespeichert (Art. 9 Abs. 2 lit. a DSGVO)
        und sind nur für die Administratoren sowie die Trainer der jeweiligen Mannschaft sichtbar.
      </p>
      <p style={pStyle}>
        Die Daten werden gelöscht, sobald sie für die genannten Zwecke nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten bestehen.
      </p>

      <h3 style={h}>6. Eingesetzte Dienstleister</h3>
      <ul style={{ margin: "0 0 8px 0", paddingLeft: "18px" }}>
        <li><strong>Google Firebase</strong> (Google Ireland Ltd.) – Datenbank und Anmeldung. Auftragsverarbeitung nach Art. 28 DSGVO.</li>
        <li><strong>Vercel</strong> (Vercel Inc., USA) – Hosting der App. Eine Übermittlung in die USA erfolgt auf Grundlage geeigneter Garantien (z. B. EU-US Data Privacy Framework bzw. Standardvertragsklauseln).</li>
        <li><strong>ntfy.sh</strong> – Push-Benachrichtigungen zu Toren, Karten, Platzkonflikten, Platzsperren und Infos für Trainer. Benachrichtigungen erhält nur, wer den jeweiligen Kanal selbst abonniert.</li>
        <li><strong>fussball.de</strong> – Abruf öffentlicher Spielpläne über unseren Server. Dabei werden keine Daten der App-Nutzer an fussball.de übermittelt.</li>
        <li><strong>WhatsApp / E-Mail</strong> – Inhalte werden nur geteilt, wenn Sie dies selbst über die Teilen-Funktion auslösen.</li>
      </ul>

      <h3 style={h}>7. Ihre Rechte</h3>
      <p style={pStyle}>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO).
        Eine erteilte Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen. Wenden Sie sich dazu an: {value(LEGAL.email)}.
      </p>
      <p style={pStyle}>
        Sie haben außerdem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, z. B. beim Landesbeauftragten für den Datenschutz und die Informationsfreiheit Baden-Württemberg.
      </p>
    </>
  );
}

// Impressum / Datenschutz als Overlay
export default function LegalPage({ page, onChange, onClose }) {
  if (!page) return null;
  const tabStyle = (active) => ({ flex: 1, padding: "10px", border: "none", borderRadius: "8px", background: active ? "#2146d0" : "#e0e7ff", color: active ? "white" : "#3730a3", fontWeight: "bold", cursor: "pointer", fontSize: "13px" });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000, padding: "15px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: "10px", padding: "18px", width: "100%", maxWidth: "640px", maxHeight: "90vh", overflowY: "auto", textAlign: "left", color: "#333", fontFamily: "sans-serif", fontSize: "13px", lineHeight: 1.5, boxShadow: "0 6px 20px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <button onClick={() => onChange("impressum")} style={tabStyle(page === "impressum")}>Impressum</button>
          <button onClick={() => onChange("datenschutz")} style={tabStyle(page === "datenschutz")}>Datenschutz</button>
          <button onClick={onClose} style={{ padding: "10px 14px", border: "none", borderRadius: "8px", background: "#eee", cursor: "pointer", fontWeight: "bold" }}>✕</button>
        </div>
        {page === "impressum" ? <Impressum /> : <Datenschutz />}
      </div>
    </div>
  );
}

// Fußzeile mit Links (Startseite, Vereinsauswahl, Zuschauer-Ansicht)
export function LegalFooter({ onOpen }) {
  const link = { background: "none", border: "none", color: "#2146d0", textDecoration: "underline", cursor: "pointer", fontSize: "12px", padding: 0 };
  return (
    <div style={{ textAlign: "center", fontSize: "12px", color: "#888", padding: "20px 10px 10px 10px", fontFamily: "sans-serif" }}>
      <button onClick={() => onOpen("impressum")} style={link}>Impressum</button>
      {" · "}
      <button onClick={() => onOpen("datenschutz")} style={link}>Datenschutz</button>
      <div style={{ marginTop: "4px" }}>App: {LEGAL.appCreator}</div>
    </div>
  );
}
