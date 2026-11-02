# Changelog

## 1.3.0 — 2026-11-02

### Resume tab reads PDF uploads
Both the Builder and the Proofreader now accept **.pdf**, so a resume can arrive as a PDF, Word
file, plain text or HTML.

- **New `pdf-text.js` engine** (no dependencies, runs on the device, nothing uploaded). The old
  reader only understood uncompressed streams, which almost no real PDF uses — it failed on
  virtually every file a person actually has. The new one handles:
  - FlateDecode, including ASCII85 / ASCIIHex / RunLength filter chains
  - **object streams and cross-reference streams** (PDF 1.5+, what Word, Google Docs, Canva and
    LaTeX produce)
  - **Type0 subset fonts via ToUnicode CMaps** — this is what stops the “garbage characters”
    that simpler extractors produce
  - multi-page documents in page-tree order
  - WinAnsi/Latin-1 fallback for fonts that ship no ToUnicode map
- **Fallback DEFLATE decoder in pure JavaScript** for browsers without `DecompressionStream`.
  iOS only got that API in 16.4, so without this an older iPhone would fail on any compressed
  PDF. Verified against stored, fixed-Huffman and dynamic-Huffman streams.
- **FileReader fallback** for `Blob.text()`/`arrayBuffer()`, missing on iOS 13 and earlier.
- **Fills the Builder automatically.** Uploading a resume now populates name, headline, email,
  phone, city/state, summary, skills, education and each job with its own bullet points and
  dates — then lets you correct anything.
- **Honest failure messages instead of a dead end.** Password-protected PDFs and scanned /
  photographed PDFs (which contain no text — that needs OCR, which this app deliberately does
  not do) are both named plainly, with the paste-the-text path offered.
- Import asks before overwriting resume content already in the builder, and leaves your data
  untouched if extraction fails.
- New suite `tests/pdf-import.test.js` (29 checks) covers the engine across all PDF variants and
  drives the real upload handler with real PDF bytes.

## 1.2.1 — 2026-11-02

### Interview questions proofread
- **Fixed "the this position position."** When no job title was set, the generator fell back to
  the string `'this position'` and the templates then appended ` position`, so every opening
  question read "your application for the this position position". It now falls back to the
  complete phrase `this position` and composes correctly: "for this position".
- **Titles that already contain a role noun are de-duplicated.** "Store Manager Position" is
  spoken as "Store Manager position", not "Store Manager Position position".
- **A bare generic word is no longer treated as a job title.** Typing "Position" or "Role" now
  falls back to natural phrasing instead of being read back as a job title.
- **No invented company name.** With no company entered, questions say "about the
  organization" rather than implying one exists.
- **Fixed a dangling question** — "regarding this position, this team?" now reads
  "…this team, or Acme Health?" (with "or the organization" when no company is set).
- **Removed a redundant double question.** If a candidate gave no questions of their own at
  the end, Alex asked "Do you have any questions…" immediately followed by the closing
  question that asks the same thing. The follow-up is now skipped when the closing is next.
- **Screener interview** shortens by one question as a result (6 instead of 7 when no
  candidate questions are given); full interviews stay at 13.
- **New suite** `tests/interview-copy.test.js` (24 checks) generates the complete question
  script for blank titles, generic titles, redundant titles and normal titles across all
  three formats, and fails on any repeated or malformed text.

## 1.2.0 — 2026-11-01

### Voice input now works in the native iOS/Android builds
- **`voice-adapter.js`** — one speech interface for three environments: Web Speech API in
  browsers, `@capacitor-community/speech-recognition` + `text-to-speech` on device. Chooses
  by **platform and plugin availability, never by feature detection**, because iOS WKWebView
  exposes `webkitSpeechRecognition` but does not implement it (WebKit bug 239816).
- Native plugins installed and synced: speech-recognition **7.0.1**, text-to-speech
  **6.1.0** (both Capacitor 7 compatible — text-to-speech 8.x requires Capacitor 8).
- **Android `<queries>` entry for `android.speech.RecognitionService`** added. Without it
  Android 11+ hides the recognizer service and voice silently reports unavailable.
