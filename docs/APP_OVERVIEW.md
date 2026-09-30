# Anyash — App Overview

Anyash is an eldercare voice companion. A family member (the "child") registers
an elderly parent; an AI voice agent named **Anya / Anyash** then phones the
parent for short, warm daily check-ins in their own language. After every call
the system extracts structured health data, updates a rolling memory of the
parent, and produces a decision card for the family/operator.

This repo is the **operator dashboard** (Next.js on Vercel). It works together
with two external systems:

| Piece | Where it lives | Role |
|---|---|---|
| Dashboard + API routes | This repo (Next.js 14, deployed on Vercel) | Manage parents, trigger calls, browse call logs, transcripts, recordings |
| Voice agent | Sarvam AI — app `Anyash Health` (`Anyash-Heal-91a5077a-a5b2`) | Places the phone call, runs the conversation, extracts post-call variables |
| Database + memory engine | Supabase project `Anyash` (`vsljapxjdhqqaqvurajp`, ap-south-1) | Postgres tables + the `sarvam-call-handler` Edge Function |

---

## 1. End-to-end flow

```
Operator (dashboard)
   │  "Call now" on a parent
   ▼
POST /api/calls/outbound ──► Supabase parent_profiles (find/create by phone,
   │                         read current_user_context + number_of_calls)
   │
   ▼
Sarvam Outbound API  (app_id, app_version, connection_id, agent phone,
   │                  agent_variables: parent_name, honorific, child_name,
   │                  user_id, user_context, number_of_calls, language)
   ▼
Phone call with the parent  ── in-call tool ──►  Edge Function
   │                           query_parent_history   sarvam-call-handler
   │                           (diet/sleep/vitals/     reads daily_health_logs
   │                            pain/general)          and answers in Hinglish
   ▼
Call ends → Sarvam fills post-call variables (call_summary, call_outcome,
            health_update, parent_mood, follow_up_needed, ...)
   │
   ├──► Webhook  POST /api/webhooks/sarvam  (this app)
   │       only fills call status / duration on call_records by attempt_id
   │
   └──► Edge Function sarvam-call-handler (Sarvam on_end tool
        "record_call_assessment"; the only post-call writer)
           • real call = ≥45 s, ≥3 parent turns, conversational call_outcome;
             anything else is saved as no_conversation and changes nothing
           • OpenAI model builds: daily health log, new user_context
             (≤260 words, with PERSONAL and LIFE THREADS), decision card
           • upserts daily_health_logs, call_records; inserts decision_cards;
             updates parent_profiles.current_user_context / number_of_calls
   ▼
Dashboard reads Sarvam Analytics (attempts, transcripts, recordings)
+ Supabase (profiles, daily logs) to show everything.
```

The Edge Function source lives in `supabase/functions/sarvam-call-handler`
(tests: `cd supabase/functions/sarvam-call-handler && deno test`). The live
Sarvam prompt is saved under `prompts/` before each edit.

---

## 2. Dashboard (frontend)

Every screen follows one priority order: who needs attention now, then what
happened today, then trends, then reference details. Design: no nested
cards; typography, spacing and label/value rows; status as a colored dot plus
text; the yellow accent only on the main action. Tokens live in
`tailwind.config.js` (`ay-*`), shared pieces in `components/anyash/primitives.tsx`
(buttons, modal, fields, tabs, toast) and `components/anyash/detail-ui.tsx`
(sections, label/value rows, status vocabulary, memory rendering).

Attention ranking (`lib/attention.ts`), shared by Today and the Parents list:
escalate → let the family know → follow-up needed → not reached today → no
check-in for 2+ days → keep an eye on it → no concerns. A follow-up marked
done (`decision_cards.action_completed`) drops out.

### `/` — Today
File: `app/page.tsx`
- One-line summary: checked in, calls placed, needing attention.
- **Needs attention**: each item with its reason, **Call** and **Mark done**.
- **Today's check-ins**: every parent's state today (checked in / not
  reached / not called yet) with the call summary or what Anya will ask.

### `/parents` — Parents
File: `app/parents/page.tsx` (`?id=` selects a parent; on phones the list
and the detail are separate screens).
- **List** (`ParentsListColumn.tsx`): sorted by attention, status dot, last
  call, verdict and reason.
