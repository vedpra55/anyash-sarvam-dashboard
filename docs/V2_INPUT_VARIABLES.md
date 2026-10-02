# Input variables for the new prompt (v2)

Prompt file: `prompts/anyash_v2.txt`. This page lists every variable the prompt reads and every variable the agent needs around it: what each one is, where its value comes from, and how v2 uses it.

## 1. Variables written into the prompt text

| Variable | What it is | Example | Filled by | Where v2 uses it |
|---|---|---|---|---|
| `{{parent_name}}` | The parent's name | `Sunita` | Dashboard → Sarvam `agent_variables.parent_name` (from `parent_profiles`) | Who she calls for ("set up by … for {{parent_name}}"); **Wrong person**: checks whether {{parent_name}} is available, never discusses health with anyone else; **Gatekeeper**: says she is calling for {{parent_name}}'s scheduled check-in. 5 places. |
| `{{child_name}}` | The son or daughter who set Anyash up | `Priya` | Dashboard → `agent_variables.child_name` (default `Family` if empty) | Who set her up (intro, and "who is calling?"); **Call 1** explanation; **Principle 7**: now and then asks whether they spoke to {{child_name}} recently; **Privacy**: nothing is shared with {{child_name}} without permission. 5 places. |
| `{{honorific}}` | How she addresses the parent | `Mummy Ji`, `Papa Ji`, `Amma` | Dashboard → `agent_variables.honorific` (default `Ji`) | "She addresses the parent as {{honorific}}". The opening line uses it too: "नमस्ते {{honorific}}, मैं अन्याश बोल रहा हूँ…" (Sarvam v31). 1 place in the prompt. |
| `{{number_of_calls}}` | Which call this is, starting at 1 | `1`, `2`, `7` | Dashboard → `agent_variables.number_of_calls`, as a string (`parent_profiles.number_of_calls`) | **Decides the call and overrides everything else**: `1` = introduce and build trust, no health questions; `2` = learn their normal day and mention yesterday's introduction; `3+` = keep in touch and notice change. Also: from the 2nd call she says "we spoke yesterday" when asked who is calling. |
| `{{user_context}}` | The pre-call notes for today's call | see section 3 | Dashboard → `agent_variables.user_context` and `app_overrides.user_context` | Placed under "What each call is for". **Today's topics come only from these notes.** She never recites them or reveals she has them. Anything marked "(family says)" is unconfirmed and gets checked gently. If the notes and the parent disagree, the parent is right. Principle 3: asks only from these notes or the parent's own words. Principle 6: opens with the most important open thread in them. |
| `{{sarvam_variables.current_datetime}}` | Today's date and time | `2026-10-02 18:30 IST` | **Sarvam fills it itself** (system variable); the dashboard does not send it | "Today is {{sarvam_variables.current_datetime}}" so she can speak about today, yesterday and days ago correctly. |

## 2. Variables the agent needs that are not in the prompt text

These are defined on the Sarvam agent (`agent_variables_in_context` in version 31). v2 does not write them into its text, but the agent still needs them.

| Variable | What it is | Filled by | Used by |
|---|---|---|---|
| `user_id` | The parent's id in Supabase (`parent_profiles.id`) | Dashboard → `agent_variables.user_id` and `app_overrides.user_id` | The tool **`query_parent_history`** sends it, so the right parent's history is fetched. Also used by the post-call tool `record_call_assessment`. The prompt names the tool in "Tool data priority". |
| `supabase_anon_key` | Key for the post-call webhook | Set on Sarvam | **`record_call_assessment`** (runs when the call ends) sends it as the Authorization header. Not used during the conversation. |
| `gender` | The agent's voice gender | Set on Sarvam (switched to male in v28) | Voice and TTS. **Note:** v2 is written as "she" (रही, चाहती). The live agent is male (रहा, सकता), and the opening line says "बोल रहा हूँ". Make the prompt and this setting agree before v2 goes live. |
| `today_date` | Today's date as an agent variable | Defined on Sarvam; the dashboard does not send it | **Not used by v2**, which reads `{{sarvam_variables.current_datetime}}` instead. It can stay empty. |

The dashboard also sends `initial_language_name` (default Hindi; Hinglish is sent as Hindi) in `app_overrides`. It sets the language the call starts in. It is not a prompt variable.

## 3. `user_context`: the variable v2 depends on most

v2 is written to read the **pre-call brief** built by `build-brief` (Phase 3). The brief is 120 to 150 words of plain English notes to Anyash, in this order:

1. who the parent is, in two lines;
2. how they like to talk;
3. the threads to follow up, each with the parent's own words in quotes;
4. one or two health areas not talked about this week;
5. things to avoid.

Example (made up):

```
Sunita lives alone and likes her morning walk in the garden (family says). She wakes at five and sleeps around ten thirty.
She talks more when she is asked about her day than about her health; follow her lead.
Open with the knee: last time she said "ghutne mein dard" and it is due to be asked about again.
Sleep and food have not come up this week; one of them is enough today.
Things to avoid: the anniversary of her husband's passing.
```

**What actually gets sent today** is set by `app_settings.memory_brief_mode`:

| Mode | What goes into `user_context` | Fit for v2 |
|---|---|---|
| `live` | The brief (the old context if the brief fails) | Yes. This is what v2 is written for. |
| `shadow` (**current setting**) | The **old context** (`TODAY / BASELINE / ROUTINE / ROLLING LOG / ACTIVE WATCHLIST`); the brief is built after the call is placed and only stored | No. v2's "(family says)", "open with the thread" and "topics come only from these notes" rules expect the brief. |
| `off` | The old context | No |

So **when v2 goes live, `memory_brief_mode` must be switched to `live`**. A manual `user_context_override` from the dashboard always wins.

## 4. Values by call number

| `number_of_calls` | `user_context` should contain | v2 does |
|---|---|---|
| `1` | Who the parent is and who set it up ("(family says)" facts) | Introduces herself, says {{child_name}} set her up, that calls begin tomorrow, and that what they share is private. No health questions. |
| `2` | The family's starting facts, marked "(family says)" | Mentions yesterday's call in a sentence; learns their normal day; checks the family's facts gently. |
| `3+` | The brief: threads with the parent's words, areas not covered this week, things to avoid | Opens with the most important thread; one or two areas only; notices change. |

## 5. Full example of what the dashboard sends (call 3)

```json
"agent_variables": {
  "parent_name": "Sunita",
  "honorific": "Mummy Ji",
  "child_name": "Priya",
  "number_of_calls": "3",
  "user_id": "<parent_profiles.id>",
  "user_context": "<the pre-call brief, section 3>"
},
"app_overrides": {
  "initial_language_name": "Hindi",
  "user_id": "<parent_profiles.id>",
  "user_context": "<the same brief>"
}
```

Set on Sarvam, not sent per call: `supabase_anon_key`, `gender`, `today_date`. Filled by Sarvam at call time: `sarvam_variables.current_datetime`.

## 6. The same variables in the evals

Each scenario on the Evals page fills the same variables (`supabase/functions/eval-agent/lib/transcript.ts`, `renderVars`):

| Variable | Scenario field | Default if empty |
|---|---|---|
| `parent_name` | Parent name | `Sunita` |
| `child_name` | Child name | `Priya` |
| `honorific` | Honorific | `Mummy Ji` |
| `number_of_calls` | Call number | `1` |
| `user_context` | User context (write it as a brief for v2) | empty |
| `sarvam_variables.current_datetime` | — | the current India time |

`user_id`, `supabase_anon_key`, `gender` and `today_date` are not used in the evals. `query_parent_history` is not connected there: the agent is told the record could not be loaded.
