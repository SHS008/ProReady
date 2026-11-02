# Testing ProReady Coach on an iPhone

There are two routes. Read this first, because the one most people try first has a catch.

| | **Route A — Safari / web app** | **Route B — native app (Xcode)** |
|---|---|---|
| Time to first test | ~2 minutes | ~1–2 hours the first time |
| Needs a Mac | No | **Yes — Xcode only runs on macOS** |
| Needs an Apple Developer account | No | No for your own phone; yes ($99/yr) to distribute |
| Spoken answers (mic) | ❌ **No** — iOS blocks it | ✅ Yes |
| Typed answers, all lessons, resume, proofreader, export | ✅ Works | ✅ Works |
| Voice of the interviewer (Alex reads questions) | ✅ Works in Safari | ✅ Works, more natural |
| Camera self-view in the mock interview | ✅ Works | ✅ Works |

**The catch:** iOS Safari does not support the Web Speech API at all. So on route A you can use
*every* part of the app — the whole journey, the resume builder, the proofreader, the full
formal mock interview, the scored report, the thank-you email — but you **type your answers**
instead of speaking them. Alex still reads the questions aloud, because text-to-speech *is*
supported. Route B is the only way to speak your answers on an iPhone.

That's not a defect you can patch around in the browser. It's why `voice-adapter.js` exists:
when it detects iOS in a browser, it says so plainly instead of showing a mic button that
silently does nothing.

---

## Route A — GitHub Pages + Safari (start here)

You get a real URL, offline support, and a home-screen icon — in about two minutes. Good for
testing everything except spoken answers, and good for showing the app to other people.

### 1. Push the repo
See `GITHUB_SETUP.md`, step 1. You need the repo on GitHub first.

### 2. Turn on Pages
1. On GitHub, open your repository.
2. **Settings** (top bar) → **Pages** (left sidebar, under "Code and automation").
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. **Branch:** `main` · **Folder:** `/ (root)` → **Save**.
5. Wait ~60 seconds. Refresh the page; a banner appears with your URL:
   `https://YOUR-USERNAME.github.io/proready-coach/`

### 3. Open it on the iPhone
Type that URL into **Safari** on your phone. It must be Safari for the home-screen install to
work — Chrome on iOS can open the page but won't offer the same install path.

### 4. Confirm it loaded correctly
- The header shows **v1.2.0**.
- The **Target Job** screen asks what job you're going for.
- Type a job title, then walk the five journey steps in order: Target Job → Resume → Prep → Interview → Follow-Up.
- In the interview, allow the camera when iOS asks. You should see your self-view.
- Press **Start Speaking** once: it should tell you voice isn't available in this browser and
  invite you to type. That message appearing is a **pass** — it means the app is being honest
  rather than hanging on a dead button.
- Press the speaker button on a question: you should hear it read aloud. **If you hear nothing,
  the phone is on silent** — see the troubleshooting table.

### 5. Install it to the home screen (optional but worth checking)
1. In Safari, tap the **Share** button (square with an arrow, bottom centre).
2. Scroll down → **Add to Home Screen** → **Add**.
3. Open it from the home screen: it launches full-screen with no Safari bars, and works offline.

⚠️ **Important for testers:** inside a home-screen app, iOS also blocks text-to-speech
playback quirks and voice stays unavailable. If you want to hear the questions read aloud,
**use Safari itself**, not the installed icon. Both work; Safari has more capability on iOS.

---

## Route B — Native app on your iPhone (this is how you get voice input)

Requirements: **a Mac** with Xcode (free from the Mac App Store), a Lightning/USB-C cable, and
your Apple ID. You do **not** need the $99 developer program to put the app on your own phone —
a free Apple ID can sign and install a build that lasts **7 days**, after which you re-install.

### 1. On the Mac, get the code

```bash
git clone https://github.com/YOUR-USERNAME/proready-coach.git
cd proready-coach

# Node 20 or 22 (Capacitor 7 needs >= 20). Check with: node -v
cd mobile
npm install
```

### 2. Build the web assets and generate the iOS project

```bash
# from the repo root, copy the app files into mobile/www/
node mobile/scripts/sync-www.mjs

cd mobile
npx cap add ios        # creates mobile/ios/ — only needed once
npx cap sync ios       # copies web assets + installs the two speech pods
```

`npx cap sync` should list both plugins. If it doesn't, speech will not work in the app:

```
[info] Found 2 Capacitor plugins for ios:
       @capacitor-community/speech-recognition@7.0.1
       @capacitor-community/text-to-speech@6.1.0
```

### 3. Open it in Xcode

```bash
npx cap open ios
```

Xcode opens the workspace. In the left sidebar select the **App** project → **Signing &
Capabilities** tab → tick **Automatically manage signing** → **Team:** choose your Apple ID
(add it via Xcode → Settings → Accounts if it isn't listed). If you see a bundle-identifier
error, change `Bundle Identifier` to something unique, e.g. `com.yourname.proready`.

### 4. Run it on the phone

1. Plug the iPhone into the Mac. Tap **Trust** on the phone if prompted.
2. In Xcode's toolbar, pick your iPhone from the device dropdown (next to the scheme name).
3. Press **▶ Run** (⌘R).
4. First launch on a free account: the phone will refuse to open the app with an
   "Untrusted Developer" message. Fix it once:
   **Settings → General → VPN & Device Management → Developer App → Trust**.
5. Open the app.

### 5. Test the parts route A can't

| Check | Expected |
|---|---|
| Interview → press **Start Speaking** | Mic permission prompt appears, then "🔴 Listening…" |
| Say a sentence about your work history | Your words appear in the answer box as you speak |
| Press **Stop Recording** | Text stays, button returns to "Start Speaking" |
| Deny the mic permission (Settings → ProReady → Microphone off), then try again | A plain message about permission — **not** a stuck "Listening…" |
| Let the interviewer read a question | You hear it, even with the silent switch on (native TTS ignores it) |
| Turn the camera on | Self-view appears; it is never recorded |
| Rotate / background the app | No crash; your typing is still there when you return |

The last two rows are the ones that actually catch bugs. Everything before them passes in a
browser too.

### 6. If something fails

| Symptom | Cause and fix |
|---|---|
| "Voice input is not available in the phone app" | `npx cap sync ios` wasn't run after `npm install`, so the plugins aren't in the binary. Re-run it, then ⌘R in Xcode. |
| Permission prompt never appears | `NSSpeechRecognitionUsageDescription` is missing from `ios/App/App/Info.plist`. It ships in the repo; if you edited, re-add it. |
| "Untrusted Developer" | Settings → General → VPN & Device Management → Trust |
| Build fails: "requires a development team" | Signing & Capabilities → pick your Team |
| App opens to a blank white screen | The web assets weren't copied: run `node mobile/scripts/sync-www.mjs` from the repo root, then `npx cap sync ios` |
| App stops launching after a week | Normal on a free Apple ID. Re-run from Xcode (⌘R). |
| Pods fail to install | `cd mobile/ios/App && pod install --repo-update` (needs CocoaPods: `brew install cocoapods`) |

---

## Which route should you use?

Start with **Route A today** — it takes two minutes and tests 95% of the app. Use it with a
friend or colleague by sending them the link; nothing to install and no account needed.

Go to **Route B** when you specifically want to prove voice input works, or when you're ready
to film a demo / submit to the App Store. Route B is also the only way to see the app as a
real installed application rather than a web page.
