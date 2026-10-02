# Evals plan: build them the way voice platforms do

*Research and plan. Nothing here is built yet. This replaces the earlier
"phone effects" plan.*

## 1. How the platforms build their evals

Sarvam, Retell, ElevenLabs, Vapi and LiveKit all use the same design. The
τ-bench research benchmark does too.

| | Sarvam | Retell | ElevenLabs | Vapi | LiveKit |
|---|---|---|---|---|---|
| Agent under test | **The real agent**: any version, including the uncommitted draft | The real agent | The real agent | The real assistant | The real agent session |
| Agent inputs | Suite variables mapped to agent variables, per version | Dynamic variables | Agent config | Assistant config | Session |
| Tools | Real | **Mocked** functions | **Mocked** tools | Real | Real or mocked |
| Simulated user | `user_scenario`: a brief the simulator improvises within | User prompt with **Identity / Goal / Personality** sections, and its own LLM | `simulated_user_config`: prompt, LLM, temperature, first message, language | **Personality** (a full tester assistant: model, voice, prompt) **×** Scenario | Scenario |
| Start mid-call | – | – | `partial_conversation_history` | – | Yes |
| Grading | **Expected behaviours** per test (yes/no) plus **global guardrails** on every test, with a judge reason for each | Success criteria, all in one pass, with explanations | Evaluation criteria; success and failure examples | Structured outputs with expected values | Judges on expectations |
| Repeats | `frequency` 1 to 20: **2/3 = flaky, 0/3 = broken** | Batch | Split runs | Iterations | – |
| Other test types | – | – | **Next-reply tests** and **tool-call tests** | Evals: mock conversations with a judge per turn | Turn-by-turn asserts |
| Text or voice | Text simulation | Text simulation | Text simulation | Chat first, then voice | Text first, then audio |

### The rules they agree on

1. **Test the real agent, not a copy.** The platform runs the actual agent:
   same LLM, same harness, same tools, same variables. Sarvam can run the
   uncommitted draft, which is how you test an edit before freezing it.
2. **The simulated user is its own agent with its own prompt.** The prompt
   describes the person and their goal, not exact words. The simulator
   improvises inside it.
   - Retell splits it into Identity, Goal and Personality.
   - Vapi keeps a reusable Personality separate from the Scenario.
3. **The simulator's rules (τ-bench):**
   - say one line at a time;
   - **never give away everything at once**, only what the current step
     needs;
   - never invent facts that aren't in the brief ("say you don't remember");
   - don't repeat the brief word for word;
   - stop when the goal is reached.
4. **One intent per scenario.** A test that does three things tells you
   nothing when it fails.
5. **Expected behaviours are observable yes/no checks on the transcript.**
   Rules that must always hold go in **global guardrails**, graded on every
   conversation.
6. **Run each test several times.** A single pass only shows the agent *can*
   succeed. Read the pass count: 0/3 is broken, 2/3 is flaky.
7. **Test the pieces too.** ElevenLabs also checks a single next reply from a
   given conversation history, with good and bad examples. That is cheap,
   stable, and can start from **real call history**.
8. **Text first for speed; confirm on the real system before shipping.**

## 2. Where our evals break these rules

| Rule | Ours today |
|---|---|
| 1. Real agent | **Broken.** We rebuild the agent on OpenAI (`gpt-6-luna`, reasoning off). It isn't Sarvam's model, harness or settings, so the conversation doesn't look like a real Anyash call. |
| 2. Simulated user as its own agent | Partly. One generic prompt, and scenario facts written as a list the parent recites. |
| 3. Don't give everything away | **Broken.** The parent dumps the whole persona in one answer: the Call 2 parent gave her entire day in turn 1, then the call ended after 3 exchanges. |
| 4. One intent | Mostly fine. |
| 5. Behaviours and guardrails | Close. We have checks and criteria, but no suite-level guardrails graded separately. |
| 6. Repeats | **Missing.** Each scenario runs once. |
| 7. Next-reply tests | **Missing.** |
| 8. Confirm on the real system | **Missing.** The new prompt has never run on Sarvam. |

## 3. The plan

### 3.1 Run the new prompt on Sarvam's own eval engine (the source of truth)

This copies Sarvam's evals by using them directly. It is the only way to
test the **real agent**: Sarvam's LLM, harness, `end_interaction`,
`query_parent_history` and variable handling. Sarvam's own simulated user
and judge run the conversation.

1. **Prompts.** "Run on Sarvam" puts the chosen prompt into the agent's
   **draft** (version 32, uncommitted) and runs the suite against that draft.
   - Calls are pinned to version 31 (`app_settings.sarvam_app_version`), so
     real parents never get the draft.
   - Live (v31) is run the same way, so every result is a fair comparison:
     **new prompt vs live, on the same engine**.
2. **Suite.** Sarvam's suite "Anyash Health - Daily Check-in" already exists:
   12 cases, 4 global guardrails and suite variables. We add the cases the
   new prompt is meant to improve:
   - hard day;
   - chatty parent;
   - quiet parent;
   - the brief is wrong;
   - tips.

   Each is written in Sarvam's format (see 3.3).
3. **Variables.** Map the suite's variables to the agent's for version 32,
   as Sarvam requires per version. The suite's `user_context` should be a
   **pre-call brief**, because that is what the new prompt reads.
4. **Runs.** `frequency` 3, read as passed out of 3 per case. The dashboard
   shows each run, its transcripts, the verdict per behaviour, and the
   Guardrails entry.
