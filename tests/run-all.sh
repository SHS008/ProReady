#!/usr/bin/env bash
# ProReady Coach test suite. Start the app first:  python3 -m http.server 8080 --bind 0.0.0.0
set -u
cd "$(dirname "$0")/.."
fail=0
echo "== export engine =="
node tests/export.test.js || fail=1
echo "== app (index.html) =="
node tests/app.test.js || fail=1
echo "== speech adapter =="
node tests/adapter.test.js || fail=1
echo "== voice handling =="
node tests/voice.test.js || fail=1
echo "== voice integration (app + native plugins) =="
node tests/voice-integration.test.js || fail=1
echo "== pdf import =="
node tests/pdf-import.test.js || fail=1
echo "== interview question copy =="
node tests/interview-copy.test.js || fail=1
echo "== desktop studio =="
node tests/desktop.test.js || fail=1
if [ $fail -eq 0 ]; then echo "ALL SUITES PASS"; else echo "SOME SUITES FAILED"; fi
exit $fail
