#!/usr/bin/env python3
"""
panel_review.py — run the ProReady Coach review brief past REAL models and build a
consensus report. Nothing here works without an API key.

Usage (OpenRouter reaches most models with one key):
    export OPENROUTER_API_KEY=sk-or-...
    python3 panel_review.py
    python3 panel_review.py --models "openai/gpt-5,google/gemini-2.5-pro,anthropic/claude-sonnet-4.5"

Usage (OpenAI directly):
    export OPENAI_API_KEY=sk-...
    python3 panel_review.py --provider openai --models "gpt-5,gpt-5-mini"

Usage (Google Gemini directly):
    export GEMINI_API_KEY=...
    python3 panel_review.py --provider gemini --models "gemini-2.5-pro,gemini-2.5-flash"

Output: panel_review_real.md  (this file never overwrites PANEL_REVIEW.md)

Only Python stdlib is used, so there is nothing to pip install.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(ROOT, "index.html")
OUT = os.path.join(ROOT, "panel_review_real.md")

SYSTEM = (
    "You are a blunt, senior product reviewer. You are reviewing a real app before it "
    "charges money or ships to app stores. Be specific and evidence-driven; no praise "
    "sandwiches, no filler. If something is a genuine strength, say so plainly."
)

BRIEF = """Review this app. Reply with EXACTLY these four markdown sections and nothing else:

## ISSUES (10)
Numbered 1-10, most severe first. Each item: a bold one-line title, then 1-2 sentences of
evidence from the description, then one concrete fix. No item may repeat another.

## WANT (5)
Five features or behaviors this app should add. Each: bold title + one sentence on why.

## SUSTAIN (5)
Five things this app must not lose while changing. Each: bold title + one sentence on why.

## SCORE
A single line: `OVERALL: X/10` followed by one sentence of justification.

THE APP
-------
Name: ProReady Coach - Resume & Interview Prep for Professional Jobs.
Audience: mixed-experience professional job seekers (NOT primarily college students);
explicitly aimed at people without degrees, career changers, and small-city job seekers.

Single-page web app, no backend, no accounts, no CDN. All data lives in the browser's
local storage. Nothing is uploaded. Also wrapped with Capacitor for iOS/Android and
installable as a PWA. 136,185 bytes in one index.html (1,353 lines, 3 inline script
blocks). No test suite, no build step, no version stamp.

Five-step guided journey:
1. TARGET JOB - user pastes a job posting; app extracts skills/keywords, filtering via a
   skills lexicon and stopword list (guard added after an early bug selected junk words
   like "seeking").