5. **Cost.** Sarvam credits per conversation: cases × frequency. For
   example, 17 cases × 3 runs × 2 prompts = 102 conversations per
   comparison.

### 3.2 Keep our own engine for fast iteration (chat-first, like Vapi and LiveKit)

Cheap runs while editing a prompt, rebuilt on the same design:

1. **Same scenario format as Sarvam** (3.3). One definition feeds both
   engines, and a scenario can be pushed to Sarvam's suite unchanged.
2. **Simulated parent = Personality × Scenario** (the Vapi and Retell split).
   - **Personality** is reusable:
     - Identity: name, age, town, family;
     - how she speaks, based on real calls: Devanagari, "हम" for herself,
       about 6 words a turn, says "कौन?" and "हाँ";
     - temperament.
   - **Scenario** is one intent: her situation today and her goal, plus
     optional fixed first line or key lines (ElevenLabs `first_message`).
   - Simulator rules from τ-bench: one line at a time, never everything at
     once, no invented facts, stop when the goal is reached.
3. **Agent kept as close to Sarvam's as we can:**
   - the same prompt and variables;
   - the end-call tool, copied word for word from Sarvam's (done);
   - `query_parent_history` mocked from the scenario's data (Retell and
     ElevenLabs mocks);
   - Sarvam's opening line;
   - temperature 0.5;
   - Sarvam's LLM through its OpenAI-compatible API, if we can get access.
     Otherwise this engine is a proxy, and the result that counts comes from
     3.1.
4. **Grading in Sarvam's form:**
   - expected behaviours per test;
   - global guardrails as a separate verdict;
   - a reason for every pass or fail;
   - a test passes only if every behaviour passes;
   - frequency 3.
5. **Next-reply tests** (ElevenLabs). Take **real call history** up to a
   moment, for example the parent says her knee hurts or "कौन?", and check
   only the agent's next reply against good and bad examples. Real input,
   one cheap LLM call, the same result every run.

### 3.3 The scenario format (shared by both engines)

```
suite:      name, variables (defaults), global_guardrails[]
personality: id, identity, speech (from real calls), temperament      ← ours, folded into user_scenario on export
test case:  name, category (mode), personality_id,
            user_scenario  (situation + goal, one intent; facts revealed only when asked),
            first_message? / partial_conversation_history?,
            expected_behaviors[{name, description}]  (observable yes/no),
            variable_overrides[] (call number, brief), max_turns
run:        prompt (or Sarvam version), engine (sarvam | ours), frequency
result:     per execution: transcript, verdict + reason per behaviour, guardrails verdict
```

## 4. Order of work

1. **Read Sarvam's past eval runs.** The suite has been run before. Look at
   how realistic Sarvam's simulated parent is and how its judge writes
   reasons. This decides how much we rely on 3.1 and what our simulator in
   3.2 must match. It needs the Sarvam connection re-authorised.
2. **"Run on Sarvam" (3.1).** Load the prompt into the draft, map the
   variables, run with frequency 3, fetch and show results, and compare
   with live.
3. **Shared scenario format (3.3).** Move the 12 Sarvam cases and our extra
   cases into it, with two-way sync to Sarvam's suite.
4. **Our engine (3.2)** with Personality × Scenario, the τ-bench rules, mocked
   tools, guardrails and frequency.
5. **Next-reply tests** from real call history.
6. **Check our engine against Sarvam's.** Run the same cases on both. If our
   engine agrees with Sarvam on pass/fail most of the time, it can be used
   for quick iteration. If not, Sarvam's result wins.

## 5. Decisions needed

1. **Sarvam credits.** A full comparison is about 100 simulated
   conversations. Is that acceptable per prompt change?
2. **Draft use.** Is it fine to load test prompts into the Sarvam draft
   (v32)? It never reaches parents while calls are pinned to v31.
3. **Reconnect Sarvam** in the claude.ai connector settings, so step 1 can
   start.

## Sources

- Sarvam: [Tests best practices](https://docs.sarvam.ai/api-reference/tests/best-practices), [Get test case results](https://docs.sarvam.ai/conversations/api/tests/runs/results), [Harness](https://docs.sarvam.ai/conversations/build/concepts/harness)
- Retell: [Simulation testing](https://docs.retellai.com/test/llm-simulation-testing), [Batch testing](https://docs.retellai.com/test/batch-test-simulation)
- ElevenLabs: [Agent testing](https://elevenlabs.io/docs/eleven-agents/customization/agent-testing), [Simulate conversations](https://elevenlabs.io/docs/eleven-agents/guides/simulate-conversation)
- Vapi: [Simulations advanced](https://docs.vapi.ai/observability/simulations-advanced), [Simulations best practices](https://docs.vapi.ai/test/simulations-best-practices#choose-chat-or-voice-deliberately), [Test suites](https://docs.vapi.ai/test/test-suites)
- LiveKit: [Testing and evaluation](https://docs.livekit.io/agents/start/testing/), [Agent simulations](https://docs.livekit.io/agents/start/testing/simulations/)
- τ-bench: [paper](https://arxiv.org/pdf/2406.12045); [Non-collaborative user simulators](https://arxiv.org/html/2509.23124v5)
- Coval / Hamming persona systems: [Speechmatics overview](https://www.speechmatics.com/company/articles-and-news/de-risk-your-voice-agent-11-best-voice-agent-testing-platforms)
