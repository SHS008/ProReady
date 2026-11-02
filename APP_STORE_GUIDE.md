# ProReady Coach — iOS & Android App Store Guide

**Status:** the native project is scaffolded, branded, and configured (Capacitor 7 wrapper around the existing web app — no rewrite). Android artifacts are generated and ready for a signed build; the iOS Xcode project is generated but must be opened/built on a Mac. This guide is the from-here-to-live path.

---

## 0. What already exists

```
proready-coach/
├─ index.html                     ← the whole app (unchanged core; now PWA-enabled)
├─ manifest.webmanifest           ← installable-web-app manifest
├─ service-worker.js              ← offline support
├─ privacy.html                   ← public privacy policy (both stores require one)
├─ icons/                         ← 1024/512/192/maskable/apple-touch icons
└─ mobile/                        ← native shell (Capacitor)
   ├─ capacitor.config.json       appId com.proreadycoach.app · appName "ProReady Coach"
   ├─ package.json                Capacitor 7.6.10 (Node 20+ compatible)
   ├─ scripts/sync-www.mjs        copies the web app into mobile/www
   ├─ assets/                     icon.png + splash.png sources (2732² splash)
   ├─ native-config/PERMISSIONS.md camera/mic usage strings & manifest lines (already applied)
   ├─ SIGNING.md                  one-time Play upload-key creation
   ├─ android/                    ✅ generated · icons+splashes ✅ · API 36 ✅ · optional release signing ✅
   └─ ios/                        ✅ generated · AppIcon + splash ✅ · Info.plist privacy strings ✅
```

**Verified in this workspace:** `npx cap sync` succeeds, Android platform builds its project tree with all 87 icon/splash assets, iOS project has 10 assets and all three `NS*UsageDescription` keys, and every JS file passes `node --check`. A full `.aab`/`.ipa` compile was not possible here (no Android SDK / JDK 17 / macOS in this sandbox) — that happens on your machine.

---

## 1. Costs & timelines (as of late 2026)

| | Apple App Store | Google Play |
|---|---|---|
| Developer account | Apple Developer Program — **$99/year** | Play Console — **$25 one-time** |
| Identity | Individual or organization; individuals verify with government ID; orgs need a D-U-N-S number | Personal or organization; government-ID verification |
| Build requirement | Built with current Xcode / current iOS SDK | New apps **must target Android 16 (API 36)** from Aug 31, 2026 — already set here |
| Testing gate | TestFlight (optional) | **Personal accounts created after Nov 13, 2023: closed test with 12 testers opted in for 14 continuous days** before production access |
| Review time | ~50% under 24 h, ~90% under 48 h | usually ≤ 7 days, but the 14-day tester clock runs first |
| Privacy | Public privacy-policy URL + App Privacy "nutrition label" + privacy manifest | Data safety form + privacy-policy URL |
| Revenue share | 15–30% (15% under Small Business Program) | 15–30% |

**Practical consequence:** Android is usually the *faster* first release if you can recruit 12 testers (friends, classmates, job-search groups). On iPhone, an individual account can ship in a couple of days; the 14-day gate applies to new *personal* Play accounts regardless of app quality. There is **no charge to publish** beyond the account fees, and this app has no in-app purchases, so no billing setup is needed.

---

## 2. Phone-test it in 10 minutes, no app store (do this first)

The same `index.html` is now installable as a PWA:
1. Put the folder on any HTTPS host (Netlify drop, GitHub Pages, Cloudflare Pages, Vercel — free tiers fine). Service workers require HTTPS (localhost is exempt).
2. Open it on a phone → **Share → Add to Home Screen** (iOS Safari) or **⋮ → Install app** (Android Chrome).
3. It launches full-screen with your icon, works offline, and no store review is involved.

This is also the cheapest way to let the 12 Android testers try it while the store accounts verify.

---

## 3. One-time setup

**Both:** Node 20+, a code editor, and (for Android) **JDK 17+** and Android Studio; (for iOS) a **Mac** with Xcode.

