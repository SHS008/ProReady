# Native permissions & platform settings (apply AFTER `cap add`)

ProReady uses the camera (you see yourself during the mock interview) and the microphone (optional spoken answers). Nothing is recorded or uploaded by the app. Both stores require you to declare *why* — apply these once after generating each platform, then commit the generated `android/` and `ios/` folders.

## Android — `android/app/src/main/AndroidManifest.xml`
Add before `</manifest>` (Capacitor already includes INTERNET):

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

<!-- Camera/mic are optional features: don't block install on devices without them -->
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.microphone" android:required="false" />
```

Notes
- The app already requests access at the moment of use via `getUserMedia`, which shows the system prompt.
- Do **not** add storage/photo permissions — the resume file picker uses the system file chooser, which needs none.
- Play Console will ask about these permissions in the **Data safety** and **App content** sections: camera/mic are used for app functionality, processed ephemerally on-device, not collected/shared by the app (see `../../APP_STORE_GUIDE.md` for declarations, incl. the speech-service disclosure).

## iOS — `ios/App/App/Info.plist`
Add these keys (in Xcode: App target → Info → Custom iOS Target Properties):

```xml
<key>NSCameraUsageDescription</key>
<string>ProReady Coach uses the camera so you can see yourself during practice video interviews. Video is shown only to you and is never recorded or uploaded.</string>

<key>NSMicrophoneUsageDescription</key>
<string>ProReady Coach uses the microphone only if you choose to answer interview questions aloud. You can always type instead.</string>

<key>NSSpeechRecognitionUsageDescription</key>
<string>ProReady Coach uses speech recognition to turn your spoken practice answers into text you can review.</string>
```

Also in Xcode:
- **Signing & Capabilities:** select your Apple Developer team; set the Bundle Identifier to match `capacitor.config.json` → `appId`.
- **Deployment target:** iOS 15+ recommended (camera in WKWebView requires iOS 14.3+).
- No background modes, no push, no Sign in with Apple (no accounts in v1).

## Speech plugins — INSTALLED in v1.2.0
Voice input and interviewer audio now work in the native builds through `voice-adapter.js`,
which prefers native plugins and falls back to the Web Speech API in browsers.

| Plugin | Version | Purpose |
|---|---|---|
| `@capacitor-community/speech-recognition` | 7.0.1 | Spoken answers (Android `SpeechRecognizer`, iOS `SFSpeechRecognizer`) |
| `@capacitor-community/text-to-speech` | 6.1.0 | Alex asking questions aloud (`AVSpeechSynthesizer` / Android TTS) |

**Already applied for you:**
- `AndroidManifest.xml`: `RECORD_AUDIO`, `CAMERA`, `MODIFY_AUDIO_SETTINGS`, optional-feature
  flags, **and a `<queries>` entry for `android.speech.RecognitionService`** — without that
  entry, Android 11+ hides the recognizer service and voice input silently reports
  "unavailable". This is the single most common cause of "the plugin installed but does
  nothing" on modern Android.
- `Info.plist`: `NSSpeechRecognitionUsageDescription`, `NSMicrophoneUsageDescription`,
  `NSCameraUsageDescription`.
- iOS `Podfile`: `CapacitorCommunitySpeechRecognition` and `CapacitorCommunityTextToSpeech`.

**Detection rule (important):** never gate speech on `'webkitSpeechRecognition' in window`.
iOS WKWebView exposes the constructor but does not implement it (WebKit bug 239816), so
feature detection yields a false positive. `voice-adapter.js` decides by platform + plugin
availability instead, and reports `native-without-plugin` when the plugins are missing.

**After changing plugins, always re-run:**
```bash
cd mobile && npm run sync      # then rebuild in Xcode / Android Studio
```

## Still to replace on native
Blob downloads & `window.print()` (resume/report export) work in the app today, but
`@capacitor/filesystem` + `@capacitor/share` would give a native "Save to Files / Share"
sheet. Tracked in `../../APP_STORE_GUIDE.md`.
