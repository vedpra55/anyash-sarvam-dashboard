import { assertEquals } from "jsr:@std/assert@1";
import {
  callTime,
  classifyCall,
  countParentTurns,
  isLegacyPayload,
  istDateLabel,
  istIsoDate,
  normalizeTranscript,
  resolveDuration,
} from "../lib/call.ts";
import { hasPersonalSection, stampHeader } from "../lib/memory.ts";
import { buildConsolidationPrompt } from "../prompts/consolidation.ts";

const turns = (roles: string) =>
  roles.split("").map((r, i) => ({ role: r === "u" ? "user" : "agent", en_text: `turn ${i}` }));

// ---- real call vs failed call ----------------------------------------------

Deno.test("a 10-second call with one parent turn is not a real call", () => {
  // The call that became "call #4": 11 s, one agent line, no parent reply.
  const c = classifyCall({ durationSeconds: 11, parentTurns: 0, callOutcome: "no_conversation" });
  assertEquals(c.isReal, false);
  assertEquals(c.reasons.length, 3);
});

Deno.test("a 2.5-minute call with 10 parent turns is real", () => {
  assertEquals(classifyCall({ durationSeconds: 150, parentTurns: 10, callOutcome: "meaningful_checkin" }).isReal, true);
});

Deno.test("each condition alone fails the call", () => {
  assertEquals(classifyCall({ durationSeconds: 44, parentTurns: 10, callOutcome: "meaningful_checkin" }).isReal, false);
  assertEquals(classifyCall({ durationSeconds: 45, parentTurns: 2, callOutcome: "meaningful_checkin" }).isReal, false);
  for (const outcome of ["no_conversation", "busy_or_refused", "wrong_person", "test_call"]) {
    assertEquals(classifyCall({ durationSeconds: 120, parentTurns: 8, callOutcome: outcome }).isReal, false, outcome);
  }
});

Deno.test("boundary: 45 s and 3 parent turns counts; partial_checkin counts", () => {
  assertEquals(classifyCall({ durationSeconds: 45, parentTurns: 3, callOutcome: "partial_checkin" }).isReal, true);
  assertEquals(classifyCall({ durationSeconds: 45, parentTurns: 3, callOutcome: null }).isReal, true);
});

// ---- transcript ------------------------------------------------------------

Deno.test("transcript from the on_end system variable as an array", () => {
  const t = normalizeTranscript({ interaction_transcript: turns("auaua") });
  assertEquals(t.length, 5);
  assertEquals(countParentTurns(t), 2);
});

Deno.test("transcript sent as a JSON string", () => {
  const t = normalizeTranscript({ interaction_transcript: JSON.stringify(turns("auauau")) });
  assertEquals(countParentTurns(t), 3);
});

Deno.test("transcript sent as role-prefixed text", () => {
  const t = normalizeTranscript({
    interaction_transcript: "agent: Namaste Mummy ji\nuser: haan beta\nassistant: kaise hain?\nuser: theek hoon\n  aaj garmi hai",
  });
  assertEquals(t.map((x) => x.role), ["agent", "user", "agent", "user"]);
  assertEquals(t[3].text, "theek hoon aaj garmi hai");
});

Deno.test("empty turns are dropped and assistant maps to agent", () => {
  const t = normalizeTranscript({ transcript: [{ role: "assistant", content: "hi" }, { role: "user", text: "  " }] });
  assertEquals(t, [{ role: "agent", text: "hi" }]);
});

Deno.test("no transcript at all", () => {
  assertEquals(normalizeTranscript({ call_outcome: "meaningful_checkin" }), []);
});

// ---- duration --------------------------------------------------------------

Deno.test("duration: call_duration_seconds is used first", () => {
  assertEquals(resolveDuration({ call_duration_seconds: "67.4", duration: 5 }, []), {
    seconds: 67,
    source: "call_duration_seconds",
  });
});

Deno.test("duration: each legacy field is read", () => {
  for (const field of ["duration_in_seconds", "duration", "call_duration", "interaction_duration"]) {
    assertEquals(resolveDuration({ [field]: 90 }, []), { seconds: 90, source: field });
  }
});

Deno.test("duration: zero and empty values are skipped", () => {
  assertEquals(resolveDuration({ duration_in_seconds: 0, duration: "", call_duration: 120 }, []).source, "call_duration");
});

Deno.test("duration: from interaction start/end times (UTC without zone)", () => {
  const d = resolveDuration(
    { interaction_start_time: "2026-09-30 16:10:00", interaction_end_time: "2026-09-30 16:12:30" },
    [],
  );
  assertEquals(d, { seconds: 150, source: "interaction_start_time..interaction_end_time" });
});

