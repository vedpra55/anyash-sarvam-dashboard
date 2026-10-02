# Voice-faithful simulation: research and plan

*Research and plan only. Nothing here is built yet.*

## 1. Summary

Our evals currently test a **text chat**: clean, polite text goes in, and
every agent turn is heard in full. A real Anyash call is a **phone call**:
1. a parent speaks;
2. Sarvam's speech recognition writes down what it thinks it heard;
3. the LLM answers that text;
4. the answer is read aloud;
5. the parent can cut in at any moment.

Real calls show the gap: Devanagari text, misheard words, short broken
answers, agent turns cut off mid-word, and calls ending on a time limit.
Published research finds that voice agents keep only 30 to 45% of what they
can do in text (τ-Voice). A text simulation is therefore too optimistic.

The plan is to keep simulating in text, because it is cheap, fast and
repeatable, but to put a **voice channel** between the simulated parent and
the agent. The channel reproduces what the phone does to the conversation:
- speech recognition errors;
- the parent cutting in;
- pauses that split an answer in two;
- silence and nudges;
- real timing.

We then **calibrate** the simulator against real calls until its numbers
match them.

## 2. How a Sarvam voice call works

```
parent speaks
  → silence detector decides the parent has finished (about 600 ms of silence)
  → speech recognition (Sarvam Saarika): Hindi in Devanagari, English words often transliterated
  → LLM: prompt + variables + the conversation so far, as recognised text
         tools: end_interaction, query_parent_history
  → text-to-speech: the reply is read aloud, sentence by sentence
  → the parent hears it

At any time:
  the parent talks over the agent → speech stops; the agent's turn is saved cut off,
                                    ending with "<interruption>"
  nobody speaks for a while       → nudge (agent checks in); repeated silence ends the call
  time limit reached              → the call is cut, even mid-sentence
  agent calls end_interaction     → its end_message is spoken and the call ends
```

The LLM never hears audio. It only ever sees **recognised text**, and that
text is not what the parent actually said.

Settings, from the docs and the v30 commit: silence 600 ms, nudge after 8 s,
temperature 0.5, max call 240 s. Two settings still need checking on Sarvam:
- the max call length (see 3.6);
- which LLM the agent runs on.

The Sarvam connection needs to be re-authorised before I can read these.

## 3. What real Anyash calls look like

Source: the six real calls in `call_records` that have a conversation (call 2,
before v31). Names are left out here.

| | Agent | Parent |
|---|---|---|
| Turns | 62 | 56 |
| Words per turn, median | **25** | **6** |
| Longest turn | 61 words | 27 words |
| Turns with two questions | **21 of 62** | – |
| Turns cut off by the parent | **3 of 62** | – |

### 3.1 Everything is in Devanagari
- The agent writes Hindi in Devanagari and English words in Latin script:
  "आपकी रोज़ की routine कैसी रहती है?"
- The parent's recognised text is all Devanagari, including English words:
  "मल्टीविटामिन", "वेरी गुड", "मेडिसिन भी लेते हैं और खास डाइट भी फॉलो करते हैं".

Our simulation is entirely Roman Hinglish, so the agent is tested on input it
never receives.

### 3.2 Parents speak in fragments
Real answers look like these:
- "हाँ हाँ कर सकते हैं।"
- "कौन?"
- "नौ बज जाता है, नौ साढ़े आठ, नौ।"
- "नहीं, घुटना में ही।"

The median parent answer is 6 words. "कौन?" ("who?") right after the
greeting is common.

### 3.3 The agent gets cut off
These are stored exactly like this:
- "और रात को नींद कै <interruption>"
- "क्या आपको शरीर में कहीं कोई दर्द या <interruption>"

The parent answers the half-question they heard. The cut-off text is what
the LLM sees on the next turn. All three cuts happened on long turns that had
a second question coming.

