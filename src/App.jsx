import { useEffect, useState } from "react";
 
export default function App() {
const [heim, setHeim] = useState("SV Orsingen-Nenzingen");
const [gast, setGast] = useState("Gegner");
const [svonSeite, setSvonSeite] = useState("heim");
 
const [heimTore, setHeimTore] = useState(0);
const [gastTore, setGastTore] = useState(0);
 
const [spieler, setSpieler] = useState("");
const [neuerSpieler, setNeuerSpieler] = useState("");
const [spielerliste, setSpielerliste] = useState([]);
 
const [kaderOffen, setKaderOffen] = useState(false);
 
const [sekunden, setSekunden] = useState(0);
const [laeuft, setLaeuft] = useState(false);
const [halbzeit, setHalbzeit] = useState(1);
 
const [ereignisse, setEreignisse] = useState([]);
 
useEffect(() => {
let timer;
 
if (laeuft) {
timer = setInterval(() => {
setSekunden((s) => s + 1);
}, 1000);
}
 
return () => clearInterval(timer);
}, [laeuft]);
 
const zeit = () => {
const min = Math.floor(sekunden / 60);
const sec = sekunden % 60;
 
return `${String(min).padStart(2, "0")}:${String(sec).padStart(
2,
"0"
)}`;
};
 
const ereignisHinzufuegen = (typ, team = "") => {
const eintrag = {
typ,
team,
zeit: zeit(),
text:
`${typ}` +
(spieler ? ` - ${spieler}` : "") +
(team ? ` (${team})` : ""),
};
 
setEreignisse((alt) => [eintrag, ...alt]);
setSpieler("");
};
 
const tor = (team) => {
if (team === "heim") {
setHeimTore((v) => v + 1);
ereignisHinzufuegen("⚽ Tor", heim);
} else {
setGastTore((v) => v + 1);
ereignisHinzufuegen("⚽ Tor", gast);
}
};
 
const spielerLoeschen = (name) => {
setSpielerliste(
spielerliste.filter(
(spielername) => spielername !== name
)
);
 
if (spieler === name) {
setSpieler("");
}
};
 
const neuesSpiel = () => {
setHeimTore(0);
setGastTore(0);
setSekunden(0);
setLaeuft(false);
setHalbzeit(1);
setSpieler("");
setEreignisse([]);
};
 
const rueckgaengig = () => {
if (ereignisse.length === 0) return;
 
const letztes = ereignisse[0];
 
if (letztes.typ === "⚽ Tor") {
if (letztes.team === heim) {
setHeimTore((v) => Math.max(0, v - 1));
}
 
if (letztes.team === gast) {
setGastTore((v) => Math.max(0, v - 1));
}
}
 
setEreignisse((alt) => alt.slice(1));
};
 
return (
<div
style={{
maxWidth: "500px",
margin: "0 auto",
padding: "15px",
fontFamily: "Arial",
}}
>
<h1
style={{
textAlign: "center",
color: "#2146d0",
}}
>
⚽ SVON Spielticker
</h1>
 
<input
value={heim}
onChange={(e) => setHeim(e.target.value)}
style={{
width: "100%",
padding: 15,
marginBottom: 10,
borderRadius: 10,
boxSizing: "border-box",
}}
/>
 
<input
value={gast}
onChange={(e) => setGast(e.target.value)}
style={{
width: "100%",
padding: 15,
marginBottom: 15,
borderRadius: 10,
boxSizing: "border-box",
}}
/>
 
<div
style={{
display: "flex",
gap: 10,
marginBottom: 20,
}}
>
<button
onClick={() => setSvonSeite("heim")}
style={{
flex: 1,
padding: 12,
border: 0,
borderRadius: 10,
color: "white",
background:
svonSeite === "heim"
? "#2146d0"
: "#94a3b8",
}}
>
SVON = Heim
</button>
 
<button
onClick={() => setSvonSeite("gast")}
style={{
flex: 1,
padding: 12,
border: 0,
borderRadius: 10,
color: "white",
background:
svonSeite === "gast"
? "#2146d0"
: "#94a3b8",
}}
>
SVON = Gast
</button>
</div>
 
<div style={{ textAlign: "center" }}>
<div
style={{
fontSize: 60,
fontWeight: "bold",
color: "#2146d0",
}}
>
{heimTore} : {gastTore}
</div>
 
<div
style={{
marginTop: 10,
fontWeight: "bold",
fontSize: 20,
}}
>
Halbzeit {halbzeit}
</div>
 
<div
style={{
marginTop: 10,
fontSize: 40,
fontWeight: "bold",
}}
>
{zeit()}
</div>
</div>
 
<div
style={{
display: "flex",
gap: 8,
flexWrap: "wrap",
justifyContent: "center",
marginTop: 15,
marginBottom: 20,
}}
>
<button onClick={() => setLaeuft(true)}>▶ Start</button>
<button onClick={() => setLaeuft(false)}>⏸ Pause</button>
<button
onClick={() =>
setHalbzeit((h) => (h === 1 ? 2 : 1))
}
>
🏁 Halbzeit
</button>
</div>
 
<button
onClick={() => setKaderOffen(!kaderOffen)}
style={{
width: "100%",
padding: 12,
marginBottom: 15,
borderRadius: 10,
}}
>
👥 Kader verwalten
</button>
 
{kaderOffen && (
<>
<input
placeholder="Neuer Spieler"
value={neuerSpieler}
onChange={(e) =>
setNeuerSpieler(e.target.value)
}
style={{
width: "100%",
padding: 15,
borderRadius: 10,
marginBottom: 10,
boxSizing: "border-box",
}}
/>
 
<button
style={{
width: "100%",
padding: 12,
marginBottom: 15,
}}
onClick={() => {
if (
neuerSpieler &&
!spielerliste.includes(
neuerSpieler
)
) {
setSpielerliste([
...spielerliste,
neuerSpieler,
]);
setNeuerSpieler("");
}
}}
>
➕ Spieler hinzufügen
</button>
 
<h3>Kader heute</h3>
 
{spielerliste.map((name) => (
<div
key={name}
style={{
display: "flex",
justifyContent:
"space-between",
alignItems: "center",
border: "1px solid #ddd",
padding: 10,
borderRadius: 10,
marginBottom: 5,
}}
>
<span>{name}</span>
 
<button
onClick={() =>
spielerLoeschen(name)
}
style={{
background: "#dc2626",
color: "white",
border: 0,
borderRadius: 8,
}}
>
❌
</button>
</div>
))}
</>
)}
 
<select
value={spieler}
onChange={(e) => setSpieler(e.target.value)}
style={{
width: "100%",
padding: 15,
borderRadius: 10,
marginBottom: 20,
}}
>
<option value="">
Spieler auswählen
</option>
 
{spielerliste.map((name) => (
<option
key={name}
value={name}
>
{name}
</option>
))}
</select>
 
<div
style={{
display: "flex",
gap: 8,
justifyContent: "center",
flexWrap: "wrap",
marginBottom: 20,
}}
>
<button onClick={() => ereignisHinzufuegen("🟨 Gelbe Karte")}>
🟨 Gelb
</button>
 
<button onClick={() => ereignisHinzufuegen("🟨🟥 Gelb-Rot")}>
🟨🟥 Gelb-Rot
</button>
 
<button onClick={() => ereignisHinzufuegen("🟥 Rote Karte")}>
🟥 Rot
</button>
</div>
 
<button
onClick={() => tor(svonSeite)}
style={{
width: "100%",
padding: 24,
fontSize: 24,
background: "#2146d0",
color: "white",
border: 0,
borderRadius: 12,
marginBottom: 10,
}}
>
⚽ SVON TOR
</button>
 
<button
onClick={() =>
tor(
svonSeite === "heim"
? "gast"
: "heim"
)
}
style={{
width: "100%",
padding: 24,
fontSize: 24,
background: "#dc2626",
color: "white",
border: 0,
borderRadius: 12,
marginBottom: 10,
}}
>
⚽ GEGNER TOR
</button>
 
<button
onClick={rueckgaengig}
style={{
width: "100%",
padding: 14,
background: "#f59e0b",
color: "white",
border: 0,
borderRadius: 12,
marginBottom: 10,
}}
>
↩ Letztes Ereignis zurück
</button>
 
<button
onClick={neuesSpiel}
style={{
width: "100%",
padding: 14,
background: "#475569",
color: "white",
border: 0,
borderRadius: 12,
}}
>
🔄 Neues Spiel
</button>
 
<h2
style={{
textAlign: "center",
marginTop: 30,
}}
>
📋 Spielereignisse
</h2>
 
{ereignisse.map((e, i) => (
<div
key={i}
style={{
border: "1px solid #ddd",
borderRadius: 10,
padding: 10,
marginBottom: 5,
}}
>
<strong>{e.zeit}</strong> • {e.text}
</div>
))}
</div>
);
}