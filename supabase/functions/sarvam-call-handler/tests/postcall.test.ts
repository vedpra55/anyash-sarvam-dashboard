/**
 * recordCallAssessment against an in-memory Supabase stand-in: which tables a
 * failed call and a real call write to.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { recordCallAssessment } from "../lib/postcall.ts";
import { istDateLabel, istIsoDate } from "../lib/call.ts";

type Row = Record<string, any>;

/** Just enough of the supabase-js query builder for postcall.ts. */
function fakeSupabase(tables: Record<string, Row[]>) {
  const writes: { table: string; op: string; values: Row }[] = [];

  function query(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let op: "select" | "update" | "upsert" | "insert" = "select";
    let values: Row = {};
    const rows = () => (tables[table] ||= []);
    const matching = () => rows().filter((r) => filters.every((f) => f(r)));

    const run = () => {
      if (op === "update") {
        for (const r of matching()) Object.assign(r, values);
        writes.push({ table, op, values });
        return { data: null, error: null };
      }
      if (op === "upsert") {
        const existing = rows().find((r) => r.attempt_id && r.attempt_id === values.attempt_id);
        if (existing) Object.assign(existing, values);
        else rows().push({ id: crypto.randomUUID(), ...values });
        writes.push({ table, op, values });
        return { data: rows().find((r) => r.attempt_id === values.attempt_id) || values, error: null };
      }
      if (op === "insert") {
        rows().push({ id: crypto.randomUUID(), ...values });
        writes.push({ table, op, values });
        return { data: values, error: null };
      }
      return { data: matching(), error: null };
    };

    const builder: any = {
      select: () => builder,
      eq: (col: string, val: unknown) => (filters.push((r) => r[col] === val), builder),
      ilike: (col: string, pattern: string) => {
        const needle = pattern.replace(/%/g, "").toLowerCase();
        filters.push((r) => String(r[col] || "").toLowerCase().includes(needle));
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      update: (v: Row) => ((op = "update"), (values = v), builder),
      upsert: (v: Row) => ((op = "upsert"), (values = v), builder),
      insert: (v: Row) => ((op = "insert"), (values = v), Promise.resolve(run())),
      maybeSingle: () => {
        const res = run();
        return Promise.resolve({ data: Array.isArray(res.data) ? res.data[0] ?? null : res.data, error: null });
      },
      single: () => Promise.resolve(run()),
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
        Promise.resolve(run()).then(resolve, reject),
    };
    return builder;
  }

  return { client: { from: query } as any, writes, tables };
}

const PARENT_ID = "00000000-0000-0000-0000-000000000001";
const OLD_MEMORY =
  "TODAY: Mon, Sep 28, 2026 | CALL COUNT: 4\nBASELINE: Salilesh | Child: Jaya\nACTIVE WATCHLIST:\n- sleep aid";

function world() {
  return fakeSupabase({
    parent_profiles: [
      { id: PARENT_ID, parent_name: "Salilesh", phone_number: "+910000000000", number_of_calls: 4, current_user_context: OLD_MEMORY },
    ],
    call_records: [],
    daily_health_logs: [],
    decision_cards: [],
  });
}

const transcript = (userTurns: number) =>
  Array.from({ length: userTurns * 2 }, (_, i) => ({ role: i % 2 ? "user" : "agent", en_text: `line ${i}` }));

Deno.test("failed call: record saved as no_conversation, profile and logs untouched", async () => {
  const w = world();
  const res: any = await recordCallAssessment(
    w.client,
    {
      action: "record_call_assessment",
      attempt_id: "att-failed",
      user_id: PARENT_ID,
      call_outcome: "no_conversation",
      call_duration_seconds: 10,
      interaction_transcript: transcript(0),
    },
    "", // no OpenAI key: a failed call must not need it
  );

  assertEquals(res.action, "record_no_conversation");
  assertEquals(res.next_call_number, 4);
  const profile = w.tables.parent_profiles[0];
  assertEquals(profile.number_of_calls, 4);
  assertEquals(profile.current_user_context, OLD_MEMORY);
  assertEquals(w.tables.daily_health_logs.length, 0);
  assertEquals(w.tables.decision_cards.length, 0);
  const rec = w.tables.call_records[0];
  assertEquals(rec.call_status, "no_conversation");
  assertEquals(rec.duration_seconds, 10);
  assertEquals(rec.metadata.duration_source, "call_duration_seconds");
  assert(!w.writes.some((x) => x.table === "parent_profiles"));
});

Deno.test("real call without AI: count goes up, memory kept but re-stamped, one decision card", async () => {
  const w = world();
  const res: any = await recordCallAssessment(
    w.client,
    {
      action: "record_call_assessment",
      attempt_id: "att-real",
      interaction_id: "20260930/abc",
      user_id: PARENT_ID,
      number_of_calls: "4",
      call_outcome: "meaningful_checkin",
      call_summary: "Talked about sleep and the heat.",
      personal_context: "Lives with daughter-in-law.",
      call_duration_seconds: "132",
      interaction_transcript: transcript(6),
    },
    "",
  );

  assertEquals(res.next_call_number, 5);
  const profile = w.tables.parent_profiles[0];
  assertEquals(profile.number_of_calls, 5);
  assertEquals(
    profile.current_user_context,
    `LAST UPDATED: ${istDateLabel(new Date())} | CALL COUNT: 5\nBASELINE: Salilesh | Child: Jaya\nACTIVE WATCHLIST:\n- sleep aid`,
  );
  assertEquals(w.tables.daily_health_logs.length, 1);
  assertEquals(w.tables.daily_health_logs[0].log_date, istIsoDate(new Date()));
  assertEquals(w.tables.decision_cards.length, 1);
  assertEquals(w.tables.decision_cards[0].profile_id, PARENT_ID);
  const rec = w.tables.call_records[0];
  assertEquals(rec.call_status, "connected");
  assertEquals(rec.duration_seconds, 132);
  assertEquals(rec.interaction_id, "20260930/abc");
  assertEquals(rec.personal_context, "Lives with daughter-in-law.");
  assertEquals(rec.transcript.length, 12);
  assertEquals(rec.raw_agent_variables.interaction_transcript, undefined);
});

Deno.test("a repeated delivery of the same call does not count it twice", async () => {
  const w = world();
  const body = {
    attempt_id: "att-dup",
    user_id: PARENT_ID,
    number_of_calls: "4",
    call_outcome: "meaningful_checkin",
    call_duration_seconds: 120,
    interaction_transcript: transcript(5),
  };
  await recordCallAssessment(w.client, body, "");
  const second: any = await recordCallAssessment(w.client, body, "");
  assertEquals(second.action, "duplicate_ignored");
  assertEquals(w.tables.parent_profiles[0].number_of_calls, 5);
  assertEquals(w.tables.decision_cards.length, 1);
});

Deno.test("a row the dashboard webhook created first is completed, not duplicated", async () => {
  const w = world();
  w.tables.call_records.push({ id: "r1", attempt_id: "att-hook", call_status: "connected", duration_seconds: 0, metadata: { source: "webhook" } });
  await recordCallAssessment(
    w.client,
    { attempt_id: "att-hook", user_id: PARENT_ID, call_outcome: "meaningful_checkin", call_duration_seconds: 80, interaction_transcript: transcript(4) },
    "",
  );
  assertEquals(w.tables.call_records.length, 1);
  assertEquals(w.tables.call_records[0].duration_seconds, 80);
  assertEquals(w.tables.parent_profiles[0].number_of_calls, 5);
});
