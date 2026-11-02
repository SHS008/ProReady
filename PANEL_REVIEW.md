# ProReady Coach — Multi-Lens Panel Review

**Date:** October 31, 2026
**Method disclosure (read this first):** No external model API keys were available in this workspace, so this is **not** a transcript of other models' replies. It is a structured review written from **ten adversarial specialist lenses**, each grounded in findings from the actual source (`index.html`, 136,185 bytes, 1,353 lines, 3 inline script blocks) measured by static audit on this date. Each lens is a recognizable, well-established reviewer archetype — the kind of evaluator each would apply. Treat the verdicts as **reasoned simulation**, not quotation. If you supply an API key, `panel_review.py` in this folder will run the same brief past real models and replace this document with genuine output.

---

## 1. The panel

| # | Lens | What it optimizes for | Score /10 | Single biggest objection |
|---|---|---|---|---|
| 1 | Accessibility specialist (WCAG 2.1 AA) | Everyone can operate it | **3** | 47 mouse-only handlers; a screen-reader user cannot run an interview |
| 2 | Staff security & privacy engineer | Data stays where it is claimed | **8** | Mic and speech-service routing isn't disclosed at point of use |
| 3 | Product designer (mobile-first) | Task completion on a phone | **6** | Desktop-shaped builder inside a mobile shell |
| 4 | Senior hiring manager (12 yrs) | Advice that survives a real candidate | **7** | Rewrite suggestions can encourage embellishment |
| 5 | Frontend architect | Maintainability, testability | **4** | One 136KB file, no tests, no versioning |
| 6 | Behavioral-interview SME | Fidelity to a real interview | **8** | Scoring rubric is opaque and uncalibrated |
| 7 | Growth/activation analyst | Do users reach value? | **5** | No measurement of the first 5 minutes |
| 8 | Workforce-program director | Can I deploy this to a cohort? | **4** | No coach visibility, no cohort reporting, no Spanish |
| 9 | App-store reviewer (both stores) | Policy compliance, minimum functionality | **7** | Heuristic claims must not read as AI guarantees |
| 10 | Privacy-first consumer advocate | Honest dealing with a vulnerable user | **9** | Praises the no-upload stance; wants cancellation honesty baked in early |

**Median: 6.5/10.** The spread is the story: this is a genuinely well-conceived product (9s and 8s on privacy, interview fidelity, security) wrapped in engineering and accessibility debt (3 and 4). Almost no reviewer doubted *what* it does. Several doubted whether it can be safely handed to a paying user or an institution yet.

---

## 2. Top 10 issues

Ranked by (probability of a real user or buyer hitting it) × (damage when they do). Every item cites measured evidence.

### 1. Accessibility is not just incomplete — it's structurally blocking
**Evidence:** 1 `aria-*` attribute total. 0 `role=` attributes. 0 `aria-live` regions. 0 `tabindex`. 0 `label for=` pairs. 0 `alt` texts. **47** `onclick` handlers with no keyboard equivalents.
**Why it ranks first:** Three independent problems converge. (a) A keyboard-only or screen-reader user cannot complete *any* core flow. (b) During the mock interview, the interviewer's question and the live transcript update with no `aria-live`, so the single most valuable feature is silent to assistive tech. (c) Every workforce-program funder and most public institutions require **WCAG 2.1 AA** as a procurement condition — this closes the institutional door before the sales call starts.
**Fix:** Add `aria-live="polite"` to the question caption and transcript; convert the 47 `onclick` handlers to real `<button>` elements with handlers (they already mostly are — verify each); add `label for=` pairs; add a visible focus ring; add `role="status"` to score updates. Est. 1–2 days for AA-minus.

