#!/usr/bin/env bash
# Prüft firestore.rules mit dem offiziellen Firestore-Emulator.
# Aufruf: bash tests/run-rules-tests.sh [arbeitsordner]
# Benötigt: Node.js und Java. Pakete und Emulator werden im Arbeitsordner installiert (nicht im Projekt).
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORK_DIR="${1:-${TMPDIR:-/tmp}/svon-rules-test}"
EMULATOR_VERSION="1.19.8"
EMULATOR_MD5="9b43a6daa590678de9b7df6d68260395"
JAR="$WORK_DIR/cloud-firestore-emulator-v$EMULATOR_VERSION.jar"

mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

if [ ! -d node_modules/@firebase/rules-unit-testing ]; then
  npm init -y >/dev/null
  npm install --silent @firebase/rules-unit-testing@3.0.4 firebase@10.14.1
fi

if [ ! -f "$JAR" ] || [ "$(md5sum "$JAR" | cut -d' ' -f1)" != "$EMULATOR_MD5" ]; then
  curl -sL -o "$JAR" "https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v$EMULATOR_VERSION.jar"
  [ "$(md5sum "$JAR" | cut -d' ' -f1)" = "$EMULATOR_MD5" ] || { echo "Prüfsumme des Emulators stimmt nicht"; exit 1; }
fi

cp "$PROJECT_DIR/tests/firestore-rules.test.mjs" "$WORK_DIR/"

java -jar "$JAR" --host 127.0.0.1 --port 8085 > "$WORK_DIR/emulator.log" 2>&1 &
EMULATOR_PID=$!
trap 'kill $EMULATOR_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  grep -q "Dev App Server is now running" "$WORK_DIR/emulator.log" 2>/dev/null && break
  sleep 1
done

node "$WORK_DIR/firestore-rules.test.mjs" "$PROJECT_DIR/firestore.rules" 2>&1 | grep -E "^❌|bestanden"
