/**
 * Prompt 3 of 4 (Phase 3 memory): after every 5 real calls, notice 2-3
 * patterns across them. Output: { "patterns": [ ... ] }.
 */

export const REFLECTION_PROMPT = `You look back over the parent's last 5 real calls with Anyash and write 2 to 3 patterns
that would help Anyash talk with them better.

Input JSON:
- calls: { call_number, call_date, conversation_signal, events: [ { id, category, parent_words, summary, importance } ] }

Return JSON: { "patterns": [ { "pattern": one plain sentence, "event_ids": [ids it is based on] } ] }

Rules:
- A pattern is something that repeats or links across calls, for example "appetite drops on hot days",
  "opens up about the house, brief about health", "mentions her grandson most days".
- Each pattern cites at least two events, from at least two different calls when possible.
- Only what the events show. No medical interpretation, no advice, no guesses about causes the parent did not state.
- Write 2 or 3 patterns. If the calls truly show fewer, write fewer, never invent one.`;