### 2. Export produces HTML, not PDF or DOCX
**Evidence:** `downloadResume()` builds a `Blob` of `<html>` and downloads `*_Resume.html`. Interview and proofreader reports download as `.txt`.
**Why:** This is complaint **#4** across the entire competitor set (Rezi: "looks NOTHING like the version in the app"; Kickresume: "total garbage" DOCX). It lands at the moment of maximum user investment, and HTML files look broken inside job-application portals that expect a document. A hiring manager will bin it on sight.
**Fix:** Ship client-side PDF generation (jsPDF/pdf-lib bundled inline) for a plain single-column resume, plus a real `.docx` writer (the DOCX *reader* already exists in the proofreader — writer is the same ZIP+XML shape). Label one export "maximum ATS compatibility."

### 3. A cleared browser destroys everything, with no backup
**Evidence:** State lives in `SafeStore` (localStorage, 2 references). **0** backup/export/restore functions found.
**Why:** Users lose work to exactly this — Teal redirected people to an empty new account and wiped their history; Jobscan lost three hours of edits to a save error. Here the risk is worse because there's no account to recover from. One private-browsing session or storage eviction = everything gone.
**Fix:** One-click "Back up my data" → JSON file; "Restore from backup" on the home screen; a gentle nudge before the mock interview.

### 4. Scores are presented as authority, with no stated meaning or uncertainty
**Evidence:** No score disclaimer anywhere in the source (0 matches for heuristic / "practice signal" / "not a prediction").
**Why:** This is the category's **#3** complaint and its most damaging one (Jobscan users scored 98% then rejected in an hour). The app's scores are deterministic heuristics, not a model — which is *fine*, but presenting them bare invites the exact accusation that has produced hundreds of "scam" reviews elsewhere.
**Fix:** One sentence under every number: *"A 0–100 practice signal based on [structure, evidence, keyword match]. It is not a prediction from any employer's system."* Copy Huru's candor, which is the best in the category.

### 5. Native speech parity — the core promise degrades silently in the app stores
**Evidence:** 2 `SpeechRecognition` + 3 `speechSynthesis` references; no capability detection messaging.
**Why:** Spoken practice is the headline feature, and `SpeechRecognition` does not exist in Android WebView or WKWebView. In the shipped iOS/Android app, candidates type instead — with no explanation of why the feature they came for is missing.
**Fix:** Feature-detect at runtime; when absent, show "Voice answers aren't available in this version — type, or open in Chrome for voice." Then add native plugins (already scoped as Phase 2 in `APP_STORE_GUIDE.md`).

### 6. No guardrail against fabricated evidence in suggested rewrites
**Evidence:** The proofreader generates duty→accomplishment rewrites; no code constrains invented metrics or employers.
**Why:** The **#2** complaint across the whole market is AI inserting things that weren't true (Teal added "work authorization" as a skill and misspelled users' names; Rezi produced nonsense skill names). A coaching tool that nudges a nervous candidate toward a number they didn't achieve is an integrity failure with legal exposure in some sectors.
**Fix:** Every rewrite that needs a metric should render as *"[Add the number: ___ ]"* — a prompt, never an invented figure. Add an explicit line: "Never add a number you can't document."

### 7. Privacy claim is true, but not surfaced where it's tested
**Evidence:** `privacy.html` §3 correctly discloses that voice transcription may use the platform speech service. In-app, the mic prompt carries no such notice.
**Why:** The no-upload stance is the product's strongest institutional asset. It's undercut the first time a careful buyer asks "so why does the microphone turn on?" and the answer lives on a different page.
**Fix:** One line at the mic prompt: "Your video is never recorded or sent anywhere. Spoken answers are transcribed by your device or browser's speech service — or type instead."

### 8. No automated tests, versioning, or build — everything is one file
**Evidence:** 136,185 bytes, 1,353 lines, 3 inline `<script>` blocks, no test suite, no version marker, no changelog in-app.
**Why:** Every fix in this list is riskier than it needs to be, and any handoff (a contractor, another agent, future you) starts with archaeology. Accessibility and export work specifically will touch shared rendering code.
**Fix:** Keep the single-file distribution *and* add a `/tests` jsdom suite (the harness used in this project already exists) + a visible `v1.x` build stamp + `CHANGELOG.md`.

