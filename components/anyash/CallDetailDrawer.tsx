"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, Play, Pause, ChevronRight } from "lucide-react";
import { SarvamCallRecord } from "@/lib/sarvam";
import { parseMemory, diffMemory } from "@/lib/memory";
import {
  Section,
  Field,
  Callout,
  StatusLabel,
  MemoryDiffView,
  MemoryDocument,
  clean,
  humanize,
  formatDuration,
  formatDateTime,
  decisionMeta,
  callStatusMeta,
} from "./detail-ui";

interface CallDetailDrawerProps {
  call: SarvamCallRecord | null;
  onClose: () => void;
}

interface TranscriptTurn {
  turn_id: string;
  role: "agent" | "user";
  text: string;
}

interface CallDetails {
  record: any | null;
  decisionCard: any | null;
  dailyLog: any | null;
}

type Tab = "summary" | "conversation" | "memory";

const BOILERPLATE = /^(recorded in longitudinal memory\.?|check-in completed\.?|no)$/i;

function formatAudioTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

export function AudioPlayer({ interactionId, fallbackDuration }: { interactionId: string; fallbackDuration: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [interactionId]);

  const ensureAudio = () => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio(`/api/calls/recording?interaction_id=${encodeURIComponent(interactionId)}`);
    audio.ontimeupdate = () => setCurrent(audio.currentTime);
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.onended = () => {
      setIsPlaying(false);
      setCurrent(0);
    };
    audio.onerror = () => {
      setIsPlaying(false);
      setFailed(true);
    };
    audioRef.current = audio;
    return audio;
  };

  const toggle = () => {
    const audio = ensureAudio();
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const total = duration || fallbackDuration || 0;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !total) return;
    const audio = ensureAudio();
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * total;
    setCurrent(ratio * total);
  };

  const progress = total ? Math.min(100, (current / total) * 100) : 0;

  if (failed) {
    return <p className="text-[13px] text-zinc-500">Recording is not available for this call.</p>;
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={toggle}
        aria-label={isPlaying ? "Pause recording" : "Play recording"}
        className="w-9 h-9 rounded-full bg-[#FEE5A5] hover:bg-[#FDE8B0] text-black flex items-center justify-center shrink-0 transition-transform active:scale-95"
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
      </button>
      <span className="text-[12px] tabular-nums text-zinc-400 w-9">{formatAudioTime(current)}</span>
      <div ref={trackRef} onClick={seek} className="group relative flex-1 h-5 flex items-center cursor-pointer">
        <div className="w-full h-[3px] rounded-full bg-white/10" />
        <div className="absolute left-0 h-[3px] rounded-full bg-[#FEE5A5]" style={{ width: `${progress}%` }} />
        <div
          className="absolute w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2"
          style={{ left: `${progress}%` }}
        />
      </div>
      <span className="text-[12px] tabular-nums text-zinc-500 w-9 text-right">{formatAudioTime(total)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

function SummaryTab({ call, details, loading }: { call: SarvamCallRecord; details: CallDetails | null; loading: boolean }) {
  const record = details?.record;
  const log = details?.dailyLog;
  const card = details?.decisionCard;

  const followUp = clean(call.follow_up_detail);
  const needsFollowUp = call.follow_up_needed === "yes" && followUp && !/no action needed/i.test(followUp);
  const decision = record?.ai_decision || card?.decision;
  const urgency = record?.ai_urgency || card?.urgency;
  const assessment = decision || urgency ? decisionMeta(decision, urgency) : null;
  const assessmentNeedsAttention = assessment && (assessment.tone === "notify" || assessment.tone === "urgent");

  const summary = clean(call.call_summary);
  const healthUpdate = clean(call.health_update);

  const observed = clean(record?.ai_observation);
  const meaning = clean(record?.ai_interpretation);
  const nextStep = clean(card?.next_action || record?.ai_recommended_action);
  const uncertainty = clean(record?.ai_uncertainty);
  const family = record?.ai_family_notification || null;
  const familyNeeded = family && (family.needed || family.notify);
  const familyMessage = clean(family?.message);

  const meals = log?.meals_reported || {};
  const mealText = ["breakfast", "lunch", "dinner"]
    .map((m) => [m, clean(meals[m])] as const)
    .filter(([, v]) => v);
  const mealsSame = mealText.length > 1 && mealText.every(([, v]) => v === mealText[0][1]);
  const sleep = [
    log?.sleep_hours ? `${log.sleep_hours} h` : "",
    clean(log?.sleep_quality) ? humanize(log.sleep_quality) : "",
  ].filter(Boolean).join(", ");
  const sleepNote = clean(log?.sleep_notes);
  const meds = clean(log?.medication_adherence?.adherence);
  const medsNote = clean(log?.medication_adherence?.refill_warnings);
  const mobility = clean(log?.mobility_and_pain?.nature);
  const painAt: string[] = log?.mobility_and_pain?.locations || [];
  const mood = clean(log?.mood_and_energy?.mood);
  const energy = clean(log?.mood_and_energy?.energy_level);
  const bp = clean(log?.vitals_reported?.blood_pressure || log?.vitals_reported?.bp);
  const sugar = clean(log?.vitals_reported?.blood_sugar || log?.vitals_reported?.sugar);
  const redFlags = clean(log?.incidents_red_flags);
  const hasLog =
    mealText.length || clean(meals.notes) || sleep || sleepNote || meds || medsNote || mobility || mood || energy || bp || sugar || redFlags;

  const connected = call.call_status === "connected" || call.call_status === "completed";

  if (!connected && !summary) {
    const reason =
      call.call_status === "busy"
        ? "The line was busy."
        : call.call_status === "no_answer" || call.call_status === "no-answer"
        ? "Nobody picked up."
        : "The call didn't connect.";
    return (
      <div>
        <p className="text-[15px] text-zinc-200 leading-7">{reason}</p>
        <p className="text-[13px] text-zinc-500 mt-1">Nothing was recorded, and Anya&apos;s memory was not changed.</p>
      </div>
    );
  }

  return (
    <div>
      {(needsFollowUp || assessmentNeedsAttention) && (
        <div className="mb-6">
          <Callout
            tone={assessment?.tone === "urgent" ? "urgent" : needsFollowUp ? "watch" : assessment!.tone}
            title={assessmentNeedsAttention ? assessment!.label : "Needs follow-up"}
          >
            {followUp || nextStep}
          </Callout>
        </div>
      )}

      <p className="text-[15px] text-zinc-100 leading-7">{summary || "Check-in completed."}</p>
      {healthUpdate && healthUpdate !== summary && (
        <p className="text-[14px] text-zinc-400 leading-7 mt-3">{healthUpdate}</p>
      )}

      {loading && !details && <p className="text-[13px] text-zinc-600 pt-8">Loading assessment…</p>}

      {record && (observed || nextStep || assessment) && (
        <Section title="Assessment" aside={record.ai_model ? <span className="text-[12px] text-zinc-600">AI review</span> : null}>
          <dl>
            {assessment && (
              <Field label="Verdict">
                <StatusLabel tone={assessment.tone}>{assessment.label}</StatusLabel>
              </Field>
            )}
            {observed && <Field label="Observed">{observed}</Field>}
            {meaning && !/^outcome:/i.test(meaning) && <Field label="What it means">{meaning}</Field>}
            {nextStep && !BOILERPLATE.test(nextStep) && <Field label="Next step">{nextStep}</Field>}
            {card?.next_follow_up_date && <Field label="Follow up">{card.next_follow_up_date}</Field>}
            {family && (
              <Field label="Family">
                {familyNeeded
                  ? `Tell ${family.recipient || "the family"}${family.channel ? ` on ${family.channel}` : ""}${familyMessage ? `: ${familyMessage}` : ""}`
                  : `No need to notify ${family.recipient || "the family"}`}
              </Field>
            )}
            {uncertainty && !BOILERPLATE.test(uncertainty) && <Field label="Unsure about">{uncertainty}</Field>}
          </dl>
        </Section>
      )}

      {hasLog ? (
        <Section title="Reported on this call">
          <dl>
            {(sleep || sleepNote) && (
              <Field label="Sleep">
                {sleep && <span className="text-zinc-100">{sleep}</span>}
                {sleep && sleepNote && <span className="text-zinc-500"> — </span>}
                {sleepNote}
              </Field>
            )}
            {mealsSame ? (
              <Field label="Meals">{mealText[0][1]}</Field>
            ) : mealText.length > 0 ? (
              <Field label="Meals">
                {mealText.map(([m, v]) => (
                  <div key={m}>
                    <span className="text-zinc-500">{humanize(m)}</span> {v}
                  </div>
                ))}
              </Field>
            ) : clean(meals.notes) ? (
              <Field label="Meals">{clean(meals.notes)}</Field>
            ) : null}
            {(meds || medsNote) && <Field label="Medicines">{[humanize(meds), medsNote].filter(Boolean).join(" — ")}</Field>}
            {(mobility || painAt.length > 0) && (
              <Field label="Pain & mobility">
                {painAt.length > 0 && <span className="text-zinc-100">{painAt.join(", ")}</span>}
                {painAt.length > 0 && mobility && <span className="text-zinc-500"> — </span>}
                {mobility}
              </Field>
            )}
            {(mood || energy) && <Field label="Mood & energy">{[mood, energy && `Energy ${energy.toLowerCase()}`].filter(Boolean).join(" ")}</Field>}
            {(bp || sugar) && <Field label="Vitals">{[bp && `BP ${bp}`, sugar && `Sugar ${sugar}`].filter(Boolean).join(" · ")}</Field>}
            {redFlags && <Field label="Red flags"><span className="text-rose-300">{redFlags}</span></Field>}
          </dl>
        </Section>
      ) : null}

      {(call.parent_mood || call.mood_note || call.conversation_signal || call.call_outcome) && (
        <Section title="How the call went">
          <dl>
            {call.call_outcome && <Field label="Outcome">{humanize(call.call_outcome)}</Field>}
            {(call.parent_mood || clean(call.mood_note)) && (
              <Field label="Mood">
                {call.parent_mood && <span className="text-zinc-100">{humanize(call.parent_mood)}</span>}
                {call.parent_mood && clean(call.mood_note) && <span className="text-zinc-500"> — </span>}
                {clean(call.mood_note)}
              </Field>
            )}
            {call.conversation_signal && <Field label="Openness">{humanize(call.conversation_signal)}</Field>}
          </dl>
        </Section>
      )}

      {(clean(call.ongoing_health_context) || clean(call.personal_context)) && (
        <Section title="Context Anya picked up">
          <dl>
            {clean(call.ongoing_health_context) && <Field label="Health">{clean(call.ongoing_health_context)}</Field>}
            {clean(call.personal_context) && <Field label="Personal">{clean(call.personal_context)}</Field>}
          </dl>
        </Section>
      )}

      <TechnicalDetails call={call} />
    </div>
  );
}

function TechnicalDetails({ call }: { call: SarvamCallRecord }) {
  const [open, setOpen] = useState(false);
  const vars = call.agent_variables || {};
  const rows: [string, string][] = [
    ["attempt_id", call.attempt_id || call.id],
    ...(call.interaction_id ? [["interaction_id", call.interaction_id] as [string, string]] : []),
    ...Object.entries(vars).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)] as [string, string]),
  ];

  return (
    <div className="pt-10">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        Technical details
      </button>
      {open && (
        <dl className="mt-3 divide-y divide-white/[0.05]">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-1 sm:grid-cols-[168px_1fr] gap-x-6 py-2">
              <dt className="font-mono text-[12px] text-zinc-500">{k}</dt>
              <dd className="font-mono text-[12px] text-zinc-300 break-all whitespace-pre-wrap">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function ConversationTab({
  transcript,
  loading,
  parentName,
  durationSeconds,
}: {
  transcript: TranscriptTurn[];
  loading: boolean;
  parentName: string;
  durationSeconds: number;
}) {
  if (loading) return <p className="text-[13px] text-zinc-600">Loading conversation…</p>;
  if (transcript.length === 0) {
    return (
      <p className="text-[13px] text-zinc-500">
        {durationSeconds > 0 ? "No transcript was recorded for this call." : "No conversation took place."}
      </p>
    );
  }

  const firstName = parentName.split(" ")[0];

  return (
    <ol>
      {transcript.map((turn, idx) => {
        const isAgent = turn.role === "agent";
        const sameAsPrev = idx > 0 && transcript[idx - 1].role === turn.role;
        return (
          <li
            key={turn.turn_id || idx}
            className={`grid grid-cols-[72px_1fr] gap-x-5 ${sameAsPrev ? "pt-1.5" : "pt-5 first:pt-0"}`}
          >
            <span className={`text-[12px] leading-6 font-medium ${isAgent ? "text-[#E9D39A]" : "text-zinc-400"}`}>
              {sameAsPrev ? "" : isAgent ? "Anya" : firstName}
            </span>
            <p className={`text-[14px] leading-6 ${isAgent ? "text-zinc-400" : "text-zinc-100"}`}>{turn.text}</p>
          </li>
        );
      })}
    </ol>
  );
}

function MemoryTab({ details, loading }: { details: CallDetails | null; loading: boolean }) {
  const [view, setView] = useState<"changes" | "after" | "before">("changes");
  const record = details?.record;

  const parsed = useMemo(() => {
    if (!record?.resulting_user_context) return null;
    const before = parseMemory(record.previous_user_context);
    const after = parseMemory(record.resulting_user_context);
    return { before, after, diff: diffMemory(before, after) };
  }, [record?.previous_user_context, record?.resulting_user_context]);

  if (loading && !details) return <p className="text-[13px] text-zinc-600">Loading memory…</p>;
  if (!parsed) {
    return (
      <div>
        <p className="text-[14px] text-zinc-300 leading-6">This call didn&apos;t update Anya&apos;s memory.</p>
        <p className="text-[13px] text-zinc-500 mt-1">
          Memory is updated after connected calls once the AI review has run.
        </p>
      </div>
    );
  }

  const views: { id: typeof view; label: string }[] = [
    { id: "changes", label: "What changed" },
    { id: "after", label: "After this call" },
    { id: "before", label: "Before" },
  ];

  return (
    <div>
      <div className="inline-flex gap-1 p-0.5 rounded-lg bg-white/[0.04] mb-6">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-3 py-1 rounded-md text-[12px] transition-colors ${
              view === v.id ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "changes" && <MemoryDiffView diff={parsed.diff} after={parsed.after} />}
      {view === "after" && <MemoryDocument memory={parsed.after} />}
      {view === "before" &&
        (record.previous_user_context ? (
          <MemoryDocument memory={parsed.before} />
        ) : (
          <p className="text-[13px] text-zinc-500">Anya had no memory before this call.</p>
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

export function CallDetailDrawer({ call, onClose }: CallDetailDrawerProps) {
  const [tab, setTab] = useState<Tab>("summary");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [details, setDetails] = useState<CallDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const attemptId = call?.attempt_id || call?.id;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab, attemptId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Transcript (Sarvam, with Supabase fallback)
  useEffect(() => {
    setTab("summary");
    setTranscript([]);
    if (!call?.interaction_id && !attemptId) return;

    let active = true;
    setIsLoadingTranscript(true);
    const params = new URLSearchParams();
    if (call?.interaction_id && call.interaction_id !== "NO_INTERACTION_ID") {
      params.set("interaction_id", call.interaction_id);
    }
    if (attemptId) params.set("attempt_id", attemptId);

    fetch(`/api/calls/transcript?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const raw = Array.isArray(data.transcript) && data.transcript.length ? data.transcript : data.messages || [];
        setTranscript(
          raw
            .map((t: any, idx: number) => ({
              turn_id: String(t.turn_id || idx + 1),
              role: t.role === "assistant" || t.role === "agent" ? "agent" : "user",
              // Sarvam marks barge-ins with "<interruption>"; show a cut-off instead.
              text: (t.text || t.content || "").replace(/\s*<interruption>\s*/gi, "…").trim(),
            }))
            .filter((t: TranscriptTurn) => t.text)
        );
      })
      .catch((err) => console.error("Failed to load transcript:", err))
      .finally(() => active && setIsLoadingTranscript(false));

    return () => {
      active = false;
    };
  }, [call?.interaction_id, attemptId]);

  // AI assessment, health log and memory change (Supabase)
  useEffect(() => {
    setDetails(null);
    if (!attemptId) return;
    let active = true;
    setIsLoadingDetails(true);
    fetch(`/api/calls/details?attempt_id=${encodeURIComponent(attemptId)}`)
      .then((res) => res.json())
      .then((data) => active && setDetails(data.error ? { record: null, decisionCard: null, dailyLog: null } : data))
      .catch(() => active && setDetails({ record: null, decisionCard: null, dailyLog: null }))
      .finally(() => active && setIsLoadingDetails(false));
    return () => {
      active = false;
    };
  }, [attemptId]);

  if (!call) return null;

  const parentName = call.parent_name || "Parent";
  const status = callStatusMeta(call.call_status);
  const meta = [
    formatDateTime(call.created_at),
    call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : "",
    call.language_name || "",
  ].filter(Boolean);

  const connected =
    call.call_status === "connected" || call.call_status === "completed" || Boolean(call.call_summary);
  const tabs: { id: Tab; label: string; count?: number }[] = connected
    ? [
        { id: "summary", label: "Summary" },
        { id: "conversation", label: "Conversation", count: transcript.length || undefined },
        { id: "memory", label: "Memory" },
      ]
    : [{ id: "summary", label: "Summary" }];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />

      <aside
        role="dialog"
        aria-label={`Call with ${parentName}`}
        className="fixed top-0 right-0 h-full w-full max-w-[720px] z-50 bg-[#0E0F11] border-l border-white/[0.06] flex flex-col animate-in slide-in-from-right duration-200"
      >
        <header className="px-8 pt-7 shrink-0">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h2 className="text-[22px] font-semibold text-white tracking-tight truncate">{parentName}</h2>
              <div className="mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-[13px] text-zinc-500">
                <StatusLabel tone={status.tone}>{status.label}</StatusLabel>
                {meta.map((m) => (
                  <span key={m} className="whitespace-nowrap">
                    <span className="text-zinc-700 mr-3">·</span>
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              title="Close (Esc)"
              className="-mr-2 w-9 h-9 rounded-full text-zinc-500 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>

          {call.has_recording && call.interaction_id && (
            <div className="mt-6">
              <AudioPlayer
                key={call.interaction_id}
                interactionId={call.interaction_id}
                fallbackDuration={call.duration_seconds}
              />
            </div>
          )}

          <nav className="mt-6 flex gap-6 border-b border-white/[0.06]">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative pb-3 text-[13px] font-medium transition-colors ${
                  tab === t.id ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.label}
                {t.count ? <span className="ml-1.5 text-zinc-600 tabular-nums">{t.count}</span> : null}
                {tab === t.id && <span className="absolute left-0 right-0 -bottom-px h-px bg-white" />}
              </button>
            ))}
          </nav>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 pt-7 pb-16">
          {tab === "summary" && <SummaryTab call={call} details={details} loading={isLoadingDetails} />}
          {tab === "conversation" && (
            <ConversationTab
              transcript={transcript}
              loading={isLoadingTranscript}
              parentName={parentName}
              durationSeconds={call.duration_seconds}
            />
          )}
          {tab === "memory" && <MemoryTab details={details} loading={isLoadingDetails} />}
        </div>
      </aside>
    </>
  );
}