### 3.4 Speech recognition mishears
- "कोई सवाल नहीं लेते हैं" was most likely "कोई दवाई नहीं लेते" ("no
  medicines"). The agent replied as if it had heard that correctly.
- "बहुत अच्छा असर है" was given as the answer to a sleep question.
- "चालते तो नहीं हैं" is a garbled word.

These are probable mishearings, judged from the context of the call.

### 3.5 The agent talks four times more than the parent
- Agent turns are long and often stack two questions.
- They repeat facts back ("पाँच बजे, काफी जल्दी उठती हैं आप").
- They use filler ("मैं यह जानना चाह रही थी", "मतलब").

The prompt has since been changed to stop this. The simulation must still
show it whenever a prompt does it.

### 3.6 Calls end on the clock
- Two of six calls lasted exactly 180 s and stop on an agent question.
- The docs say the limit is 240 s.
- The real limit needs checking on Sarvam.

### 3.7 Gender switches mid-call
The opening says "बोल रहा हूँ" (male) and the next turn says "चाहती थी"
(female). A voice listener hears this at once. Our checks do not look for it.

## 4. Gap: real call vs our simulation today

| Real call | Our simulation now | Effect on results |
|---|---|---|
| Parent text is recognised speech in Devanagari, with errors | Clean Roman Hinglish written by an LLM | Too easy; misheard words are never tested |
| Parent can cut the agent off; the cut text stays in the history | Every agent turn is heard in full | Long, two-question turns are never punished |
| Parent hears the turn once, out loud, and often answers only the last question | Parent reads the whole turn | Stacked questions look fine |
| A 600 ms pause can split one answer into two turns | One clean answer per turn | Agent never replies to a half answer |
| Silence leads to a nudge, then the call ends | Silence is an empty string, rarely used | Silent and slow parents aren't tested |
| Time is spoken audio plus response delay plus pauses | Words divided by a guessed rate | Cut-off timing is wrong |
| Limit: 180 or 240 s (to check) | 240 s estimate | May close too late in reality |
| Sarvam's LLM, temperature 0.5 | gpt-6-luna, reasoning off, default temperature | Different model, different habits |
| Opening from Sarvam v31 | Our own default opening line | Small difference |
| `query_parent_history` works | Not connected | Memory follow-up untested |
| Parent: 6 words per answer, says "कौन?", "हाँ", "क्या?" | LLM parent, too polite and complete | Too cooperative |

## 5. What others do (research)

- **τ-Voice (Sierra, 2026).** This is the closest match to what we need.
  - The user simulator waits for a silence threshold before it replies.
  - An LLM decides from time to time whether to interrupt, based on the
    conversation.
  - Accents, noise and turn-taking are configurable.
  - The simulation runs on its own clock rather than real time, so the
    simulated user can use a strong model.
  - Finding: the best text agent solves 85%; voice agents solve 31 to 51% on
    clean audio and 26 to 38% with realistic noise.
- **LiveKit Agents.** Behaviour is tested in text mode because it is cheap
  and repeatable. Audio runs are kept for turn-taking and speech problems. A
  simulated user plays a scenario, and a judge checks the scenario's
  expectations.
- **LangWatch Scenario** (open source). A `UserSimulatorAgent` plays the
  caller and a `JudgeAgent` grades the call. Scripted steps can be mixed with
  free simulation. Its voice mode adds interruptions and audio effects.
- **Pipecat** (open source).
  - When the user interrupts, the bot's text is cut to the words actually
    spoken, using the timing of each spoken word, so the LLM's history matches
    what the user heard.
  - Idle detection starts a timer when the bot stops talking and nudges the
    user when it runs out.
- **Industry testing guides (Cekura, Hamming).**
  - Build the test suite from real calls, especially the ones that went wrong.
  - 30 to 40% of reported "model bugs" in voice agents are speech-recognition
    errors that the LLM faithfully followed.
  - Silence-based end-of-turn detection, typically 700 to 1000 ms, cuts slow
    speakers off mid-thought.

Common lesson: **a text simulation is the right base layer, but it must add
the voice effects deliberately, and be checked against real calls.**

## 6. The design: a voice channel in the middle

```
Simulated parent ──says──▶ VOICE CHANNEL ──recognised text──▶ Agent (exactly as on Sarvam)
       ▲                        │                                    │
       └────hears───────────────┴──────── spoken reply, cut short ◀──┘
```

### 6.1 The agent runs exactly as on Sarvam
- The prompt under test, with the same variables, rendered the same way.
- The opening line from Sarvam v31.
- Temperature 0.5.
- The same model as Sarvam if we can call it. Sarvam's models expose an
  OpenAI-compatible API, so this would be the biggest single gain in
  realism. Otherwise we keep OpenAI and treat the result as a proxy.
- History in Sarvam's format:
  - parent turns are recognised Devanagari text;
  - cut-off agent turns are truncated and end with `<interruption>`;
  - roles are `agent` and `user`.
- Tools: `end_interaction` (done) and `query_parent_history`, answered from
  the scenario's dummy history.

### 6.2 The simulated parent decides *what* they say and *how*
The persona card gains measurable traits:
- speaking pace (slow speakers pause mid-answer);
- answer length (default median 6 words, taken from real calls);
- hearing (asks "क्या?" or "कौन?");
- patience (how quickly they cut in on a long turn);
- language mix;
- whether they answer only the last question when two are asked.

Each turn the parent returns:
- `say`: the words as spoken;
- `cut_in_after`: the word count of the agent's turn after which they start
  talking, or none;
- `pause_split`: where they pause long enough for the system to think they
  have finished;
- `silent`;
- `hangup`.

### 6.3 The voice channel applies the phone's effects
1. **Barge-in.** If the parent cuts in after N words, the agent's turn is
   kept up to N words and ends with `<interruption>`, matching Sarvam's
   format. That shortened text is what the parent heard and what the agent
   sees in its history.
2. **Hearing the turn.** The parent is given only what was spoken before the
   cut. When a persona has bad recall, the parent is told it mostly
   remembers the end of a long turn.
3. **Speech recognition.** The parent's words become Devanagari recognised
   text:
   - English words are transliterated;
   - numbers are written as words or digits, the way Saarika outputs them;
   - errors are added at a set rate: similar-sounding swaps
     ("दवाई"→"सवाल"), dropped words, fillers.

   The scenario stores the error rate, and a seed makes runs repeatable.
   Default: 1 to 2 errors per call. A "noisy line" scenario raises it.
4. **Endpointing.** For slow speakers, an answer with a `pause_split` reaches
   the agent as two turns. The agent replies to the first half, and the
   second half can arrive while the agent is still talking, which is also a
   cut-in.
5. **Silence.** A silent turn becomes Sarvam's nudge after 8 s. Repeated
   silence ends the call.
6. **Clock.** Each turn adds:
   - agent speech time (words ÷ Hindi TTS rate);
   - parent speech time;
   - about 1 s of response delay;
   - 0.6 s of end-of-turn silence.

   The rates are calibrated from the real calls (duration vs words). The
   call is cut at the real limit, even mid-sentence, as on Sarvam.

### 6.4 Fixed where it matters, free where it helps
Each scenario can set exact parent lines for key moments, for example
"कौन?" first, or the chest-pain line on the second turn. The simulator
fills the rest in character. This is the LangWatch "script plus simulation"
pattern.

### 6.5 What the graders add
- Two questions in one turn, counted on what the parent actually heard.
- Recovery after a cut-off: does the agent re-ask briefly or move on?
- Handling a misheard answer: does the agent check, or build on nonsense?
- Gender consistency (रहा/रही, चाहता/चाहती).
- Talk share and turn length measured in spoken seconds, not just words.

## 7. Calibration against real calls (the fidelity check)

A simulator is only as good as its match to reality.

1. **Replay.** Take each real call's parent lines in order and play them to
   the live prompt through the channel. The real call serves as the answer
   key.
2. **Compare the statistics** of simulated calls and real calls:
   - words per turn (agent and parent);
   - questions per turn;
   - cut-off rate;
   - length of the call;
   - how often the parent says "कौन?" or "क्या?";
   - error rate.
3. **Tune** the parent traits and channel rates until the simulation is
   within about 20% of the real numbers.
4. **Re-check monthly** as more real calls come in. Every bad real call
   becomes a permanent scenario.

## 8. Order of work

1. **Ground truth.** Script the extraction of real-call statistics and
   anonymised examples. Read the exact settings from Sarvam (call limit,
   model, nudge, interruption). This needs the Sarvam connection
   re-authorised.
2. **Agent fidelity.**
   - Devanagari history, `<interruption>` format, Sarvam's opening line,
     temperature 0.5, the real call limit.
   - Connect `query_parent_history` to scenario data.
   - Try Sarvam's own LLM as the agent model.
3. **Voice channel:** barge-in, speech recognition errors, endpoint splits,
   silence and nudges, and the clock. Each is a small, unit-tested function,
   with seeds so runs repeat.
4. **Parent simulator v2:** the persona traits and per-turn output from 6.2.
   Scripted key lines are mixed in.
5. **Transcript view:**
   - show what the parent said next to what the agent heard;
   - mark cut-offs;
   - show timing per turn.
6. **Fidelity check** against the six real calls (section 7), before trusting
   any result.
7. **New graders** (6.5).
8. **Then** compare the new prompt with live on the scenario set.

Steps 2, 3 and 6 matter most. Without them, a better score in our evals
doesn't mean a better phone call.

## 9. What this still cannot do

- It is still text. Accents, background noise, a poor phone line and the TTS
  voice itself are only approximated through the error rate.
- The final check therefore stays on Sarvam:
  - Sarvam's own eval suite on the draft;
  - a few real test calls before a prompt goes live.

## Sources

- [τ-Voice: Benchmarking Full-Duplex Voice Agents on Real-World Domains](https://arxiv.org/abs/2603.13686) and [Sierra's summary](https://sierra.ai/blog/tau-voice-benchmarking-real-time-voice-agents-on-real-world-tasks)
- [LiveKit Agents: Testing and evaluation](https://docs.livekit.io/agents/start/testing/) and [Agent simulations](https://docs.livekit.io/agents/start/testing/simulations/)
- [LangWatch Scenario (GitHub)](https://github.com/langwatch/scenario) and [Testing voice agents with Scenario](https://langwatch.ai/blog/testing-voice-agents-with-langwatch-scenario-in-real-time)
- [Pipecat: Text to Speech (word timestamps and interruptions)](https://docs.pipecat.ai/pipecat/learn/text-to-speech) and [Detecting idle users](https://docs.pipecat.ai/pipecat/fundamentals/detecting-user-idle)
- [Pipecat issue: context not updated on user interruptions](https://github.com/pipecat-ai/pipecat/issues/2791)
- [Hamming: interruption handling, barge-in and turn detection](https://hamming.ai/resources/voice-agent-interruption-handling-runbook) and [Intent recognition for voice agents](https://hamming.ai/resources/intent-recognition-voice-agents-at-scale)
- [Cekura: voice agent testing best practices](https://www.cekura.ai/blogs/voice-agent-testing)
- [NVIDIA NeMo voice agent: turn taking and backchannels](https://docs.nvidia.com/nemo/labs-voice-agent/about/core-concepts/speech-pipeline/turn-taking-backchannels/)
- [Sarvam: Saarika speech recognition](https://docs.sarvam.ai/api-reference-docs/models/saarika), [Sarvam 30B](https://docs.sarvam.ai/api-reference-docs/models/sarvam-30b), [LiveKit in production with Sarvam](https://docs.sarvam.ai/api/integration/livekit-production-best-practices)
