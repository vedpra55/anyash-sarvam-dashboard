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
   │       increments parent_profiles.number_of_calls, updates CALL COUNT
   │
   └──► Edge Function sarvam-call-handler (post-call "record_call_assessment")
           • OpenAI model builds: daily health log, new rolling user_context
             (≤180 words), decision card
           • upserts daily_health_logs, call_records; inserts decision_cards;
             updates parent_profiles.current_user_context / number_of_calls
   ▼
Dashboard reads Sarvam Analytics (attempts, transcripts, recordings)
+ Supabase (profiles, daily logs) to show everything.
```

> ⚠️ Both the app webhook and the Edge Function increment
> `number_of_calls`. If both run for the same call the counter can advance
> by 2. It is not clear from the code or Sarvam config what currently
> invokes the Edge Function's post-call path (the outbound call's
> `webhook_config.url` points at the app route) — confirm and keep only one
> writer.

---

## 2. Dashboard (frontend)

Only the pages below are wired up. The `components/anyash/*` components are
the live UI.

### `/` — Parents
File: `app/page.tsx`

- **Sidebar** (`anyash/Sidebar.tsx`): nav to Parents and Calls.
- **Parents list** (`anyash/ParentsListColumn.tsx`): all rows of
  `parent_profiles`, with latest call status.
- **Parent detail** (`anyash/ParentDetailCanvas.tsx`): phone, honorific,
  language, caregiver/child, known conditions, medicines, usual routine,
  family & caregiver context, mood, **Daily Health Logs** (last 10), and
  **Check-in Calls History** (Sarvam calls matched by last 10 phone digits).
- **Add / Edit / Delete parent** (`AddParentModal`, `EditParentModal`,
  delete confirm in `page.tsx`).
- **Call modal** (`anyash/CallModal.tsx`): pick language, call number,
  optionally override the "context for this call" (user_context) and the
  greeting, then triggers `POST /api/calls/outbound`.

### `/calls` — Call logs
File: `app/calls/page.tsx`

- Table of all outbound calls since **25 Sep 2026** (hard-coded cutoff),
  filters by status (Connected / Busy-Unanswered) and time.
- **Call detail drawer** (`anyash/CallDetailDrawer.tsx`): summary, outcome,
  mood, follow-up, transcript and audio recording.

### Unused / legacy code
Not imported by any page — earlier iterations kept in the repo:
`components/operator/*`, `components/platform/*`, and the root-level
components (`Header`, `CallTriggerCard`, `ConfigModal`, `WebVoiceSimulator`,
`LivingSummaryCard`, `ActionDecisionFeed`, `CallHistoryCard`,
`ProfileEditModal`), plus `lib/storage.ts` (localStorage store) and
`lib/prompts.ts#buildHealthCompanionPrompt`. Candidates for deletion.

---

## 3. API routes (`app/api`)

| Route | Method | What it does |
|---|---|---|
| `/api/parents` | GET | All `parent_profiles` + Sarvam calls (linked by phone) + last 10 `daily_health_logs` each |
| `/api/parents` | POST | Create parent (or update existing with same phone). Seeds `current_user_context`, `facts`, `routines`, `medical_baseline` |
| `/api/parents/[id]` | PATCH | Update parent fields; keeps the initial 2-line context in sync with names |
| `/api/parents/[id]` | DELETE | Deletes daily logs, call records, decision cards, then the parent |
| `/api/calls/outbound` | POST | Resolves/creates the Supabase profile, syncs call count & context, calls Sarvam Outbound API. Falls back to a **simulated** attempt if telephony env vars are missing |
| `/api/calls` | GET | Sarvam Analytics attempts (outbound, non-test, since 25 Sep 2026), normalised and name-matched to parents |
| `/api/calls/transcript` | GET | Transcript by `interaction_id` from Sarvam; falls back to `call_records.transcript` |
| `/api/calls/recording` | GET | Streams the call audio from Sarvam |
| `/api/calls/sync` | GET | Legacy: last 30 days of attempts + transcripts, builds decision cards heuristically |
| `/api/analytics` | GET | Overview + goal metrics (connectivity, duration, cost in INR, turns, language split) — used by legacy platform tabs |
| `/api/health/analyze` | POST | Legacy keyword heuristic (chest/knee/sleep/missed meds) → decision card |
| `/api/settings` | GET / PUT | Read / save the Sarvam agent version used for outbound calls (stored in `app_settings`) |
| `/api/webhooks/sarvam` | POST | Sarvam post-call webhook: bumps `number_of_calls` on a successful call and updates `CALL COUNT` in the context |

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
`facts` jsonb (relationship, language, family_member), `routines` jsonb,
`medical_baseline` jsonb (conditions), timestamps.

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
`key` (PK), `value` jsonb, `updated_at`. Currently holds `sarvam_app_version`.

### Edge Function `sarvam-call-handler` (v14, `verify_jwt: false`)

Two modes on POST:

1. **`query_parent_history`** (in-call tool): loads the last 7
   `daily_health_logs` for `user_id` and returns a short Hinglish answer for
   the topic (e.g. "Kal (28 Sep) ko BP 130/85 tha").
2. **Post-call assessment** (any other payload): if the call connected, sends
   previous context + last 2 daily logs + Sarvam variables + transcript to
   OpenAI (`gpt-6-luna`, reasoning effort medium, JSON output). Writes the
   daily log, the new `current_user_context` (TODAY / BASELINE / ROUTINE /
   ROLLING LOG / ACTIVE WATCHLIST), `call_records`, and a `decision_cards`
   row; increments `number_of_calls`. Unconnected calls are logged without
   touching the profile.

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
| `OPENAI_KEY` | Listed, but only the Edge Function uses OpenAI (set it as a Supabase function secret) |

**Agent version** is set from the dashboard: sidebar → **Settings** → enter
the version → Save. It is stored in Supabase `app_settings`
(`key = sarvam_app_version`). Outbound calls use: saved setting →
`SARVAM_APP_VERSION` env → 12.

Scripts: `npm run dev`, `npm run build`, `npm start`, `npm run lint`.
Node 18–22.

---

## 7. Known issues / risks

1. **Secret in Edge Function source** — `sarvam-call-handler` contains a
   hard-coded OpenAI key as a fallback. Rotate that key and read it only from
   a Supabase function secret.
2. **Edge Function is unauthenticated** (`verify_jwt: false`, no shared
   secret). Anyone with the URL can read a parent's health history, and if no
   `user_id` is sent it falls back to the **most recently updated parent**.
   It can also write call records. Add a shared-secret header checked by the
   function and configured in the Sarvam tool.
3. **Double increment** of `number_of_calls` (webhook + Edge Function), see §1.
4. **Hard-coded date cutoff** `2026-09-25` in `/api/calls` and `lib/sarvam.ts`.
5. **Heuristic decision cards** in `/api/calls/sync`, `/api/health/analyze`
   and the webhook are keyword-based and separate from the AI cards stored in
   `decision_cards`; the dashboard does not yet read `decision_cards`.
6. **Fallback defaults** in the Edge Function (e.g. "HTN on Amlodipine",
   "6:30 AM garden walk") can leak into a real parent's context if the AI
   call fails.
7. Large amount of unused legacy UI code (§2).
