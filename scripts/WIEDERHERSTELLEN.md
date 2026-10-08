# Datensicherung zurückspielen

Für den Notfall, z. B. wenn Platzbuchungen versehentlich gelöscht wurden. Es wird nur zurückgeholt, was du auswählst – alles andere bleibt, wie es ist.

## 1. Sicherung herunterladen

Admin Portal → ⚙ Admin → 💾 Sicherung → bei der gewünschten Sicherung **📥 Herunterladen**.
Es entsteht eine Datei wie `SVON-Sicherung_2026-10-08.json`.

## 2. Google Cloud Shell öffnen

[console.cloud.google.com](https://console.cloud.google.com) → oben Projekt **SVON-Spielticker** wählen → oben rechts das Symbol **>_** („Cloud Shell aktivieren“).

## 3. Werkzeug vorbereiten (einmalig, ca. 1 Minute)

Im Terminal einfügen und Enter drücken:

```
mkdir -p ~/svon-restore && cd ~/svon-restore && npm install --silent firebase-admin@13.10.0 && curl -sO https://raw.githubusercontent.com/IvanTrombino/SVON-Spielticker/main/scripts/restore-backup.mjs && echo BEREIT
```

## 4. Sicherungsdatei hochladen

Im Terminal oben rechts **⋮ → Hochladen** → die heruntergeladene Datei auswählen.
Sie landet im Hauptordner; mit diesem Befehl in den Arbeitsordner holen:

```
cd ~/svon-restore && mv ~/SVON-Sicherung_*.json . && ls
```

## 5. Anschauen, was in der Sicherung ist (ändert nichts)

```
node restore-backup.mjs SVON-Sicherung_2026-10-08.json
```

## 6. Zurückholen

| Was | Befehl |
|---|---|
| Platzbuchungen | `node restore-backup.mjs <datei> --bereich ticker --eintrag svon_bookings` |
| Plätze | `node restore-backup.mjs <datei> --bereich ticker --eintrag svon_pitches` |
| Spielhistorie Ticker | `node restore-backup.mjs <datei> --bereich ticker --eintrag svon_matches` |
| Alle Ticker- und Platzdaten | `node restore-backup.mjs <datei> --bereich ticker` |
| Alle Spieler der Jugenddatenbank | `node restore-backup.mjs <datei> --bereich youth_players` |
| Trainer | `node restore-backup.mjs <datei> --bereich youth_coaches` |
| Trainings | `node restore-backup.mjs <datei> --bereich youth_trainings` |
| Zu-/Absagen | `node restore-backup.mjs <datei> --bereich attendance_events` |
| Sommercamp Kinder / Betreuer / Spenden / Preise | `--bereich summercamp_participants` / `summercamp_staff` / `summercamp_donations` / `summercamp_settings` |
| Alles | `node restore-backup.mjs <datei> --alles` |

Das Skript zeigt zuerst eine **Vorschau** (wie viele Einträge fehlen oder sich geändert haben), speichert dann den **aktuellen Stand** in eine Datei `vor-wiederherstellung-….json` und schreibt erst, wenn du **JA** eintippst.

- Einträge, die erst nach der Sicherung angelegt wurden, **bleiben erhalten**.
- Sollen sie ebenfalls entfernt werden (exakter Stand der Sicherung), zusätzlich `--exakt` anhängen.

## Rückgängig machen

Die Datei `vor-wiederherstellung-….json` hat dasselbe Format wie eine Sicherung:

```
node restore-backup.mjs vor-wiederherstellung-2026-10-08_10-15-00.json --bereich ticker
```

## Falls eine Fehlermeldung zu Anmeldedaten kommt

```
gcloud auth application-default login
```

ausführen, dem Link folgen, mit dem Google-Konto anmelden und den Befehl danach wiederholen.

Nach getaner Arbeit die Dateien wieder löschen (sie enthalten personenbezogene Daten):

```
rm -f ~/svon-restore/*.json
```