Deno.test("duration: from transcript timestamps", () => {
  const t = normalizeTranscript({
    interaction_transcript: [
      { role: "agent", en_text: "a", timestamp: "2026-09-30T16:10:00Z" },
      { role: "user", en_text: "b", timestamp: "2026-09-30T16:11:05Z" },
    ],
  });
  assertEquals(resolveDuration({}, t), { seconds: 65, source: "transcript_timestamps" });
});

Deno.test("duration: nothing available", () => {
  assertEquals(resolveDuration({}, []), { seconds: 0, source: "none" });
});

// ---- dates -----------------------------------------------------------------

Deno.test("IST date: 11:59 PM IST stays on the same India day", () => {
  const d = new Date("2026-09-30T18:29:00Z"); // 23:59 IST
  assertEquals(istIsoDate(d), "2026-09-30");
  assertEquals(istDateLabel(d), "Wed, 30 Sep 2026");
});

Deno.test("IST date: 00:30 IST is the next India day", () => {
  const d = new Date("2026-09-30T19:00:00Z"); // 00:30 IST on 1 Oct
  assertEquals(istIsoDate(d), "2026-10-01");
});

Deno.test("call time comes from interaction_start_time when present", () => {
  const now = new Date("2026-10-02T00:00:00Z");
  assertEquals(callTime({ interaction_start_time: "2026-09-30 16:10:00" }, now).toISOString(), "2026-09-30T16:10:00.000Z");
  assertEquals(callTime({}, now), now);
});

// ---- memory ----------------------------------------------------------------

Deno.test("stampHeader replaces an old TODAY line with LAST UPDATED", () => {
  const old = "TODAY: Mon, Sep 28, 2026 | CALL COUNT: 4\nBASELINE: Poonam | Child: Ved\nACTIVE WATCHLIST:\n- knee";
  assertEquals(
    stampHeader(old, "Wed, 30 Sep 2026", 5),
    "LAST UPDATED: Wed, 30 Sep 2026 | CALL COUNT: 5\nBASELINE: Poonam | Child: Ved\nACTIVE WATCHLIST:\n- knee",
  );
});

Deno.test("stampHeader moves a misplaced header to the top and prepends when missing", () => {
  assertEquals(
    stampHeader("BASELINE: X\nLAST UPDATED: old | CALL COUNT: 2", "Wed, 30 Sep 2026", 3),
    "LAST UPDATED: Wed, 30 Sep 2026 | CALL COUNT: 3\nBASELINE: X",
  );
  assertEquals(stampHeader("BASELINE: X", "D", 2), "LAST UPDATED: D | CALL COUNT: 2\nBASELINE: X");
});

Deno.test("PERSONAL section detection", () => {
  assertEquals(hasPersonalSection("BASELINE: X\nPERSONAL: lives with son"), true);
  assertEquals(hasPersonalSection("BASELINE: X"), false);
});

Deno.test("consolidation prompt asks for LAST UPDATED, PERSONAL, LIFE THREADS and 260 words", () => {
  const p = buildConsolidationPrompt({ callDateLabel: "Wed, 30 Sep 2026", callNumber: 4 });
  for (const needle of [
    "LAST UPDATED: Wed, 30 Sep 2026 | CALL COUNT: 5",
    "PERSONAL:",
    "at most 60 words",
    "LIFE THREADS:",
    "at most 260 words",
    "personal_context",
    "(Call #4)",
  ]) {
    assertEquals(p.includes(needle), true, needle);
  }
  assertEquals(/^\s*TODAY:/m.test(p), false);
});

// ---- legacy payloads (agent v29 and earlier) --------------------------------

Deno.test("v29 payload (variables only) is legacy and judged by call_outcome", () => {
  const v29 = { action: "record_call_assessment", user_id: "u", call_outcome: "meaningful_checkin", call_summary: "..." };
  assertEquals(isLegacyPayload(v29), true);
  assertEquals(classifyCall({ durationSeconds: 0, parentTurns: 0, callOutcome: "meaningful_checkin", legacy: true }).isReal, true);
  assertEquals(classifyCall({ durationSeconds: 0, parentTurns: 0, callOutcome: "no_conversation", legacy: true }).isReal, false);
  assertEquals(classifyCall({ durationSeconds: 0, parentTurns: 0, callOutcome: "", legacy: true }).isReal, false);
});

Deno.test("a payload with the new system variables is never legacy, even if empty", () => {
  assertEquals(isLegacyPayload({ call_duration_seconds: "", interaction_transcript: "" }), false);
  assertEquals(isLegacyPayload({ interaction_transcript: [] }), false);
});
