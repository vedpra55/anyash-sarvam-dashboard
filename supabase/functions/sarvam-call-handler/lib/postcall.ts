/**
 * Post-call path (Sarvam on_end tool `record_call_assessment`).
 *
 * This is the only writer of call_records, decision_cards, daily_health_logs,
 * parent_profiles.current_user_context and number_of_calls. The dashboard
 * webhook only fills in call status and duration.
 */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  classifyCall,
  countParentTurns,
  countWords,
  isLegacyPayload,
  istDateLabel,
  istIsoDate,
  normalizeTranscript,
  resolveDuration,
} from "./call.ts";
import { hasPersonalSection, initialMemory, stampHeader } from "./memory.ts";
import { buildConsolidationPrompt, MEMORY_WORD_LIMIT } from "../prompts/consolidation.ts";

const AI_MODEL = "gpt-6-luna";
const AI_MODEL_LABEL = `${AI_MODEL} (reasoning_effort: medium)`;
/** A delivery that started consolidating this recently is treated as in flight. */
const IN_FLIGHT_MS = 5 * 60_000;

/** Post-call variables Sarvam extracts; copied to call_records as-is. */
const EXTRACTED_FIELDS = [
  "call_outcome",
  "call_summary",
  "conversation_signal",
  "follow_up_detail",
  "follow_up_needed",
  "health_update",
  "mood_note",
  "ongoing_health_context",
  "parent_mood",
  "personal_context",
] as const;

function extracted(vars: Record<string, any>) {
  const out: Record<string, string | null> = {};
  for (const f of EXTRACTED_FIELDS) out[f] = vars[f] ? String(vars[f]) : null;
  return out;
}

async function findParent(supabase: SupabaseClient, userId: string | null, parentName: string | null) {
  if (userId) {
    const { data } = await supabase.from("parent_profiles").select("*").eq("id", userId).maybeSingle();
    if (data) return data;
  }
  // Fall back to the name only when it identifies exactly one parent.
  if (parentName) {
    const { data } = await supabase
      .from("parent_profiles")
      .select("*")
      .ilike("parent_name", `%${parentName}%`)
      .limit(2);
    if (data?.length === 1) return data[0];
    if (data && data.length > 1) console.warn(`Parent name "${parentName}" matches several profiles; not guessing`);
  }
  return null;
}