- **Detail** (`ParentDetailCanvas.tsx`), tabs:
  - *Overview*: verdict and reason, what Anya will ask, next step; latest
    check-in with audio; **last 7 days** strip (`TrendStrip.tsx`: check-in,
    sleep, pain, mood, appetite, medicines).
  - *Calls*: every call; opens the call drawer.
  - *Memory* (`MemoryPanel.tsx`): Anya's memory as sections, edit in place,
    history of how it changed per call.
  - *Profile*: contact, call timing, home and life, the child's worry
    (dashboard only), conditions, medicines, routine. Answers from the
    family that the parent hasn't confirmed are marked.
- **Pop-ups** (`useParentActions.tsx`): Call (`CallModal.tsx`), Add/Edit
  parent with the child's onboarding questions (`ParentFormModal.tsx` +
  `OnboardingForm.tsx`), Remove.
- **Copy onboarding link** (list header): creates a single-use link to
  `/onboard/[token]` (14 days) and copies it.

### `/onboard/[token]` — the child's onboarding form (public)
Mobile-first page without the dashboard shell. The same questions as the
Add pop-up (`lib/onboarding.ts`): basics, household, day, health, life,
things to avoid, and the child's worry. Saving creates the parent and uses
up the link; a phone already on file is refused. Every answer is stored as
`{ value, source: "child", confirmed: false }`, and the starting
`current_user_context` is written from a fixed template (PERSON / DAY /
HEALTH / LIFE / AVOID / NOTE). `child_worry` never reaches the agent.
Examples: `docs/phase2/`.

### `/memory/[parentId]` — progressive memory (Phase 3)
Linked from the parent's Memory tab. Shows, per call, the old memory next to
the new pre-call brief (and which one was sent), the brief mode, open and
closed threads with the parent's last words, the living profile (current or
with history), reflections, and the event log by call.

### `/calls` — Calls
File: `app/calls/page.tsx`
- Calls since **25 Sep 2026** (intentional cutoff), grouped by day, with
  status, one-line summary, duration and AI verdict. Filters: All · Needs
  attention · Not reached, plus search.
- **Call drawer** (`CallDetailDrawer.tsx`): Summary (AI assessment, health
  log, mood), Conversation, Memory (what changed on this call).

### `/insights` — Insights
Files: `app/insights/page.tsx`, `lib/insights.ts` (pure calculations),
`app/api/insights/route.ts` (data), `components/anyash/charts.tsx`.

Real trial calls only (see *Trial and test calls* below), for the last 7
days, 30 days or the whole trial, compared with the previous period when
that period is also inside the trial.

- **What the data says:** up to 6 findings written from the numbers, things
  to fix first (calls cut off by the time limit, calls under 30 s and when
  they happen, parents with few real conversations), then what works.
  Needs at least 5 calls.
- **Headline:** daily check-in coverage (parent-days with a call that met
  the goal, over completed days), goal met (Sarvam evaluation
  `overall_status`, falls back to `call_outcome`), picked up, typical call.
- **Charts:** calls per day, funnel (dialled → connected → conversation of
  4+ turns → goal met → health captured), how calls end (`end_reason`),
  turns by call number, calls by hour (India time), evaluation criteria,
  openness, mood, topics covered in daily health logs, follow-ups.
  Every chart has a hover/focus tooltip and a Table view.
- **Where calls stall:** connected calls under 30 s with Anya's last line
  from the Sarvam transcript and whether the parent spoke.
- **Per parent:** calls, goal met, typical length, turns trend, last call
  and a flag (getting shorter / often no real conversation / every call met
  the goal).
- **Speed and cost:** Anya's and the parent's reply time (Sarvam
  averages; 0 means not measured and is skipped), minutes and an estimate
  (₹4.5 per started minute + ₹0.4 per 30 s telephony).
- Footnote lists how many test calls were left out and why.

`/api/insights` builds a call ledger from Sarvam attempts (all pages since
the trial start), parents, `call_records`, `daily_health_logs` and
`decision_cards`; kept for 60 s on the server and 5 min in the client.

