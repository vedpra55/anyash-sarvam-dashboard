import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getSarvamAttempts, attemptIdOf } from "@/lib/sarvam";
import {
  TRIAL_START_ISO,
  TRIAL_START_MS,
  TEST_REASON_LABEL,
  TestReason,
  attemptTime,
  last10,
  testReason,
} from "@/lib/trial";
import type { GoalStatus, Ledger, LedgerCall, LedgerLog } from "@/lib/insights";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const FILLER = /(not reported|not specified|unspecified|no .{0,40}(information|update|details?)( was)? (reported|shared|provided)|^n\/?a$|^null$|^none$)/i;

function meaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text.length > 2 && !FILLER.test(text);
}

function goalOf(item: any): GoalStatus {
  const s = item?.evaluation?.overall_status;
  if (s === "passed" || s === "failed" || s === "not_evaluated") return s;
  // Older data without Sarvam evaluations: fall back to the call outcome.
  if (item?.connectivity_status !== "connected") return "not_evaluated";
  return item?.agent_variables?.call_outcome === "meaningful_checkin" ? "passed" : "failed";
}

function positive(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* Finished calls' transcripts never change, so keep them for the life of the server. */
const transcriptCache = new Map<string, { lastAgentLine: string | null; parentSpoke: boolean }>();

async function earlyEndDetails(interactionId: string) {
  if (transcriptCache.has(interactionId)) return transcriptCache.get(interactionId)!;
  const { SARVAM_API_KEY: key = "", SARVAM_ORG_ID: org = "", SARVAM_WORKSPACE_ID: ws = "", SARVAM_APP_ID: app = "" } =
    process.env;
  if (!key || !org || !ws || !app) return null;
  try {
    const res = await fetch(
      `https://apps.sarvam.ai/api/analytics/v1/${org}/${ws}/${app}/transcripts/${encodeURIComponent(interactionId)}`,
      { headers: { "X-API-Key": key.trim(), "API-Subscription-Key": key.trim() }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const messages: any[] = Array.isArray(data.messages) ? data.messages : [];
    const text = (m: any) => String(m.content || m.text || "").replace(/\s*<interruption>\s*/gi, "…").trim();
    const agentLines = messages.filter((m) => m.role === "assistant" || m.role === "agent").map(text).filter(Boolean);
    const parentSpoke = messages.some((m) => m.role === "user" && text(m));
    const details = { lastAgentLine: agentLines[agentLines.length - 1] || null, parentSpoke };
    transcriptCache.set(interactionId, details);
    return details;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Ledger                                                              */
/* ------------------------------------------------------------------ */

const LEDGER_TTL_MS = 60_000;
let ledgerCache: { at: number; promise: Promise<Ledger | { error: string; status: number }> } | null = null;

async function buildLedger(): Promise<Ledger | { error: string; status: number }> {
  const supabase = getServiceSupabase();
  const trialDay = "2026-09-25";

  const [attempts, parentsRes, recordsRes, logsRes, cardsRes] = await Promise.all([
    getSarvamAttempts(),
    supabase.from("parent_profiles").select("id, parent_name, phone_number"),
    supabase
      .from("call_records")
      .select("attempt_id, parent_id, created_at, ai_decision, health_update")
      .gte("created_at", TRIAL_START_ISO),
    supabase
      .from("daily_health_logs")
      .select("parent_id, log_date, sleep_hours, sleep_notes, meals_reported, medication_adherence, vitals_reported, mobility_and_pain, mood_and_energy")
      .gte("log_date", trialDay),
    supabase
      .from("decision_cards")
      .select("decision, urgency, action_completed, created_at")
      .gte("created_at", TRIAL_START_ISO),
  ]);

  if (!attempts.ok) return { error: attempts.error, status: attempts.status };
  if (parentsRes.error) return { error: parentsRes.error.message, status: 500 };

  const parents = parentsRes.data || [];
  const parentByNumber = new Map(parents.map((p: any) => [last10(p.phone_number), p]));
  const parentNumbers = new Set(parentByNumber.keys());

  // Split real calls from tests, counting each exclusion reason.
  const excludedCounts = new Map<TestReason, number>();
  const real: any[] = [];
  for (const item of attempts.items) {
    const reason = testReason(item, parentNumbers);
    if (reason) excludedCounts.set(reason, (excludedCounts.get(reason) || 0) + 1);
    else real.push(item);
  }

  // Supabase reviews: by Sarvam attempt id, or by parent + time for the ones
  // the review function logged without an attempt id.
  const records = recordsRes.data || [];
  const recordById = new Map(records.map((r: any) => [r.attempt_id, r]));
  const unlinked = records.filter((r: any) => String(r.attempt_id || "").startsWith("sarvam-call-"));

  const calls: LedgerCall[] = [];
  for (const item of real) {
    const id = attemptIdOf(item);
    const time = attemptTime(item);
    const parent = parentByNumber.get(last10(item.user_contact || item.user_contact_masked)) as any;
    const vars = item.agent_variables || {};
    const connected = item.connectivity_status === "connected";
    const durationSec = Number(item.duration_in_seconds) || 0;

    let record: any = recordById.get(id);
    if (!record && parent) {
      const endMs = time + durationSec * 1000;
      record = unlinked.find((r: any) => {
        const t = Date.parse(r.created_at);
        return r.parent_id === parent.id && t >= time && t - endMs < 45 * 60_000;
      });
    }

    calls.push({
      id,
      time,
      parentId: parent?.id || null,
      parentName: parent?.parent_name || vars.parent_name || "Parent",
      status: item.connectivity_status || "unknown",
      connected,
      durationSec,
      messages: Number(item.num_messages) || 0,
      endReason: item.end_reason && item.end_reason !== "NO_END_REASON" ? item.end_reason : null,
      agentLatency: positive(item.average_agent_response_time_in_seconds),
      parentLatency: positive(item.average_user_response_time_in_seconds),
      goal: goalOf(item),
      criteria: Array.isArray(item.evaluation?.criteria)
        ? item.evaluation.criteria.map((c: any) => ({ name: String(c.name || "Criterion"), status: c.status as GoalStatus }))
        : [],
      outcome: vars.call_outcome || null,
      mood: vars.parent_mood || null,
      openness: vars.conversation_signal || null,
      followUp: vars.follow_up_needed === "yes",
      healthCaptured: meaningful(vars.health_update || record?.health_update) &&
        !/^no (specific )?health/i.test(String(vars.health_update || record?.health_update || "")),
      callNumber: Number(vars.number_of_calls) || null,
      decision: record?.ai_decision || null,
    });
  }

  // For calls that ended early, read the transcript: what did Anya say last?
  const early = calls
    .filter((c) => c.connected && c.durationSec < 30)
    .sort((a, b) => b.time - a.time)
    .slice(0, 25);
  const interactionById = new Map(real.map((item: any) => [attemptIdOf(item), item.interaction_id]));
  await Promise.all(
    early.map(async (c) => {
      const interactionId = interactionById.get(c.id);
      if (!interactionId || interactionId === "NO_INTERACTION_ID") return;
      const details = await earlyEndDetails(interactionId);
      if (details) {
        c.lastAgentLine = details.lastAgentLine;
        c.parentSpoke = details.parentSpoke;
      }
    })
  );

  const logs: LedgerLog[] = (logsRes.data || [])
    .filter((l: any) => l.parent_id)
    .map((l: any) => {
      const meals = l.meals_reported || {};
      const meds = l.medication_adherence || {};
      const vitals = l.vitals_reported || {};
      const pain = l.mobility_and_pain || {};
      const mood = l.mood_and_energy || {};
      return {
        parentId: l.parent_id,
        date: l.log_date,
        sleep: Boolean(l.sleep_hours) || meaningful(l.sleep_notes),
        meals: ["breakfast", "lunch", "dinner", "notes"].some((k) => meaningful(meals[k])),
        medicines: meaningful(meds.adherence) || Object.keys(meds).some((k) => k !== "refill_warnings" && k !== "adherence" && meaningful(meds[k])),
        pain: typeof pain.pain_reported === "boolean" || meaningful(pain.nature),
        mood: meaningful(mood.mood) || meaningful(mood.energy_level),
        vitals: ["blood_pressure", "blood_sugar", "bp", "sugar"].some((k) => meaningful(vitals[k])),
      };
    });

  const followUps = (cardsRes.data || []).map((c: any) => ({
    decision: c.decision || null,
    urgency: c.urgency || null,
    completed: Boolean(c.action_completed),
    createdAt: Date.parse(c.created_at),
  }));

  const byReason = Array.from(excludedCounts.entries())
    .map(([reason, count]) => ({ reason, label: TEST_REASON_LABEL[reason], count }))
    .sort((a, b) => b.count - a.count);

  return {
    trialStart: TRIAL_START_ISO,
    generatedAt: new Date().toISOString(),
    calls: calls.sort((a, b) => a.time - b.time),
    parents: parents.map((p: any) => ({ id: p.id, name: p.parent_name })),
    logs,
    followUps: followUps.filter((f) => f.createdAt >= TRIAL_START_MS),
    excluded: { total: byReason.reduce((n, r) => n + r.count, 0), byReason },
  };
}

export async function GET() {
  try {
    if (!ledgerCache || Date.now() - ledgerCache.at > LEDGER_TTL_MS) {
      const promise = buildLedger().then((result) => {
        if ("error" in result && ledgerCache?.promise === promise) ledgerCache = null;
        return result;
      });
      ledgerCache = { at: Date.now(), promise };
    }
    const result = await ledgerCache.promise;
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err: any) {
    ledgerCache = null;
    console.error("Insights error:", err);
    return NextResponse.json({ error: err.message || "Failed to build insights" }, { status: 500 });
  }
}