2. RESUME - two modes:
   (a) BUILDER: contact, summary generator, experience, skills, education/certs; live
       preview; 0-100 "Resume Strength" score with checklist; ATS keyword match
       (found/missing) against the Step 1 posting; action-verb bank; download.
   (b) PROOFREADER: user uploads (.docx parsed in-browser via ZIP central directory +
       DecompressionStream, .txt/.html, basic uncompressed .pdf) or pastes an existing
       resume. Returns overall + 5 category scores (Spelling & Mechanics, Structure,
       Impact & Evidence, ATS & Tailoring, Professionalism & Safety), a prioritized
       "fix in this order" list, strengths, finding cards (misspellings, duty language,
       unquantified bullets, missing sections/dates, SSN/address red flags, "references
       available upon request"), keyword panel, line-by-line notes, duty->accomplishment
       rewrite suggestions, downloadable report, and one-click import into the Builder.
3. PREP SCHOOL - do's/don'ts, STAR trainer, dress/video/body-language guidance, common
   questions, questions to ask employers, quiz.
4. AI VIDEO MOCK INTERVIEW - camera self-view (never recorded or uploaded), spoken
   questions via speechSynthesis, answers typed or spoken via SpeechRecognition. A formal
   staged interview with nine scored phases: Intro/Elevator Speech, Motivation & Fit,
   Work History, Job Skills, Behavioral Examples, Judgment (Scenario), Practical Fit,
   Your Questions, Closing. Three formats (Phone Screen, Full Interview, Final Round).
   Questions are personalized from the Step 2 resume and Step 1 posting. Adaptive
   follow-ups probe vague answers, missing outcomes, "we" vs "I", and missing
   organization-specific motivation (capped at one positive detail probe, which does not
   consume the deficiency-probe budget). The interviewer's only acknowledgment is
   "Thank you."; all language is formal and simple. Produces a scored report with
   per-question detail and a transcript download.
5. FOLLOW-UP - checklists, tough-moment FAQs, thank-you email generator.

Scoring is deterministic client-side heuristics - there is NO language model anywhere in
the app. No score disclaimer appears anywhere in the source.

Static audit findings (measured, not estimated):
- Accessibility: 1 aria-* attribute total; 0 role=, 0 aria-live, 0 tabindex, 0 label-for
  pairs, 0 alt texts, 47 onclick handlers, no focus-visible styling, no
  prefers-reduced-motion, 32 fixed px font sizes and 0 rem/em sizes.
- Export: resume downloads as a generated .html Blob; interview and proofreader reports
  download as .txt. No PDF, no DOCX output.
- Durability: no backup/restore/export-state function; clearing browser storage loses
  everything.
- Operational: no entitlements, no purchase/restore, no analytics, no crash reporting.
- Institutions: no coach dashboard, no cohort reporting, no CSV export, no Spanish, no SSO.

Market context (verified Oct 2026): Huru offers unlimited AI mock interviews plus a resume
builder FREE to job seekers (iOS since 2021). Rezi $29/mo or $149 lifetime, Jobscan
$49.95/mo, Teal $29/mo, Big Interview $39-299. Google retired Interview Warmup in April
2026. The category's dominant complaints are (1) billing/refund/cancellation abuse,
(2) AI that ignores the user's real experience and invents generic content, (3) scores
that don't mean what they imply, (4) exports that don't match what was built.
"""


def call_openai_compatible(url, key, model, brief, timeout=180):
    body = json.dumps({
        "model": model,
        "temperature": 0.4,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": brief},
        ],
    }).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key,
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = json.loads(r.read().decode())
    return data["choices"][0]["message"]["content"]


def call_gemini(model, key, brief, timeout=180):
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent")
    body = json.dumps({
        "systemInstruction": {"parts": [{"text": SYSTEM}]},
        "contents": [{"parts": [{"text": brief}]}],
        "generationConfig": {"temperature": 0.4},
    }).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "x-goog-api-key": key,
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = json.loads(r.read().decode())
    return data["candidates"][0]["content"]["parts"][0]["text"]


def score_of(text):
    m = re.search(r"OVERALL:\s*(\d+(?:\.\d+)?)\s*/\s*10", text or "")
    return float(m.group(1)) if m else None


def headings_of(text, section):
    """Pull the bold titles under a named section as comparable strings."""
    if not text:
        return []
    m = re.search(rf"##\s*{section}\b(.*?)(?:\n##\s|\Z)", text, re.S | re.I)
    if not m:
        return []
    return [t.strip() for t in re.findall(r"\*\*(.+?)\*\*", m.group(1))]


def norm(s):
    s = re.sub(r"[^a-z0-9 ]", " ", s.lower())
    return {w for w in s.split() if len(w) > 3}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", default="openrouter",
                    choices=["openrouter", "openai", "gemini"])
    ap.add_argument("--models", default="",
                    help="comma-separated model ids; defaults per provider")
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()

    defaults = {
        "openrouter": "openai/gpt-5,google/gemini-2.5-pro,anthropic/claude-sonnet-4.5,"
                      "deepseek/deepseek-chat,x-ai/grok-4",
        "openai": "gpt-5,gpt-5-mini",
        "gemini": "gemini-2.5-pro,gemini-2.5-flash",
    }
    models = [m.strip() for m in (args.models or defaults[args.provider]).split(",") if m.strip()]

    if not os.path.exists(APP):
        sys.exit(f"index.html not found at {APP}")

    results = {}
    for model in models:
        print(f"-> {model} ... ", end="", flush=True)
        try:
            if args.provider == "openrouter":
                key = os.environ.get("OPENROUTER_API_KEY")
                if not key:
                    sys.exit("OPENROUTER_API_KEY is not set")
                txt = call_openai_compatible(
                    "https://openrouter.ai/api/v1/chat/completions", key, model, BRIEF)
            elif args.provider == "openai":
                key = os.environ.get("OPENAI_API_KEY")
                if not key:
                    sys.exit("OPENAI_API_KEY is not set")
                txt = call_openai_compatible(
                    "https://api.openai.com/v1/chat/completions", key, model, BRIEF)
            else:
                key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
                if not key:
                    sys.exit("GEMINI_API_KEY is not set")
                txt = call_gemini(model, key, BRIEF)
            results[model] = txt
            s = score_of(txt)
            print(f"ok ({s if s is not None else '?'}/10)")
        except urllib.error.HTTPError as e:
            print(f"HTTP {e.code}")
            results[model] = f"_HTTP {e.code}: {e.read().decode()[:400]}_"
        except Exception as e:  # noqa: BLE001
            print(f"error: {e}")
            results[model] = f"_error: {e}_"
        time.sleep(1)

    ok = {m: t for m, t in results.items() if score_of(t) is not None}
    if not ok:
        sys.exit("No model returned a parsable review. Check the key, model ids and quota.")

    # crude consensus: cluster headings across models by word overlap
    def cluster(section):
        items = []
        for m, t in ok.items():
            for h in headings_of(t, section):
                bag = norm(h)
                for c in items:
                    if len(bag & c["bag"]) >= 2:
                        c["models"].add(m)
                        c["titles"].append(h)
                        c["bag"] |= bag
                        break
                else:
                    items.append({"bag": set(bag), "models": {m}, "titles": [h]})
        items.sort(key=lambda c: -len(c["models"]))
        return items

    lines = ["# ProReady Coach — Real Model Panel Review", "",
             f"Models queried: {', '.join(ok)}", "",
             "## Scores", "", "| Model | Score |", "|---|---|"]
    for m, t in ok.items():
        lines.append(f"| `{m}` | {score_of(t)}/10 |")
    avg = sum(score_of(t) for t in ok.values()) / len(ok)
    lines += ["", f"**Average: {avg:.1f}/10 across {len(ok)} models.**", ""]

    for section, label in [("ISSUES", "Consensus issues (by number of models raising it)"),
                           ("WANT", "Consensus wants"),
                           ("SUSTAIN", "Consensus sustains")]:
        lines += [f"## {label}", ""]
        for c in cluster(section)[:12]:
            n = len(c["models"])
            star = "***" if n >= max(2, len(ok) - 1) else ("**" if n > 1 else "")
            lines.append(f"- {star}{n}/{len(ok)}{star} — {c['titles'][0]}")

    lines += ["", "---", "", "# Verbatim reviews", ""]
    for m, t in results.items():
        lines += [f"## {m}", "", t, ""]

    with open(args.out, "w") as f:
        f.write("\n".join(lines))
    print(f"\nwrote {args.out}")


if __name__ == "__main__":
    main()