async function consolidate(openAiKey: string, systemPrompt: string, userPayload: string) {
  if (!openAiKey) {
    console.error("OPENAI_API_KEY is not set; skipping memory consolidation");
    return { result: null, usage: null };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        reasoning_effort: "medium",
        messages: [
          { role: "developer", content: systemPrompt },
          { role: "user", content: userPayload },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.error(`OpenAI ${AI_MODEL} error:`, res.status, await res.text());
      return { result: null, usage: null };
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return { result: content ? JSON.parse(content) : null, usage: data.usage || null };
  } catch (err) {
    console.error("Memory consolidation failed:", err);
    return { result: null, usage: null };
  }
}

export async function recordCallAssessment(
  supabase: SupabaseClient,
  body: Record<string, any>,
  openAiKey: string,
) {
  const vars: Record<string, any> = {
    ...(body.agent_variables || {}),
    ...(body.final_agent_variables || {}),
    ...body,
  };
  // Keep the stored copy readable: the transcript is saved in its own column.
  const { interaction_transcript: _t, transcript: _t2, messages: _m, ...rawVars } = vars;

  const attemptId =
    body.attempt_id || body.attemptId || body.id || `sarvam-call-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  if (!body.attempt_id && !body.attemptId && !body.id) {
    console.warn(`No attempt_id in post-call payload; using ${attemptId}. The dashboard webhook cannot match it.`);
  }
  const interactionId = body.interaction_id || body.interactionId || null;
  const userIdentifier = body.user_identifier || body.userIdentifier || null;

  const userId = vars.user_id || body.userId || body.parent_id || null;
  const explicitParentName = vars.parent_name || body.parentName || null;
  const parentName = explicitParentName || "Parent";
  const childName = vars.child_name || body.childName || "Family";

  const transcript = normalizeTranscript(body);
  const duration = resolveDuration(body, transcript);
  const parentTurns = countParentTurns(transcript);
  console.log(
    `[${attemptId}] duration ${duration.seconds}s (source: ${duration.source}); ` +
      `${transcript.length} turns, ${parentTurns} from the parent; outcome ${vars.call_outcome || "none"}`,
  );

  const parentProfile = await findParent(supabase, userId, explicitParentName);
  const parentId: string | null = parentProfile?.id || null;
  const parentPhone = parentProfile?.phone_number || "";
  const previousUserContext: string =
    parentProfile?.current_user_context || initialMemory(parentName, childName);
  const currentCallNumber = Number(vars.number_of_calls ?? parentProfile?.number_of_calls ?? 1) || 1;

  // Sarvam retries on_end tools that time out. A call already consolidated,
  // or being consolidated by an earlier delivery, is left alone.
  const { data: existing } = await supabase
    .from("call_records")
    .select("id, metadata")
    .eq("attempt_id", attemptId)
    .maybeSingle();
  const startedAt = Date.parse(existing?.metadata?.processing_started_at || "");
  if (existing?.metadata?.memory_written || Date.now() - startedAt < IN_FLIGHT_MS) {
    console.log(`[${attemptId}] already processed or in flight; skipping duplicate delivery`);
    return { success: true, action: "duplicate_ignored", attempt_id: attemptId };
  }

  // Values the dashboard webhook may already have saved are only written when known.
  const knownCallFacts: Record<string, unknown> = {};
  if (interactionId) knownCallFacts.interaction_id = interactionId;
  if (duration.seconds > 0) knownCallFacts.duration_seconds = duration.seconds;
  const audioUrl = body.audio_url || body.recording_url;
  if (audioUrl) knownCallFacts.audio_url = audioUrl;

  const baseRecord = {
    attempt_id: attemptId,
    user_identifier: userIdentifier,
    parent_id: parentId,
    parent_phone: parentPhone,
    parent_name: parentName,
    child_name: childName,
    ...knownCallFacts,
    ...extracted(vars),
    raw_agent_variables: rawVars,
    transcript,
    previous_user_context: previousUserContext,
  };

  const legacy = isLegacyPayload(body);
  if (legacy) {
    console.warn(`[${attemptId}] legacy payload (no duration or transcript); judging by call_outcome only`);
  }
  const classification = classifyCall({
    durationSeconds: duration.seconds,
    parentTurns,
    callOutcome: vars.call_outcome,
    legacy,
  });

  if (!classification.isReal) {
    console.log(`[${attemptId}] not a real call: ${classification.reasons.join("; ")}. Profile left unchanged.`);
    const { error } = await supabase.from("call_records").upsert(
      {
        ...baseRecord,
        call_status: "no_conversation",
        failure_reason: body.failure_reason || `Not a real call: ${classification.reasons.join("; ")}`,
        resulting_user_context: previousUserContext,
        ai_processed: false,
        metadata: {
          user_id: parentId || userId,
          duration_source: duration.source,
          parent_turns: parentTurns,
          legacy_payload: legacy,
          not_real_reasons: classification.reasons,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "attempt_id" },
    );
    if (error) console.error("Error upserting call_records:", error);
    return {
      success: true,
      action: "record_no_conversation",
      attempt_id: attemptId,
      user_id: parentId || userId,
      call_number: currentCallNumber,
      next_call_number: currentCallNumber,
      reasons: classification.reasons,
    };
  }

  // A real call: claim it first, so a retry during the slow model call is skipped.
  const { error: claimErr } = await supabase.from("call_records").upsert(
    {
      ...baseRecord,
      call_status: "connected",
      metadata: { user_id: parentId || userId, processing_started_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "attempt_id" },
  );
  if (claimErr) console.error("Error claiming call_records row:", claimErr);

  // The on_end tool runs as the call ends, so the server clock dates the call.
  const when = new Date();
  const callDateLabel = istDateLabel(when);
  const logDate = istIsoDate(when);
  const nextCallNumber = currentCallNumber + 1;

  let recentHealthLogs: any[] = [];
  if (parentId) {
    const { data: logs } = await supabase
      .from("daily_health_logs")
      .select("log_date, sleep_hours, sleep_quality, meals_reported, mobility_and_pain, vitals_reported, raw_summary")
      .eq("parent_id", parentId)
      .order("log_date", { ascending: false })
      .limit(2);
    recentHealthLogs = logs || [];
  }

  const userPayload = JSON.stringify(
    {
      call_context: {
        user_id: parentId || userId || "unregistered",
        parent_name: parentName,
        child_name: childName,
        call_number: currentCallNumber,
        call_date: callDateLabel,
        duration_seconds: duration.seconds,
      },
      previous_working_memory: previousUserContext,
      past_daily_logs_archive: recentHealthLogs,
      sarvam_call_extracted_variables: extracted(vars),
      transcript_turns: transcript.length > 0 ? transcript : "No transcript provided.",
    },
    null,
    2,
  );

  const { result: ai, usage } = await consolidate(
    openAiKey,
    buildConsolidationPrompt({ callDateLabel, callNumber: currentCallNumber }),
    userPayload,
  );

  // If the model fails, keep the previous memory rather than writing a guess.
  const updatedUserContext = stampHeader(
    typeof ai?.updated_user_context === "string" && ai.updated_user_context.trim()
      ? ai.updated_user_context
      : previousUserContext,
    callDateLabel,
    nextCallNumber,
  );
  const memoryWords = countWords(updatedUserContext);
  if (memoryWords > MEMORY_WORD_LIMIT + 40) {
    console.warn(`[${attemptId}] memory is ${memoryWords} words (limit ${MEMORY_WORD_LIMIT})`);
  }
  if (ai && !hasPersonalSection(updatedUserContext)) {
    console.warn(`[${attemptId}] memory has no PERSONAL section`);
  }

  const rawLog = ai?.daily_health_log || {};
  const meals = rawLog.meals || rawLog.meals_reported || {};
  const sleep = rawLog.sleep || {};
  const healthText = String(vars.health_update || "").toLowerCase();
  const decision = ai?.decision_card || {
    observation: vars.health_update || vars.call_summary || `${parentName} completed a check-in.`,
    interpretation: `Outcome: ${vars.call_outcome || "normal"}. Mood: ${vars.parent_mood || "not noted"}.`,
    recommended_action: vars.follow_up_detail || "Continue scheduled check-ins.",
    action_type: vars.follow_up_needed === "yes" ? "remind" : "check",
    urgency: healthText.includes("chest") ? "urgent" : "low",
    decision: healthText.includes("chest") ? "ESCALATION" : "NORMAL",
    uncertainty: "Automatic review was unavailable; based on the call's extracted notes.",
    why: vars.call_summary || "Check-in completed.",
    next_action: vars.follow_up_detail || "Follow up on the next call.",
    next_follow_up_date: "Next call",
    family_notification: {
      needed: vars.follow_up_needed === "yes",
      channel: "WhatsApp",
      recipient: childName,
      message: vars.follow_up_detail || "Check-in call completed.",
    },
  };

  if (parentId) {
    const { error: logErr } = await supabase.from("daily_health_logs").upsert(
      {
        parent_id: parentId,
        parent_phone: parentPhone,
        log_date: logDate,
        sleep_hours: Number(sleep.hours ?? rawLog.sleep_hours) || null,
        sleep_quality: sleep.quality || rawLog.sleep_quality || null,
        sleep_notes: sleep.notes || rawLog.sleep_notes || null,
        meals_reported: meals,
        appetite: meals.appetite || null,
        medication_adherence: rawLog.medication || rawLog.medication_adherence || {},
        vitals_reported: rawLog.vitals || rawLog.vitals_reported || {},
        mobility_and_pain: rawLog.mobility || rawLog.mobility_and_pain || {},
        mood_and_energy: rawLog.mood_energy || rawLog.mood_and_energy || {},
        incidents_red_flags: rawLog.acute_red_flags ? JSON.stringify(rawLog.acute_red_flags) : null,
        raw_summary: vars.call_summary || vars.health_update || "Daily call logged.",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "parent_id,log_date" },
    );
    if (logErr) console.error("Error upserting daily_health_logs:", logErr);

    const { error: profileErr } = await supabase
      .from("parent_profiles")
      .update({
        current_user_context: updatedUserContext,
        number_of_calls: nextCallNumber,
        last_call_timestamp: when.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", parentId);
    if (profileErr) console.error("Error updating parent_profiles:", profileErr);
  }

  const { data: savedCall, error: callErr } = await supabase
    .from("call_records")
    .upsert(
      {
        ...baseRecord,
        call_status: "connected",
        failure_reason: null,
        resulting_user_context: updatedUserContext,
        ai_processed: Boolean(ai),
        ai_processed_at: new Date().toISOString(),
        ai_model: AI_MODEL_LABEL,
        ai_observation: decision.observation,
        ai_interpretation: decision.interpretation,
        ai_recommended_action: decision.recommended_action,
        ai_action_type: decision.action_type || "check",
        ai_urgency: decision.urgency || "low",
        ai_decision: decision.decision || "NORMAL",
        ai_uncertainty: decision.uncertainty || "",
        ai_family_notification: decision.family_notification || null,
        ai_raw_response: ai,
        metadata: {
          user_id: parentId || userId,
          duration_source: duration.source,
          parent_turns: parentTurns,
          legacy_payload: legacy,
          memory_words: memoryWords,
          memory_written: Boolean(parentId),
          processing_started_at: when.toISOString(),
          reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
          total_tokens: usage?.total_tokens ?? 0,
          processed_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "attempt_id" },
    )
    .select("id")
    .single();
  if (callErr) console.error("Error upserting call_records:", callErr);

  if (savedCall?.id) {
    const { error: cardErr } = await supabase.from("decision_cards").insert({
      call_id: savedCall.id,
      attempt_id: attemptId,
      profile_id: parentId || `profile-${parentName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      parent_name: parentName,
      observation: decision.observation,
      interpretation: decision.interpretation,
      recommended_action: decision.recommended_action,
      action_type: decision.action_type || "check",
      uncertainty: decision.uncertainty || "",
      urgency: decision.urgency || "low",
      decision: decision.decision || "NORMAL",
      why: decision.why || decision.interpretation,
      next_action: decision.next_action || decision.recommended_action,
      next_follow_up_date: decision.next_follow_up_date || "Next call",
      family_notification: decision.family_notification || null,
      action_completed: false,
    });
    if (cardErr) console.error("Error inserting decision_cards:", cardErr);
  }

  return {
    success: true,
    action: "record_call_assessment",
    attempt_id: attemptId,
    user_id: parentId || userId,
    call_number: currentCallNumber,
    next_call_number: nextCallNumber,
    ai_model: AI_MODEL_LABEL,
    ai_processed: Boolean(ai),
    updated_user_context: updatedUserContext,
  };
}