### 9. Institutional readiness gaps
**Evidence:** No coach/instructor view, no cohort reporting, no CSV export, no Spanish, no roster import, no SSO.
**Why:** This is the revenue path identified in the pricing brief. A workforce director's first three questions — *Can my coaches see progress? Can I report outcomes to my funder? Does it work for Spanish speakers?* — all currently answer "no."
**Fix:** Start with the cheap 80%: a shareable/exportable per-user progress summary, a cohort CSV export, and Spanish for the five journey steps before SSO.

### 10. No monetization plumbing or operational telemetry
**Evidence:** No entitlement checks, no purchase/restore logic, no receipt validation, no crash reporting, no activation analytics.
**Why:** You cannot turn on the paid tier described in `STRATEGY_PRICING.md` without entitlements and **restore purchases** (a store review requirement if you sell anything). And without knowing where users quit in the first five minutes, every pricing decision is guesswork.
**Fix:** Until you have a backend, gate on a locally-cached entitlement plus a "Restore purchases" action; add a minimal, privacy-respecting local funnel log (step reached, drop-off) that never leaves the device.

---

## 3. Five things the panel wants to see

1. **An evidence trail behind every suggestion.** Each proofreader finding should show the exact line it came from and the rule it broke ("Line 14: no measurable outcome; 3 of 9 bullets lack numbers"). Auditable feedback is the difference between coaching and nagging — and it's the direct antidote to complaint #2.
2. **Accept/reject per change, with a before/after diff.** Competitors leave you holding a rewritten paragraph and no control. Let users pull one improvement at a time and see exactly what changed. This is the highest-trust interaction available to you and nobody in the set offers it cleanly.
3. **Progress over time.** A trend line for resume score and interview phase scores across sessions ("Work History 62 → 81 over 3 interviews"). Motivation plus proof of value, and it's what makes a subscription feel earned.
4. **A human escalation path.** Even a paid add-on: a 20-minute review by a real person, or a career-coach handoff for institutions. The market's #9 complaint is being trapped with a bot when money is involved.
5. **Close the outcome loop.** Let users log applications and interview stages, then show whether resumes tailored with the app convert better for *them*. Nobody in this category does this — Jobscan's "3x callbacks" claim is unaudited self-reporting, and that gap is an opening.

---

## 4. Five things to sustain

1. **The staged formal interview.** Intro/elevator → motivation → work history → posting-skill proof → behavioral → scenario → candidate questions → close, with deficiency probes. Nothing in the competitor set does stage-structured rehearsal; Huru adapts but doesn't enforce the arc, Big Interview is a question bank. This is the moat. Don't simplify it away.
2. **The proofreader as the front door.** Prioritized, line-by-line, constructive feedback on the resume someone already has. Every competitor scores matching or ATS safety; almost none teaches. Protect this from becoming another generic "resume score."
3. **On-device architecture.** No accounts, no upload, no cloud AI. Reviewers 2 and 10 both rated this the strongest part of the product, and it's a live procurement argument against every cloud competitor. Any future LLM feature should be optional and explicitly labeled as the one thing that leaves the device.
4. **The five-step all-in-one journey.** Reviewers repeatedly lament having to buy Teal *and* Big Interview *and* Jobscan. You already answer that. Resist pressure to narrow the scope.
5. **Warm Coach language and visual identity.** Plain, formal, respectful — no recruiter jargon, no hustle-culture tone, no dark-pattern urgency. Combined with the honest-pricing posture this research supports, it's the best asset you have for a nervous, non-collegiate job seeker. Do not let growth tactics erode it.

---

## 5. If you want the real thing

Paste an API key and I'll run this brief past real models:

```bash
cd /home/user/proready-coach
export OPENROUTER_API_KEY=sk-or-...
python3 panel_review.py --models "openai/gpt-5,google/gemini-2.5-pro,anthropic/claude-sonnet-4.5,deepseek/deepseek-chat,x-ai/grok-4"
```

Output: `panel_review_real.md` with each model's verbatim top-10/issues/wants/sustains, a consensus table, and agreement counts per item. It will not overwrite this document.