- Interviewer audio now routes through the adapter, so Alex speaks on device via native TTS
  instead of failing silently.
- Microphone permission handling surfaces a real message ("permission was declined …")
  instead of a dead button.
- Plugin registration uses a `ProReadyNative` namespace so the standard
  `window.SpeechRecognition` global is never overwritten.
- The on-screen capability notice re-evaluates after plugins register, so the app no longer
  claims voice is unavailable when it is about to become available.
- **Tests:** `tests/adapter.test.js` (15 unit checks across browser/Android/iOS/permission
  paths) and `tests/voice-integration.test.js` (21 checks driving the real app with faked
  native plugins). Suite total now runs four groups, all passing.

## 1.1.0 — 2026-10-31

Response to the panel review (`PANEL_REVIEW.md`). Every item below is covered by an
automated test in `tests/`.

### Added
- **Real PDF and Word export** (`resume-export.js`). PDF is written directly (no library,
  paginates at Letter size, embeds Helvetica, maps bullets and dashes to WinAnsi so they
  print correctly). DOCX is a valid WordprocessingML package built with a hand-rolled ZIP
  writer. Plus plain text and a print stylesheet. The old HTML download is gone.
- **Reports export as PDF** — the mock interview report and the proofreading report.
- **Desktop Resume Studio** (`desktop.html`) — a three-column desktop web version:
  editor · live page preview · score + export. Self-contained single file, with its own
  storage key, a quick proofread tab, and a page-length estimate.
- **Backup, restore and erase** in both versions. One click writes a JSON file; restore
  reads it back; erase clears everything after a confirmation.
- **Score explainers** under every number — what it measures, and an explicit statement
  that it is not a prediction from any employer or applicant tracking system.
- **Privacy notice at the point of use** — the camera/mic area now states that video is
  never recorded or uploaded, and that voice answers may use the browser's speech service.
- **Capability honesty** — if speech recognition or speech synthesis is unavailable (for
  example inside the native app shell), the app says so and explains the typing path
  instead of failing silently.
- **Version stamp** — `v1.1.0` in the footer and `app-version` meta tag.
- **Test suite** — `tests/` with export-engine structural tests (PDF/XREF/WinAnsi/DOCX
  package assertions, pagination), full-app jsdom regression, and desktop jsdom regression.
  Run with `npm test`.
- **Build tooling** — `tools/sync_export.py` re-inlines the export engine into both pages
  from the single source of truth.

### Accessibility (WCAG 2.1 AA pass)
- All 33 form controls are now labelled (`label for=` pairing, with `aria-label`
  fallbacks). Previously 0 of 32 were explicitly associated.
- Live regions: resume strength, proofreading results, interview question caption,
  interview transcript, report, and a global toast (`role="status"`).
- Skip-to-content link, `main` landmark (`tabindex="-1"`), labelled regions for the
  preview and results.
- Visible `:focus-visible` ring on every control; `prefers-reduced-motion` support.
- Corrected an earlier audit: all 47 `onclick` handlers were already on real `<button>`
  elements, so keyboard activation was never broken — the unlabelled fields were the real
  defect.

### Integrity
- Suggested rewrites now use bracketed prompts (`[how many / how often / what changed]`)
  instead of implying a figure, with an explicit "add only numbers you can prove" notice.

### Changed
- Footer no longer calls the product a prototype and drops the stale README roadmap note.
- Export toolbar replaces the single download button: PDF · Word · Plain text · Print.

### Still open (tracked, not in this release)
- Native speech plugins for the iOS/Android build (`APP_STORE_GUIDE.md` → Phase 2).
- Companion PDF/DOCX readers for `.pdf` intake are still basic (paste fallback).
- Institutional features: coach dashboard, cohort reporting, CSV export, Spanish, SSO.
- Monetization plumbing: entitlements, restore purchases, activation telemetry.

## 1.0.0 — earlier
- Five-step journey: target job, resume builder + proofreader, prep school, formal staged
  mock interview, follow-up. Warm Coach theme. Installable PWA. Capacitor wrapper for
  iOS/Android with store assets.