**Apple:** enroll at developer.apple.com/programs ($99/yr). You'll get a Team ID.
**Google:** enroll at play.google.com/console ($25). Complete identity verification — start this early, it can take days.

**Reserve your identity** (do it before you generate final builds):
- `appId` is currently `com.proreadycoach.app`. Store IDs are permanent, so change it **now** if you want your own domain reverse (e.g. `com.yourname.proready`) — edit `mobile/capacitor.config.json`, then regenerate the platforms (`rm -rf android ios && npm run add:android && npm run add:ios`).
- App name shown on the device: `appName` in the same file ("ProReady Coach").
- Check the name isn't already taken on the stores before you commit to branding.

---

## 4. Android → Play Store

```bash
cd proready-coach/mobile
npm install
npm run sync                 # copies ../index.html + icons into www and both platforms
npx cap open android         # opens Android Studio (first Gradle sync downloads dependencies)
```

Then:
1. **Test on a device/emulator.** Install the debug build and walk the journey: set a target job → build & proofread a resume → read Prep School → run a mock interview with camera → follow-up generator. Confirm the camera prompt appears.
2. **Create the upload key once** — follow `mobile/SIGNING.md` (JDK 17+ `keytool`). Back up the `.jks` + passwords.
3. **Build the bundle:**
   ```bash
   cd android && ./gradlew bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`.
