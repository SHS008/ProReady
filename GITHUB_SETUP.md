# ProReady on GitHub — done

| | |
|---|---|
| Repository | https://github.com/SHS008/ProReady |
| Visibility | Public |
| Branch | `main` (default) |
| Live app | **https://shs008.github.io/ProReady/** |
| Pages source | `main` / root, built successfully |
| First commit | `15ea0d8` — ProReady Coach v1.2.0 |

## Pushing future changes

The remote is already configured, so from the project folder:

```bash
git add -A
git commit -m "describe the change"
git push
```

Pages rebuilds automatically in about 30–60 seconds. **Bump `CACHE_VERSION` in
`service-worker.js`** whenever you change `index.html` or any asset, or phones that installed
the app will keep serving the old cached copy.

## Updating the app on your phone after a push

- **In Safari / home-screen app:** pull to refresh, or close the tab and reopen. If it still
  looks stale, the service worker is holding the old version — bumping `CACHE_VERSION` is the fix.
- **In the native Xcode build:** the app does not fetch from GitHub. You must re-run
  `node mobile/scripts/sync-www.mjs`, then `npx cap sync ios`, then rebuild (⌘R).

---

# Putting ProReady Coach on GitHub

The repository is already prepared locally: `git` is initialised, `.gitignore` is set, and
**45 files / 0.89 MB** are staged and verified clean — no `node_modules`, no generated native
folders, no tokens or keys.

I cannot create the repository for you from here: this session has **no GitHub access**
(no connected GitHub app, and no credentials in the sandbox). What I need from you is one of
the two options below. Option 1 is the safe one and takes about a minute.

---

## Option 1 — You create the repo, I push (recommended)

**Do this on your phone or laptop, in the browser:**

1. Go to **https://github.com/new**
2. **Repository name:** `ProReady`
3. **Description:** `Guided resume builder, proofreader and formal mock-interview coach`
4. **Visibility:** **Private** — recommended while you're still testing. You can flip it to
   public later in Settings → General → Danger Zone, and GitHub Pages works with
   public repos on every plan (private repos need GitHub Pro for Pages).
5. **Do NOT** tick "Add a README", `.gitignore`, or a licence. The repo must start empty or
   the push will be rejected as non-fast-forward.
6. Click **Create repository**.

**Then create a token and paste it to me:**

7. Go to **https://github.com/settings/tokens/new**
   - *Note:* `arena proready push`
   - *Expiration:* **7 days** (short is good — you can revoke it after)
   - *Scopes:* tick **`repo`** (the top-level checkbox — it covers repo read/write)
   - Scroll down → **Generate token**
8. Copy the `ghp_…` string and send it to me in chat along with your **GitHub username**.

I'll then push `main` and confirm the commit is live, then you can revoke the token at
**https://github.com/settings/tokens** — the code stays on GitHub either way.

> **Two honest notes.** A token in a chat is a credential in a chat: generate it with a 7-day
> expiry and revoke it as soon as I've pushed, and never reuse a token you use elsewhere. And
> only paste it if you're comfortable doing so — Option 2 avoids it entirely.

---

## Option 2 — You do the push yourself (no token leaves your machine)

Download the project from the workspace, then on your computer:

```bash
cd proready-coach

# point at the empty repo you just created
git remote add origin https://github.com/SHS008/ProReady.git
git commit -m "ProReady Coach v1.2.0 — guided resume, proofreader, formal mock interview"
git push -u origin main
```

When it asks for a password, paste a **personal access token** (same page as step 7), not your
GitHub password — GitHub stopped accepting account passwords for git in 2021.

If `git commit` complains about identity:

```bash
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
```

---

## After it's pushed: turn on the phone-testable URL

1. Repo → **Settings** → **Pages**
2. **Source:** Deploy from a branch · **Branch:** `main` · **Folder:** `/ (root)` → **Save**
3. Wait ~1 minute, refresh. Your URL is:

   **`https://shs008.github.io/ProReady/`**

4. Open that URL in **Safari on your iPhone**. Continue with `TESTING_ON_IPHONE.md` → Route A.

If you made the repo **private**, Pages will ask you to upgrade to GitHub Pro. Easiest path
while testing: keep the repo private and use Route B (native Xcode build), or make the repo
public — it contains no secrets, only your app.

---

## What is and isn't in the repository

**In:** `index.html`, `desktop.html`, `voice-adapter.js`, `resume-export.js`, `service-worker.js`,
`manifest.webmanifest`, `privacy.html`, `icons/`, `tests/`, `tools/`, `mobile/` (package files,
`capacitor.config`, the `ios/`/`android/` config sources, `scripts/sync-www.mjs`), and all the
docs (`README`, `CHANGELOG`, `APP_STORE_GUIDE`, `STRATEGY_PRICING`, `PANEL_REVIEW`,
`COMPETITOR_REVIEW_ANALYSIS`, `TESTING_ON_IPHONE`, `GITHUB_SETUP`).

**Out (regenerate on your machine):**
- `node_modules/` — `npm install` recreates it
- `mobile/ios/` and `mobile/android/` — `npx cap add ios` / `npx cap add android` recreate them
- `mobile/www/` — `node mobile/scripts/sync-www.mjs` recreates it from the root files

That last point matters: **the native app's web files are generated, not committed.** If you
edit `index.html`, run `node mobile/scripts/sync-www.mjs` and then `npx cap sync ios`, or the
phone app will still be running the old copy. This is the single most common "my change didn't
show up on the phone" cause.
