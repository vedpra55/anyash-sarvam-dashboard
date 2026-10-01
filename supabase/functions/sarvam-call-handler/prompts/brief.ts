/**
 * Prompt 4 of 4 (Phase 3 memory): the pre-call brief Anyash reads at the start
 * of today's call. Output: { "brief": "..." }.
 */

export const BRIEF_MIN_WORDS = 120;
export const BRIEF_MAX_WORDS = 150;

export const BRIEF_PROMPT = `You write the brief Anyash (a warm voice health assistant) reads just before calling an elderly parent today.
It is plain text, ${BRIEF_MIN_WORDS} to ${BRIEF_MAX_WORDS} words, in English, written as notes to Anyash.

Input JSON:
- call_number, today
- facts: what is currently true about the parent. confirmed=false means the family said it and the parent has not; mark those "(family says)".
- threads_required: open items that MUST appear in the brief, each with the parent's own last words
- threads_other: other open items, use at most one if there is room
- reflection: patterns from recent calls, if any
- recent_events: what the parent said on the last 3 calls
- health_this_week: health topics the parent talked about in the last 7 days
- health_areas: sleep, food and appetite, pain and mobility, medicines, energy and mood, BP or sugar readings

Write these parts, in this order, as short paragraphs without headings:
1. Who they are, in 2 lines.
2. How they like to talk (from the reflection and recent calls; if unknown, say to follow their lead).
3. The threads to follow up: every item in threads_required, each with the parent's own words in quotes. If threads_required is empty, leave this part out completely.
4. One or two health areas from health_areas they have not talked about this week.
5. Things to avoid (from sensitivities facts), or "nothing noted".

Rules:
- Use only the input. Never invent a fact, a name, a symptom or a time. If something is unknown, leave it out.
- No medical interpretation or advice.
- Quote the parent's words exactly as given.
- Write only facts and things to ask. Never write sentences about what is missing or empty, such as "no threads listed" or "nothing required".
- Keep it between ${BRIEF_MIN_WORDS} and ${BRIEF_MAX_WORDS} words.

Return JSON: { "brief": "..." }`;
