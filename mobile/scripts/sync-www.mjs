// Copies the single-file web app (repo root) into mobile/www for Capacitor.
// Run from mobile/:  npm run sync:www   (also runs as part of `npm run sync`)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');   // proready-coach/
const www = path.resolve(here, '..', 'www');   // proready-coach/mobile/www

const FILES = ['index.html', 'desktop.html', 'resume-export.js', 'manifest.webmanifest', 'service-worker.js', 'privacy.html'];
const DIRS = ['icons'];

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

for (const f of FILES) {
  const from = path.join(root, f);
  if (!fs.existsSync(from)) { console.error('MISSING (run from the repo as authored):', from); process.exit(1); }
  fs.copyFileSync(from, path.join(www, f));
  console.log('copied', f);
}
for (const d of DIRS) {
  fs.cpSync(path.join(root, d), path.join(www, d), { recursive: true });
  console.log('copied', d + '/');
}
console.log('www is ready at', www);