### Trial and test calls
`lib/trial.ts` — used by `/api/calls`, `/api/parents` and `/api/insights`.
- The trial starts **25 Sep 2026 00:00 India time** (`2026-09-24T18:30Z`);
  anything earlier is left out. Sarvam times without a zone are UTC.
- A call is a test and left out if it is: a web/playground session
  (contact is an email), marked debug in Sarvam, inbound, to a placeholder
  number (9876543210, 1234567890), for a parent named "Test", with outcome
  `test_call`, or (when the parent list is known) to a number that isn't a
  parent.

### Settings
Sidebar → Settings: Sarvam agent version (`AgentSettingsModal.tsx`).

### Data loading

Stack: Next.js 16 (App Router, Turbopack, React Compiler), React 19,
TanStack Query 5.

- **One client cache** (`lib/queries.ts`, provider in `app/providers.tsx`).
  The sidebar and cache live in the root layout, so they persist across page
  changes. Parents and calls are prefetched when the app opens; switching
  pages uses the cache and makes no network requests.
- **Freshness:** data counts as fresh for 30 s, then refreshes in the
  background on tab focus and every 60 s while the tab is visible; after a
  call is placed it refreshes at once, at 20 s and at 90 s. A failed
  background refresh keeps the cached data on screen with a notice.
- **Per-call data** (review, transcript) and per-parent memory are cached
  by key and prefetched on hover/focus of a call row or when a parent opens.
- **Mutations:** Mark done updates instantly and rolls back on error; memory
  saves update every screen that shows it; add/edit/remove refresh the cache.
- **Server:** `/api/parents` runs its Supabase queries in parallel and
  `/api/parents` + `/api/calls` share one Sarvam attempts request
  (`lib/sarvam.ts#getSarvamAttempts`, 15 s reuse, concurrent requests
  merged).
- **Loading UI:** skeletons shaped like each screen (`Skeletons.tsx`), no
  spinners; `app/error.tsx` catches page crashes.

---

## 3. API routes (`app/api`)

| Route | Method | What it does |
|---|---|---|
| `/api/parents` | GET | All `parent_profiles` + Sarvam calls (linked by phone) + last 14 `daily_health_logs` + recent AI reviews (`call_records` + `decision_cards`) each |
| `/api/parents` | POST | Create a parent from the onboarding form (or update the one with the same phone). Writes the starting `current_user_context` |
| `/api/parents/[id]/memory` | GET | Current memory plus how it changed on each call |
| `/api/memory/[parentId]` | GET | Progressive memory: briefs with the context sent, profile facts (with history), threads, reflections, events |
| `/api/decisions/[id]` | PATCH | Mark a decision card's follow-up done / not done |
| `/api/calls/details` | GET | AI assessment, decision card and health log for one call (`attempt_id`) |
| `/api/parents/[id]` | PATCH | `{ profile }` saves the onboarding form (starting memory rewritten only before the first real call); other fields (e.g. `current_user_context`) are saved as given |
| `/api/onboarding/links` | POST | New single-use onboarding link |
| `/api/onboarding/[token]` | GET / POST | Check a link / save the child's form and use up the link |
| `/api/parents/[id]` | DELETE | Deletes daily logs, call records, decision cards, then the parent |
| `/api/calls/outbound` | POST | Finds the Supabase profile (refuses numbers with no profile, and calls after the latest call time), syncs call count & context, calls Sarvam Outbound API. Gets a pre-call brief from `build-brief`: in `shadow` mode after the call is placed (old context sent), in `live` mode before it (brief sent; old context if the brief fails). Falls back to a **simulated** attempt if telephony env vars are missing |
| `/api/insights` | GET | Trial call ledger for Insights: Sarvam attempts + evaluations joined with Supabase reviews, logs and follow-ups; test calls counted by reason |
| `/api/calls` | GET | Sarvam Analytics attempts (outbound, non-test, since 25 Sep 2026), normalised, name-matched to parents, with the AI verdict from `call_records` |
| `/api/calls/transcript` | GET | Transcript by `interaction_id` from Sarvam; falls back to `call_records.transcript` |
| `/api/calls/recording` | GET | Streams the call audio from Sarvam |
| `/api/calls/sync` | GET | Legacy: last 30 days of attempts + transcripts, builds decision cards heuristically |
| `/api/analytics` | GET | Overview + goal metrics (connectivity, duration, cost in INR, turns, language split) (not used by the UI) |
| `/api/health/analyze` | POST | Legacy keyword heuristic (chest/knee/sleep/missed meds) → decision card |
| `/api/settings` | GET / PUT | Read / save the Sarvam agent version used for outbound calls (stored in `app_settings`) |
| `/api/webhooks/sarvam` | POST | Sarvam post-call webhook: fills `call_status` / `duration_seconds` on the `call_records` row for the attempt (creates a minimal row for unanswered calls) |

