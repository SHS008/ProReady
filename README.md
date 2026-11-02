# ProReady Coach — Resume & Interview Prep App

A working prototype for professional job seekers of **all experience levels** (no college degree required). Built around your 4 choices: mixed audience · all-in-one journey · video-chat AI interview · tailored to any job the user enters.

## Run it
Open the live preview, or locally:
```bash
cd proready-coach
python3 -m http.server 8080 --bind 0.0.0.0
# then visit http://localhost:8080
```
Best in Chrome/Edge (voice answers use the browser's Speech Recognition). Typing works everywhere.

## What the user does (5 steps)
1. **Target Job** — Enter a job title/company, paste a real posting, pick strengths & worries. App extracts ATS keywords and tailors everything after.
2. **Resume Builder & Proofreader** — Two modes (tabs at the top of Step 2):
   - **Build:** guided form (contact, summary generator, experience, skills, education/certs/training) with live preview, **Resume Strength score + checklist**, **ATS keyword match** (found/missing), action-verb bank, download/print. Try **"Load Example"**: a retail shift lead in Escanaba applying to be a Medical Office Assistant.
   - **Proofread My Existing Resume:** submit a current resume (upload .docx/.txt/.html, basic .pdf attempt, or paste text — all processed in-browser, nothing uploaded) for a full evaluation: overall + 5 category scores (Spelling & Mechanics, Structure, Impact & Evidence, ATS & Tailoring, Professionalism & Safety), **prioritized fix list**, strengths, finding cards with fixes (common misspellings, duty language, unquantified bullets, missing sections/dates, SSN/address red flags, "references available" etc.), keyword panel vs. the Step 1 posting, **line-by-line notes, suggested rewrites**, downloadable/copyable report, and **Send to Resume Builder** (detects and imports name/contact/summary/skills/education/experience). Includes a deliberately flawed sample resume to demo the feedback.
3. **Prep School** — Professional Do's & Don'ts, what to wear, body language, video-interview tips, common questions (tailored) with no-degree-needed example answers, **STAR Answer Trainer**, questions to ask them, interactive **Do/Don't quiz**.
4. **AI Video Mock Interview (v3 — staged & adaptive, built to feel like a real interview):**
   - **Full arc, not trivia:** a formal opening directly into the elevator intro → why this job/company → **walk-through of the candidate's actual work history from Step 2** (Alex names their real roles/employers/dates) → prove-the-skills questions from the posting → 2 behavioral STAR stories → a **role-tailored realistic scenario** (clinic front desk, bank line, supervisor call-off, etc.) → practical fit → **candidate's questions** → 30-second closing pitch → next-steps close
   - **Alex reacts:** thin/vague answers trigger in-character follow-ups ("Can you give me a specific example?", "And how did that turn out?", "What was *your* specific part?"), strong answers can earn one "You mentioned X — tell me more" detail probe; natural bridges between questions
   - **Formats:** 📞 Phone Screen (~10 min), 🎥 Full Interview (~20 min), 🏁 Final Round (+ first-90-days / exact-match challenge); formal throughout; style setting controls follow-up depth only
   - **Modes:** 🎬 Real Mode (Alex stays in character — feedback only in the report, like real life) or 🧭 Coaching Mode (tip after each answer)
   - Camera on (browser permission), answer by voice (Chrome/Edge) or typing, **📝 live notepad** throughout, per-stage timing guidance
   - **Report is scored by interview phase** (Arrival, Intro/Elevator, Motivation, Work History, Skills, Behavioral, Scenario Judgment, Practical Fit, Your Questions, Closing) with phase-specific practice advice + full transcript, downloadable
5. **Follow-Up** — Night-before/day-of checklists, tough-moments scripts (gap, no degree, salary, job loss), **thank-you email generator**.

Progress ("Ready score") persists in the browser via localStorage.

## Privacy (important for this audience)
Camera/mic streams never leave the browser in this prototype. Nothing is uploaded or recorded. State is localStorage only.

## Roadmap to a production AI version
This prototype simulates the AI in-browser (heuristics + Web Speech APIs) so it works with zero keys/cost. To go production:

| Now (prototype) | Production upgrade |
|---|---|
| Browser TTS asks fixed tailored questions | **OpenAI Realtime / Gemini Live** (or Daily/Tavus avatar) for true two-way voice conversation with follow-up questions |
| Browser speech recognition | **Whisper / Deepgram** for accurate transcripts + filler/pace analysis |
| Heuristic scoring (length, fillers, STAR keywords) | **LLM rubric scoring** (GPT/Claude) that quotes the answer and gives rewrites |
| SVG avatar | Talking-head avatar (Tavus, HeyGen, D-ID) or keep audio-first for lower anxiety/data use |
| localStorage | Accounts + saved resumes/reports (Supabase/Firebase), employer/workforce-center dashboards |
| Print/download HTML resume | Real PDF (react-pdf) + DOCX templates, LinkedIn headline helper |

Suggested next features: Spanish language toggle, offline/low-bandwidth text mode, Michigan Works! / workforce-center cohort mode, accessibility audit (screen-reader + captions), salary-range lookup per occupation (BLS data).

## Design — "Warm Coach" (locked, chosen)
After A/B/C testing of 3 concepts, the owner picked **A · Warm Coach**; the picker and other themes have been removed.
- **Palette:** warm cream page (`#F9E9D2`), cream-paper cards (`#FFFDF8`), terracotta CTA (`#C75B39`), sage green (`#5F7161`), deep warm brown ink/headings (`#432818`), peach highlight (`#FFC98A`). AI video stage is espresso brown (`#2B1A10`).
- **Type:** Georgia (serif) display headings + system sans body — mentor-like, deliberately *not* corporate/collegiate.
- **Layout:** narrow (1000px) centered column, hero centered, journey as a single-column guided path, soft 24px corners, gentle warm shadows, sage card-top accents + terracotta header stripe.
- To re-color later: edit the CSS variables in `html[data-theme="coach"]` at the top of the `<style>` block.
- Storage goes through `SafeStore` (head script): real localStorage when available, in-memory fallback in sandboxed previews — storage blocking can never crash the app.

## Files
- `index.html` — the entire app (no build step, no external CDNs; works offline once loaded except speech recognition)

## Installable app & store builds (iOS / Android)

The app is PWA-ready (`manifest.webmanifest`, `service-worker.js`, `icons/`) — it can be installed to a phone home screen from any HTTPS host today. `privacy.html` is a public privacy policy that both stores require. The `mobile/` folder is a Capacitor 7 wrapper that packages the same `index.html` as native iOS and Android apps: Android and iOS projects are already generated and branded (icons + splashscreens), Android targets API 36 and has camera/mic permissions plus optional release signing, and iOS has the required privacy usage strings.

```bash
cd mobile
npm install
npm run sync        # copies ../index.html + icons into www and both native projects
npx cap open android   # or: npx cap open ios   (needs a Mac + Xcode)
```

Full instructions, costs, timelines, store-listing copy, privacy declarations, and rejection risks: **`APP_STORE_GUIDE.md`**. Signing key steps: `mobile/SIGNING.md`. Platform permissions: `mobile/native-config/PERMISSIONS.md`.

**Note on native speech:** spoken answers use the browser SpeechRecognition API, which mobile WebViews don't provide. As of v1.1.0 the app **detects this and says so** — candidates type answers, with an on-screen explanation, until the optional native speech plugins are added (Phase 2 in the guide). Desktop/mobile browsers keep full voice support.

## Files
- `index.html` — the entire app (inline CSS/JS, no CDN).
- `manifest.webmanifest`, `service-worker.js`, `icons/` — installable-web-app support and offline caching.
- `privacy.html` — privacy policy page to host publicly for the stores.
- `mobile/` — Capacitor native wrapper (config, sync script, Android & iOS projects, app icon/splash sources).
- `APP_STORE_GUIDE.md` — iOS/Android publication guide.

## Resume documents: PDF, Word, text, print (v1.1.0)

Both versions produce real documents, generated entirely in the browser:

| Format | Use it when |
|---|---|
| **PDF** | Applying. Written directly by `resume-export.js` — Letter size, real pagination, embedded Helvetica, bullets and dashes correctly encoded (WinAnsi). |
| **Word (.docx)** | A recruiter or agency asks for an editable file. A valid OOXML package (verified by strict readers). |
| **Plain text** | Pasting into application forms that strip formatting. |
| **Print** | A paper copy, or "print to PDF" with your own margins. |

`resume-export.js` is the single source of truth for all output and is inlined into both
pages by `tools/sync_export.py`. There are **no external libraries** — the PDF writer and
the ZIP/DOCX writer are built in, so everything works offline, inside the Capacitor shell,
and from `file://`.

## Two front ends

- **`index.html`** — the full guided journey (target job → resume + proofreader → prep
  school → mock interview → follow-up) plus every export format. Mobile-first; this is what
  ships in the App Store / Play Store build.
- **`desktop.html`** — **Desktop Resume Studio**, a web page for people working on a
  computer: three columns (editor · live page preview · score and export), a quick
  proofread tab, page-length estimate, and the same PDF/Word/text/print exports. Single
  self-contained file; open it directly or from the footer link in the main app.

## Data safety

Work is saved in the browser only. Both versions include **back up / restore / erase** —
a one-click JSON file. This exists because local-only storage means cleared browser data
would otherwise destroy everything (a top complaint about competing tools).

## Tests

```bash
npm install        # jsdom, for the browser tests
npm test           # or: bash tests/run-all.sh
```
`tests/export.test.js` asserts the PDF is structurally valid (header, XREF, pagination,
WinAnsi glyph mapping) and that the DOCX zip contains a real WordprocessingML package.
`tests/app.test.js` and `tests/desktop.test.js` drive both UIs in jsdom: export flows,
backup/restore, proofreader, interview start, accessibility labelling, and zero JS errors.

## Voice in the native app (v1.2.0)

`voice-adapter.js` is the single speech interface:
- **Browser** → Web Speech API (Chrome/Edge/Safari).
- **iOS/Android app** → `@capacitor-community/speech-recognition` for answers and
  `@capacitor-community/text-to-speech` for the interviewer's voice.
- **Detection uses platform + plugin availability, never feature detection.** iOS WKWebView
  exposes `webkitSpeechRecognition` but leaves it non-functional, so the usual
  `if (window.webkitSpeechRecognition)` check gives a false positive. When the plugins are
  missing the adapter reports `native-without-plugin` and the UI says so plainly.

Required native config (already applied): Android `RECORD_AUDIO` + a `<queries>` entry for
`android.speech.RecognitionService` (Android 11+ hides it otherwise), and iOS
`NSSpeechRecognitionUsageDescription` / `NSMicrophoneUsageDescription`.

## Release notes

See **`CHANGELOG.md`** — v1.1.0 addresses the panel review in `PANEL_REVIEW.md`
(PDF/DOCX export, accessibility pass, backup/restore, score honesty, version stamp,
test suite) and adds the desktop studio.
