/**
 * Decides what needs the operator's attention for each parent, from their
 * Sarvam calls (latest first) and AI reviews (call_records + decision cards).
 * Shared by the Today page and the Parents list so both rank the same way.
 */

import { parseMemory } from "./memory";

export type AttentionTone = "urgent" | "notify" | "watch" | "good" | "neutral";

export interface ParentReview {
  attempt_id: string;
  created_at: string;
  call_outcome?: string | null;
  follow_up_needed?: string | null;
  follow_up_detail?: string | null;
  ai_decision?: string | null;
  ai_urgency?: string | null;
  ai_observation?: string | null;
  ai_recommended_action?: string | null;
  card_id?: string | null;
  next_action?: string | null;
  next_follow_up_date?: string | null;
  action_completed?: boolean;
}

export type TodayState = "done" | "not_reached" | "pending";

export interface ParentStatus {
  /** Lower sorts first. */
  rank: number;
  tone: AttentionTone;
  /** Short verdict, e.g. "Let the family know". */
  label: string;
  /** Why, in one line. */
  reason: string;
  /** Present when the item belongs in "Needs attention". */
  needsAttention: boolean;
  /** Decision card that can be marked done. */
  cardId: string | null;
  today: TodayState;
  lastCallAt: string | null;
  lastConnectedAt: string | null;
  watchItem: string | null;
  latestSummary: string | null;
}

const CONNECTED = new Set(["connected", "completed"]);

export function isConnected(call: { call_status?: string } | null | undefined): boolean {
  return Boolean(call && CONNECTED.has(call.call_status || ""));
}

function sameLocalDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((today - start) / 86400000);
}

function meaningful(text?: string | null): string | null {
  if (!text) return null;
  const t = text.trim();
  if (!t || /^(no|none|no action needed\.?|n\/a)$/i.test(t)) return null;
  return t;
}

export function getParentStatus(
  parent: {
    calls?: any[];
    reviews?: ParentReview[];
    current_user_context?: string | null;
    created_at?: string;
  },
  now: Date = new Date()
): ParentStatus {
  const calls = parent.calls || [];
  const reviews = parent.reviews || [];
  const latestCall = calls[0] || null;
  const lastConnected = calls.find(isConnected) || null;
  const callsToday = calls.filter((c) => c.created_at && sameLocalDay(c.created_at, now));
  const today: TodayState = callsToday.some(isConnected)
    ? "done"
    : callsToday.length > 0
    ? "not_reached"
    : "pending";

  const watchItem = parseMemory(parent.current_user_context).watchlist[0] || null;
  const latestSummary = meaningful(lastConnected?.call_summary) || null;

  const base = {
    cardId: null as string | null,
    today,
    lastCallAt: latestCall?.created_at || null,
    lastConnectedAt: lastConnected?.created_at || null,
    watchItem,
    latestSummary,
  };

  // 1. The latest AI review decides the health verdict, unless its follow-up is done.
  const review = reviews[0];
  if (review && !review.action_completed) {
    const decision = (review.ai_decision || "").toUpperCase();
    const nextStep =
      meaningful(review.next_action) ||
      meaningful(review.ai_recommended_action) ||
      meaningful(review.follow_up_detail) ||
      "";
    if (decision === "ESCALATION" || review.ai_urgency === "urgent") {
      return { ...base, rank: 0, tone: "urgent", label: "Escalate now", reason: nextStep || meaningful(review.ai_observation) || "", needsAttention: true, cardId: review.card_id || null };
    }
    if (decision === "FAMILY_NOTIFICATION" || review.ai_urgency === "medium") {
      return { ...base, rank: 1, tone: "notify", label: "Let the family know", reason: nextStep || meaningful(review.ai_observation) || "", needsAttention: true, cardId: review.card_id || null };
    }
    if (review.follow_up_needed === "yes") {
      return { ...base, rank: 2, tone: "watch", label: "Needs follow-up", reason: meaningful(review.follow_up_detail) || nextStep, needsAttention: true, cardId: review.card_id || null };
    }
  }

  // 2. Reachability.
  if (today === "not_reached") {
    return { ...base, rank: 3, tone: "watch", label: "Not reached today", reason: "Called today, but the call didn't connect.", needsAttention: true };
  }
  const gap = daysSince(lastConnected?.created_at || null, now);
  if (lastConnected && gap !== null && gap >= 2) {
    return { ...base, rank: 4, tone: "watch", label: `No check-in for ${gap} days`, reason: "Last spoke " + (gap === 2 ? "two days ago." : `${gap} days ago.`), needsAttention: true };
  }
  if (!lastConnected && calls.length > 0) {
    return { ...base, rank: 4, tone: "watch", label: "Never reached", reason: "No call has connected yet.", needsAttention: true };
  }

  // 3. Everything is fine: show the review verdict for context.
  if (review && (review.ai_decision || "").toUpperCase() === "MONITOR" && !review.action_completed) {
    return { ...base, rank: 6, tone: "watch", label: "Keep an eye on it", reason: watchItem || meaningful(review.ai_recommended_action) || "", needsAttention: false, cardId: review.card_id || null };
  }
  if (!latestCall) {
    return { ...base, rank: 7, tone: "neutral", label: "No calls yet", reason: "Place the first call to start check-ins.", needsAttention: false };
  }
  return { ...base, rank: 8, tone: "good", label: "No concerns", reason: latestSummary || "", needsAttention: false };
}