Test calls are filtered out (`lib/sarvam.ts#isTestCall`): web sessions
(contact contains `@`), dummy numbers `9876543210` / `1234567890`, or
parent named "Test" with <5 s.

Cost model (`lib/analytics.ts`): usage ₹4.50 per started minute + telephony
₹0.40 per started 30 s, connected calls only.

---

## 4. Sarvam voice agent — `Anyash Health`

- **App ID** `Anyash-Heal-91a5077a-a5b2`, latest **version 26**, status
  **draft**, channel voice-to-voice, single-prompt mode, temperature 0.5.
- **Not deployed** for inbound: no deployments, no campaigns. Calls are
  placed only via the outbound API from the dashboard.
- **Persona** ("start" state): warm, unhurried female companion set up by
  `{{child_name}}` for `{{parent_name}}`; not a doctor; discreet; one question
  at a time; simple Hindi/Hinglish; admits being an AI if asked.
- **Intro message**: "Namaste {{parent_name}} ji, main Anyaash bol rahi
  hoon. Abhi baat kar sakti hain?" (localised for 12 languages).
- **Languages**: starts in Hindi; auto language ID across Hindi, Bengali,
  English, Gujarati, Kannada, Marathi, Malayalam, Odia, Punjabi, Telugu,
  Tamil. TTS speaker `simran`.
- **Limits**: max call 240 s; inactivity nudge after 5 s, ends after
  consecutive nudges; barge-in allowed; agent can end the call.
- **Memory**: Sarvam episodic memory on, last 7 interactions.
- **Privacy**: phone numbers masked (`******1234`) and SHA-256 hashed;
  emails masked.
- **Tool**: `query_parent_history` → POST to Supabase Edge Function
  `sarvam-call-handler` with `topic` ∈ {diet, sleep, vitals, pain, general}
  and `user_id`. 10 s timeout; Hindi apology on failure.
- **Evaluation**: "Call Goal" achieved when `call_outcome = meaningful_checkin`.

### Agent variables

Inputs (set by the dashboard): `parent_name`, `honorific`, `child_name`,
`number_of_calls`, `user_id`, `user_context`, `today_date`, `gender`,
`supabase_anon_key`.