4. **Play Console → Create app** (name, language, "App", "Free").
5. **Complete the required declarations** (use the answers in §7): App content → Privacy policy URL, Ads (No), Data safety, Content rating (IARC questionnaire), Target audience, News app (No), plus the **Camera/Microphone** permission declarations.
6. **Create the store listing** (§8 has ready-to-paste copy; upload `icons/icon-512.png` and a 1024×500 feature graphic + phone screenshots).
7. **Closed testing** → create a track, add **12+ real testers** by email list, keep them opted in **14 continuous days** while you fix what they find. (Internal testing has no day minimum but doesn't satisfy the production gate.)
8. **Apply for production access** — the three-part form asks how you tested, what you learned, and what changed. Answer specifically with the tester feedback you got. Review is usually ≤ 7 days.
9. **Roll out to production** (staged rollout 20% → 100% is a good habit).

---

## 5. iOS → App Store

```bash
cd proready-coach/mobile
npm install
npm run sync
npx cap open ios             # opens the Xcode workspace
```
(On a Mac, Capacitor will also run `pod install` — requires CocoaPods `brew install cocoapods`.)

In Xcode:
1. Select the **App** target → **Signing & Capabilities** → choose your Team; confirm the **Bundle Identifier** matches `com.proreadycoach.app` (or your chosen id) and that **Automatically manage signing** is on.
2. Confirm **Info** contains the camera/microphone/speech strings (already in the generated `Info.plist`).
3. Set **Deployment target** to iOS 15+ and choose your test device/simulator → **Run**. Walk the same journey as Android.
4. **TestFlight:** Product → Archive → Distribute App → App Store Connect. Add yourself as an internal tester (review-free) and, if you like, a small external group (~1 day review).
5. **App Store Connect → My Apps → +** : name, primary language, SKU (e.g. `proready-001`), bundle id.
6. Fill **App Privacy** (see §7), **Age rating** questionnaire, **pricing: Free**, and the **privacy policy URL**.
7. Upload the listing text/screenshots from §8 (Apple needs 6.9" and 6.5" iPhone sizes plus a 12.9"/13" iPad size **only if you allow iPad** — simplest launch: iPhone-only to avoid the extra screenshot set).
8. Submit for review. Respond fast if a reviewer asks questions; most first submissions get a note about demo credentials — **not needed here, there is no login** — and Apple reviewers do exercise camera features, so the "type instead" path matters (it exists).

---

## 6. The one thing to decide before public release: in-app speech

The app currently uses **browser** APIs. In the native shell: `getUserMedia` (camera/mic) works, **`speechSynthesis`** (Alex's voice) usually works, but `window.SpeechRecognition` is **not available** in Android WebView or WKWebView — candidates would have to **type** their answers instead of speaking them. Resume/report downloads (`Blob` + `window.print()`) are awkward on mobile too.

Two honest paths:

- **Phase 1 (now, fastest to store):** ship as-is, typing answers works everywhere. Update store text to say "answer by voice in supported browsers, or type." Zero extra plugins. Good enough to get listed and collect feedback.
- **Phase 2 — ✅ DONE in v1.2.0: native voice.** Speech now runs through `voice-adapter.js`,
  which uses native plugins in the app and the Web Speech API in browsers:
  - speech-to-text: `@capacitor-community/speech-recognition` 7.0.1
  - text-to-speech: `@capacitor-community/text-to-speech` 6.1.0 (8.x requires Capacitor 8)
  - **Android 11+ gotcha, already fixed:** the manifest needs a `<queries>` entry for
    `android.speech.RecognitionService`. Without it the OS hides the recognizer, the plugin
    looks installed but silent, and voice reports "unavailable" on a real device.
  - iOS: `NSSpeechRecognitionUsageDescription` + `NSMicrophoneUsageDescription` are in
    `Info.plist`; the Podfile pulls both plugin pods.
  - Never gate speech on `'webkitSpeechRecognition' in window` — WKWebView exposes it and
    does not implement it (WebKit 239816), so the check is a false positive in the app.
- **Phase 2b (optional, ~2 hours): native save/share.** `@capacitor/filesystem` +
  `@capacitor/share` would replace Blob downloads and `window.print()` with a real
  "Save to Files / Share" sheet. Exports work today; this only improves the feel.

Both phases are wired. What's left before submission is account work, not code: host the privacy page, replace the support-email placeholder, buy the developer accounts, and run the on-device checklist below.

---

## 7. Privacy & data-safety answers (copy these, keep them accurate)

**Reality of the app:** no accounts, no server, no ads, no analytics SDKs, no tracking. Resumes/files are parsed on-device. Camera video is displayed only and never recorded or stored. If the candidate answers **aloud** in a browser, transcription uses the **platform speech service** (Apple/Google) — that is the one place data can leave the device, and it's user-chosen and disclosed in `privacy.html` §3.

**Apple — App Privacy:** "Data Not Collected" is defensible for the app itself **only if** the speech-recognition path is described honestly. Safest submission: mark **Data Not Collected**, and in App Review notes write: *"Voice answers use the system speech-recognition service; no audio is stored or transmitted by the app. All other data stays on device in WebView local storage."* If reviewers push back, declare **Audio Data → Not linked to identity → App functionality → not used for tracking**.
**Google — Data safety:** No data collected, no data shared, no ads; encryption in transit N/A (no transmission by the app). In the **Permission declarations** for camera/mic: "App functionality — video self-view and optional spoken answers; processed on-device, not collected."
**Both:** privacy policy URL = wherever you host `privacy.html`. **Replace the `[REPLACE WITH YOUR SUPPORT EMAIL]` placeholder before submitting** — a placeholder is a guaranteed rejection.

**Content rating:** no violence/sex/drugs/gambling; user-generated content is local-only; **no** unrestricted web browsing (the app has no browser). Expect **4+ / Everyone**. Career-advice content is not "medical/legal advice."

---

## 8. Store listing copy (draft, ready to paste)

**App name (30/30 chars):** `ProReady Coach: Job Prep`
**Apple subtitle (30):** `Resume, proofread, interview`
**Google short description (80):** `Build or proofread your resume, prep for interviews, and practice a video mock interview.`

**Full description:**
> **Get job-ready in five guided steps.**
> ProReady Coach walks you through the whole professional job search — not just a template.
>
> **1 · Target Job** — Paste the posting. The app pulls out the skills and keywords employers screen for.
> **2 · Resume** — Build one with a live preview, a strength score, and ATS keyword matching — or submit the resume you already have to the **Proofreader** for honest, specific feedback: scores by category, prioritized fixes, line-by-line notes, and suggested rewrites. Send it straight into the builder to fix it.
> **3 · Prep School** — Do's and don'ts, the STAR method trainer, dress and video-call guidance, questions to expect, questions to ask, and a quick quiz.
> **4 · Video Mock Interview** — A formal interview that goes through the real stages: introduction, why this job, your work history, proof of the skills the posting asks for, behavioral examples, a role scenario, and your own questions. Alex, your interviewer, adapts — pressing for specifics when an answer is vague — then gives you a scored report.
> **5 · Follow-Up** — Checklists, answers to the awkward moments, and a thank-you email generator.
>
> **Private by design:** nothing is uploaded. Your resume, answers, and practice stay on your device. The camera is only for your own self-view — nothing is recorded.
>
> Works for every experience level, in any field. No degree required to use it well.

**Keywords (Apple, 100 chars):** `resume,builder,proofreader,interview,prep,job,career,ATS,CV,mock,STAR,coach,cover letter,hiring`

**Screenshots to capture on device (5):** Journey home with ready score · Resume builder + preview · Proofreader report with scores · Mock interview with self-view · Scored interview report.

**Feature graphic (1024×500):** icon on the left, `ProReady Coach` wordmark, tagline "Resume. Proofread. Practice. Get hired." — Warm Coach palette (cream `#F9E9D2`, terracotta `#C75B39`, sage `#5F7161`, walnut `#432818`).

**Support/contact:** your support email + a simple page with the privacy policy and a "how to use" summary.

---

## 9. Common rejection risks & how this app avoids them

| Risk | This app |
|---|---|
| "Just a website" / minimum functionality (Apple 4.2) | Offline PWA behavior, native shell, camera practice, on-device file parsing, saved progress — argue it's a real tool, and Phase 2 plugins add native speech |
| Privacy-policy URL missing/placeholder | Host `privacy.html`; **replace the email placeholder** |
| Camera/mic permission not explained | Usage strings written in plain language, in place already |
| No way to use the app if permission denied | Typing path works; camera is optional |
| Account deletion requirement | No accounts exist — nothing to delete, say so if asked |
| Misleading "AI" claims | Describe the interviewer as a practice simulator with adaptive feedback; it's heuristic, not a language model — don't claim verified AI scoring |
| Trademark/brand conflict | Check "ProReady" availability in your class; rename `appName`/bundle id early if needed |

---

## 10. Release checklist

- [ ] Decide final app name + reverse-DNS bundle id (permanent)
- [ ] Replace support email in `privacy.html`; host it publicly; note the URL
- [ ] `npm install && npm run sync` in `mobile/`
- [ ] Device test on a real Android phone **and** a real iPhone (camera prompt, mic, typing fallback, save/print)
- [ ] Android: create upload key (`SIGNING.md`), `./gradlew bundleRelease`, back up `.jks`
- [ ] iOS: Xcode signing team set, archive, TestFlight internal test
- [ ] Play Console: declarations + listing + closed test (12 testers / 14 days) → production application
- [ ] App Store Connect: App Privacy, age rating, listing, submit
- [ ] After each future change: `npm run sync` → rebuild → bump `versionCode`/`versionName` (Android) and version/build (iOS)

---

## 11. What I can do next, on request

1. **Wire Phase 2 native speech** (add the three plugins, patch the interview engine to prefer native speech with browser fallback, re-sync, re-test).
2. **Generate the store artwork** — 1024×500 feature graphic plus phone-frame screenshot mockups from the app's real screens.
3. **Build a signed release pipeline** you can run locally in one command (keystore handling, version bumps, AAB output).
4. **Publish the PWA** prep — e.g. a GitHub Pages/Netlify config file so the installable web version goes live at a URL you can share with testers today.
