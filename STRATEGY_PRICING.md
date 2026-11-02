# ProReady Coach — Market, Competition & Pricing Brief

Prepared October 31, 2026. Sources checked this date. Companion to `APP_STORE_GUIDE.md`.

---

## 1. Executive summary

**The product thesis is sound. The consumer-app business model is not.**

- Tailored resumes genuinely work: **5.8% vs 3.73%** response rate vs untailored, and referral-free job-board applicants convert at only 1.2–7% ([Demand Recruiting, 2026](https://www.demandrecruiting.com/job-seeker-guide)). Teaching people to tailor is the highest-leverage service in job seeking.
- But the two features ProReady leads with — AI resume building/ATS scoring and AI mock interviews — are **commoditized and increasingly free**.
- The **median subscription app earns $492/month**; **59.3% of subscription apps make under $1,000 total**; only **7.2% ever cross $100K** ([Adapty, 2026](https://adapty.io/state-of-in-app-subscriptions/)).

**Recommendation:** launch the stores as credibility + funnel, price with a generous free tier and one honest paid tier, and pursue **institutional licensing (workforce boards, colleges, agencies)** as the primary revenue path.

---

## 2. Competitive landscape

### Resume building / ATS / proofreading — saturated, low price ceiling

| Tool | Free tier | Paid | Positioning |
|---|---|---|---|
| **Huru** | Everything free for job seekers (since 2026-09-28) | Enterprise only | Resume builder + ATS + rewrites + mock interviews |
| **Rezi** | 1 resume, 3 PDFs | $29/mo, $149 lifetime ($12/mo annual) | ATS-first, 23-point scoring |
| **Jobscan** | 5 scans/30 days | $49.95/mo, $29.98/mo quarterly, $24.95/mo annual | Deep ATS keyword matching |
| **Teal** | ~90% of features | $29/mo, $13/wk, $79/quarter | Job tracking + tailoring |
| **Kickresume** | Free builder, unlimited downloads | $8/mo annual → $24 monthly | Templates, AI drafting |
| **Enhancv** | Free w/ watermark | $19.99/mo | Design-led |
| **SkillSyncer** | — | $14.95/mo | Cheapest dedicated ATS tool |

Sources: [Omid Saffari (Aug 2026)](https://omidsaffari.com/blog/best-ai-resume-builder), [Awesome Agents (May 2026)](https://awesomeagents.ai/tools/best-ai-resume-writers-2026/), [Digital Tatva (Oct 2026)](https://digitaltatva.com/best-ai-resume-builders/).

### Interview practice — the floor just collapsed

| Tool | Price | Format |
|---|---|---|
| **Huru** | **$0 for job seekers** | Live AI interviewer w/ follow-ups, per-answer /100 scores, 50k question library, iOS since 2021 |
| **Big Interview** | $39/30 days, $99/3 mo, $299 lifetime; ~$79/mo list | 170+ lessons + video AI feedback; **sells institutional licenses** |
| **Yoodli** | $8–28/mo | Delivery coach (pace, fillers) |
| **Four-Leaf** | $20/mo or $5 five-day pass | 24+ roles, voice mocks |
| **Final Round AI** | $25–150/mo | Copilot + practice |
| **Exponent/Aced** | $79/mo Pro, $99/mo Expert | Peer + AI mocks |
| **interviewing.io** | $179+/session | Human FAANG mocks |
| **Google Interview Warmup** | **Retired April 2026** | Was the free default |

Sources: [Huru about page](https://huru.ai/about/), [CoPilot Interview review (Oct 2026)](https://copilotinterview.com/blog/huru-ai-review), [EchoPitch comparison](https://echopitch.io/best-ai-mock-interview-app), [Four-Leaf](https://four-leaf.ai/blog/best-mock-interview-platforms-2026), [Mocky.pro](https://mocky.pro/en/blog/ai-mock-interview-tools-compared).

### Nobody owns what ProReady does well

1. **Proofreader-first**: constructive, prioritized, line-by-line feedback on the resume someone *already has*, with evidence coaching ("add the number"). Jobscan scores match; Rezi scores ATS safety; neither teaches.
2. **Staged formal interview**: elevator intro → motivation → work history → posting-skill proof → behavioral → scenario → candidate questions → close, with probing follow-ups. Competitors use question banks or open-ended roleplay.
3. **On-device, no upload**: no account, no cloud AI. A procurement argument for institutions.
4. **Non-collegiate professional audience**: mid-career, small-city, healthcare/admin/trades/skilled-office roles — not FAANG.

---

## 3. App-store economics you must price against

| Metric | Value | Implication |
|---|---|---|
| Median subscription app revenue | **$492/month** | Consumer revenue is existential only for a few |
| Apps earning < $1,000 total | **59.3%** | Most never reach meaningful scale |
| Apps above $100K | **7.2%** | A marketing problem, not a product problem |
| Install → paid (freemium) | **~2.2%** | 4,000 installs → ~88 payers |
| Install → paid (in-app paywall) | **~1.6%** | Worse than freemium for this use case |
| Annual retention @ 12 mo | **44.1%** | Best structure for retention |
| Monthly retention @ 12 mo | **17.5%** | Typical for our plans |
| Weekly retention @ 12 mo | **3.4%** | Highest LTV mechanic; ethically wrong for unemployed users |
| Price vs conversion | High-priced apps convert **better** (2.7% vs 1.5%) and earn **7× Y1 LTV** | Do not underprice |
| Median app prices | $6.68–12.99/mo, $29.99–38.42/yr | Anchor within/above monthly median |

Sources: [Adapty State of In-App Subscriptions 2026](https://adapty.io/state-of-in-app-subscriptions/), [Airbridge benchmarks](https://www.airbridge.io/en/blog/subscription-app-pricing-by-category-2026-benchmark).

**Category-specific trap:** a job search lasts 4–12 weeks and ends when the user succeeds. You are structurally built to churn. Annual plans and weekly billing both fight this; a fixed-duration pass fits it.

**Revenue ceiling math (consumer only):** to net $1,000/month at $14.99 (~$12.74 net of the 15% Small Business rate) requires ~80 payers/month at 2% conversion = **~4,000 installs/month**, which at $1–3 CPI costs $4,000–12,000 in acquisition. Consumer-only is a break-even-to-losing proposition without organic reach.

---

## 4. Recommended pricing

### Consumer (App Store / Play Store + PWA)

| Tier | Price | Contents | Rationale |
|---|---|---|---|
| **Free** | $0 | Full resume builder, **1 proofread/month**, **1 full mock interview**, all Prep School lessons, follow-up tools | Must beat Huru's free tier on *usefulness per minute*, not feature count. Free is the only acquisition channel. |
| **Search Pass** | **$14.99/month** | Unlimited proofreads, mocks, rewrites, report exports | Under Rezi ($29) and Jobscan ($49.95); above the $9.99 clutter to signal real value. |
| **Interview Pass** | **$29.99 / 90 days**, non-renewing | Same, fixed term | Matches the real duration of a job search; no accidental renewal. |
| **Pro Lifetime** | **$89.99 one-time** | Same, forever | Rezi's $149 lifetime validates demand; price below it. Serves repeat job hunters. |

**Do not:** bill weekly (best LTV in the data, but predatory for unemployed users and reputationally fatal for a "warm coach" brand). **Do not** launch annual — sell the 90-day pass instead.

**Immediately:** enroll in [Apple's Small Business Program](https://developer.apple.com/app-store/small-business-program/) (15% instead of 30% under $1M/year revenue).

### Institutional (primary revenue path)

Buyers: Michigan Works! agencies and American Job Centers (WIOA-funded), community colleges and career services, vocational rehabilitation, reentry programs, libraries, staffing/temp agencies, employer HR for outplacement.

| Package | Price | Includes |
|---|---|---|
| Cohort seat | **$6–12/seat/year** (50+ seats) | App access, coach dashboard |
| Site license | **$2,500–$15,000/year** | Unlimited local seats, onboarding, reporting |
| Enterprise | quote | SSO, custom branding, DPA, priority support |

**Ten site licenses at $6,000 = $60,000/year** — more than a consumer app in this category reaches in most developers' lifetimes, and it requires zero App Store marketing spend.

**Why they'll pay:** Huru's only paid plan is Enterprise; Big Interview built its business on college licenses. Funders require outcome reporting. ProReady's on-device processing answers the data-policy objection that kills most student-data tools.

**What must be built before selling institutionally (do not sell before this exists):**
1. Coach/instructor dashboard — who started, who finished, readiness scores
2. Cohort progress + outcome reporting, CSV/PDF export
3. Admin seat management
4. A written data-processing statement (on-device = nothing to process)
5. WCAG 2.1 AA accessibility pass
6. Spanish localization (large share of workforce-program participants)
7. Optional SSO / rostering (CSV import is enough for a first sale)

---

## 5. Go-to-market order

**Weeks 1–2 — Validate before spending.**
- Host the PWA publicly (free tier, no paywall). Shareable URL for demos.
- Book 3 meetings: a Michigan Works! / American Job Center manager, a community college career services director, a staffing-agency owner. Demo the **proofreader** (fastest "oh, that's useful") and one **mock interview** end to end.
- Ask: *"If this were free to your clients, what would you need to see to pay for it?"* and *"What do you currently spend on this problem?"*

**Weeks 3–6 — Ship for credibility.**
- Android first (12-tester / 14-day gate starts the clock), iOS in parallel via TestFlight.
- Launch free tier only. No paywall on day one — collect installs, ratings, and testimonials.
- Turn on the paid tier once you have ~50 reviews and know which feature people actually use.

**Weeks 7–12 — Convert intent.**
- If any agency said yes: build the dashboard, close one pilot (even $1,500 proves the model).
- If nobody said yes: keep it free, treat it as a portfolio asset and lead generator, and stop spending on it.

---

## 6. Decision rules (pre-commit to these)

| Signal | Action |
|---|---|
| ≥1 agency will pay for a pilot | Build the dashboard; institutional becomes the product |
| 3 agencies say "interesting, no budget" | Consumer-only: ship free, monetize modestly, no ad spend |
| <300 installs after 60 days with 5 hours/week of promotion | Accept it as a portfolio piece; stop investing |
| Paid conversion >4% on free tier | Raise price; you're underpriced |
| Refund/complaint rate >5% citing billing | Simplify to one-time pricing only |

---

## 7. Risks

1. **Huru (and similar) being free.** The single biggest threat. Never compete on "AI resume + mock interview"; compete on proofreading depth, staged formality, and privacy.
2. **Distribution, not product.** 7.2% of subscription apps cross $100K — the failures are marketing failures, not feature failures.
3. **Heuristic scoring reputation risk.** The app does not use a language model for scoring. Do not describe it as "AI-verified" in listings; describe it as a practice simulator with adaptive feedback.
4. **Platform dependency.** Apple can reject an app for "minimum functionality" (4.2). Mitigations already in place: offline behavior, native shell, camera practice, on-device parsing, saved progress.
5. **Trademark.** "ProReady" should be checked in the relevant class before paying for accounts.