Post-call outputs (Sarvam's LLM fills after the call):

| Variable | Values |
|---|---|
| `call_summary` | 1–2 lines |
| `call_outcome` | meaningful_checkin, partial_checkin, busy_or_refused, wrong_person, no_conversation, test_call |
| `health_update` | 2–3 lines on symptoms, meds, routine |
| `conversation_signal` | volunteered_details, answered_with_prompts, reluctant_or_brief, mixed |
| `follow_up_needed` | yes, no, unclear |
| `follow_up_detail` | what needs attention |
| `parent_mood` | calm_positive, neutral, low_or_flat, anxious_or_worried, irritable, mixed |
| `mood_note` | mood cues |
| `ongoing_health_context` | durable 3–5 line health baseline |
| `personal_context` | durable 3–5 line personal/family context |

---

## 5. Supabase

Project **Anyash** (`vsljapxjdhqqaqvurajp`, Postgres 17, ap-south-1). RLS is
enabled on every table; the app uses the service-role key server-side.
Security advisor: no findings.

Migrations: `create_call_records_and_decision_cards`,
`create_parent_profiles_and_daily_health_logs`,
`add_unique_index_parent_id_log_date`, `create_app_settings`.

### Tables

**`parent_profiles`** (one per parent; `phone_number` unique)
`id`, `phone_number`, `parent_name`, `child_name`, `honorific` (default
"Mummy Ji"), `number_of_calls` (default 1), `last_call_timestamp`,
`current_user_context` (the rolling memory injected into the next call),
`language`, `preferred_call_time`, `sleep_time` ("HH:MM" India time),
`facts` jsonb (relationship, living_situation, household_help, enjoys,
avoid_topics, child_worry as `{value, source, confirmed}`; plain language
and family_member), `routines` jsonb (`{name: wake|sleep, time, ...}` plus
older `{time, activity}` rows), `medical_baseline` jsonb (conditions,
medicines), timestamps.

**`onboarding_tokens`**: `token_hash` (SHA-256 of the link token), `expires_at`,
`used_at`, `parent_id`. Service role only.

**`daily_health_logs`** (one per parent per day — unique `parent_id, log_date`)
`parent_id` → parent_profiles, `call_id` → call_records, `log_date`,
`sleep_hours`, `sleep_quality`, `sleep_notes`, `meals_reported`, `appetite`,
`medication_adherence`, `vitals_reported`, `mobility_and_pain`,
`mood_and_energy`, `incidents_red_flags`, `raw_summary`.

**`call_records`** (one per Sarvam attempt — unique `attempt_id`)
IDs, parent link, status, duration, audio, failure reason, every Sarvam
post-call variable, `raw_agent_variables`, `transcript`,
`previous_user_context` / `resulting_user_context`, and the AI assessment
(`ai_model`, `ai_observation`, `ai_interpretation`,
`ai_recommended_action`, `ai_action_type`, `ai_urgency`, `ai_decision`,
`ai_uncertainty`, `ai_family_notification`, `ai_raw_response`).

**`decision_cards`** (one per processed call)
`call_id` → call_records, `attempt_id`, `profile_id`, `parent_name`,
`observation`, `interpretation`, `recommended_action`, `action_type`
(remind/ask/buy/check/schedule/escalate), `urgency` (low/medium/urgent),
`decision` (NORMAL/MONITOR/FAMILY_NOTIFICATION/ESCALATION), `why`,
`next_action`, `next_follow_up_date`, `family_notification`,
`action_completed`.

**`app_settings`** (key/value settings edited from the dashboard)
`key` (PK), `value` jsonb, `updated_at`. Holds `sarvam_app_version` and
`memory_brief_mode` (`"shadow"` | `"live"` | `"off"`).

**Progressive memory** (Phase 3, migration `20260930210000_progressive_memory`;
written only by the edge functions):
- `memory_events`: what the parent said on each real call (category, the
  parent's own words, summary, importance 1–5). Insert-only (trigger).
- `profile_facts`: the living profile, one current value per
  parent/block/key (`valid_to is null`); changes close the old row. Seeded from
  onboarding (`source child, confirmed false`), kept in sync when the form is
  saved; a fact the parent confirmed is never replaced by the form.
  `child_worry` is refused by a check constraint.
- `threads`: open items (importance ≥3) with `next_ask_call` and the parent's
  last words; closed as resolved, or faded after 5 calls without mention.
- `reflections`: 2–3 patterns every 5th real call, each citing event ids.
- `call_briefs`: pre-call briefs (`mode` shadow / live / example), the
  `attempt_id` and the `sent_user_context` of the call they were built for.
- `internal_config.memory_secret`: shared secret for internal calls
  (`x-memory-secret`).

### Edge Function `sarvam-call-handler` (`verify_jwt: false`, source in `supabase/functions/`)

Two modes on POST:

1. **`query_parent_history`** (in-call tool): loads the last 7
   `daily_health_logs` for `user_id` and returns a short Hinglish answer for
   the topic (e.g. "Kal (28 Sep) ko BP 130/85 tha").
2. **Post-call assessment** (Sarvam's on_end tool, which also sends
   `attempt_id`, `interaction_id`, `call_duration_seconds` and the
   transcript): a real call (≥45 s, ≥3 parent turns, call_outcome not
   no_conversation / busy_or_refused / wrong_person / test_call) sends
   previous context + last 2 daily logs + Sarvam variables + transcript to
   OpenAI (`gpt-6-luna`, reasoning effort medium, JSON output). Writes the
   daily log, the new `current_user_context` (LAST UPDATED / BASELINE /
   ROUTINE / PERSONAL / ROLLING LOG / ACTIVE WATCHLIST / LIFE THREADS),
   `call_records`, and a `decision_cards` row; increments `number_of_calls`.
   Any other call is saved with `call_status = no_conversation` and the
   profile is untouched. If the model fails, the previous memory is kept.
   With `MEMORY_V1=off` (function secret) the old `current_user_context`
   rewrite stops; everything else still runs.
3. **Memory pipeline** (after a real call, in the background): extractor →
   profile updater (ADD / CONFIRM / UPDATE, each citing event ids) → thread
   rules → reflection every 5th call. Models propose; `lib/memory/rules.ts`
   decides: quotes must match a parent turn, facts need evidence from this
   call, thread timing is fixed. Prompts: `prompts/extractor.ts`,
   `profile_updater.ts`, `reflection.ts`, `brief.ts`.
4. **`memory_backfill`** (needs `x-memory-secret`): replays a parent's past
   real calls (2 per run) and then writes an `example` brief.

### Edge Function `build-brief` (`verify_jwt: false`, needs `x-memory-secret`)

POST `{ parent_id, call_number?, mode? }` → a 120–150 word brief (who they
are; how they like to talk; the threads due, with the parent's words; 1–2
health areas not covered this week; things to avoid), saved to
`call_briefs`. Required threads (due, and life threads from the last call)
are checked; the brief is rewritten once, then any still missing are appended.
Deploy both functions with `scripts/bundle-functions.sh` (single-file bundles).

**Bedtime guard**: `parent_profiles.preferred_call_time` / `sleep_time`
("HH:MM", India time, editable on the parent's Profile tab). The outbound
route refuses calls after sleep_time − 60 min (or preferred_call_time + 90
min when sleep_time is empty) and returns the reason.

---

## 6. Configuration

Env vars (`.env.example`):

| Var | Used for |
|---|---|
| `SARVAM_API_KEY` | All Sarvam API calls (secret) |
| `SARVAM_ORG_ID`, `SARVAM_WORKSPACE_ID`, `SARVAM_APP_ID`, `SARVAM_APP_VERSION` | Which agent/version to call |
| `SARVAM_CONNECTION_ID`, `SARVAM_AGENT_PHONE_NUMBER` | Telephony; without them outbound calls are simulated |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB access (secret) |
| `APP_BASE_URL` | Base for the Sarvam webhook URL (default `https://anyash.vercel.app`) |
| `OPENAI_API_KEY` | Only the Edge Function uses OpenAI; set it as a Supabase function secret (`OPENAI_KEY` also accepted) |

**Agent version** is set from the dashboard: sidebar → **Settings** → enter
the version → Save. It is stored in Supabase `app_settings`
(`key = sarvam_app_version`). Outbound calls use: saved setting →
`SARVAM_APP_VERSION` env → 12.

Scripts: `npm run dev`, `npm run build`, `npm start`, `npm run typecheck`,
`npm test` (Insights calculations and the test-call rule, checked against
the real trial calls in `tests/insights.test.ts`).
Node 20.9 or newer (required by Next.js 16).

---

## 7. Known issues / risks

1. **Leaked OpenAI key** — earlier versions of `sarvam-call-handler`
   (up to v14) contained a hard-coded OpenAI key. The code now reads only the
   function secret; rotate the old key.
2. **Edge Function is unauthenticated** (`verify_jwt: false`, no shared
   secret). Anyone with the URL who knows a parent id can read that parent's
   health history, and can write call records. Add a shared-secret header
   checked by the function and configured in the Sarvam tool.
3. **Heuristic decision cards** in `/api/calls/sync` and `/api/health/analyze`
   are keyword-based and separate from the AI cards stored in
   `decision_cards` (which the dashboard now reads). Those legacy routes are
   unused by the UI.
4. **No login**: the dashboard and its API routes are open to anyone with
   the URL.
