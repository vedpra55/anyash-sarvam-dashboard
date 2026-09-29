"use client";

/**
 * Client data layer: every fetch in the dashboard goes through TanStack Query,
 * so data is loaded once, shared by every page, shown instantly on navigation
 * and refreshed quietly in the background.
 */

import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

/* ------------------------------------------------------------------ */
/* Fetch helper                                                        */
/* ------------------------------------------------------------------ */

export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

/* ------------------------------------------------------------------ */
/* Keys                                                                */
/* ------------------------------------------------------------------ */

export const keys = {
  parents: ["parents"] as const,
  calls: ["calls"] as const,
  callDetails: (attemptId: string) => ["call", attemptId, "details"] as const,
  transcript: (attemptId: string, interactionId?: string) =>
    ["call", attemptId, "transcript", interactionId || ""] as const,
  memory: (parentId: string) => ["parent", parentId, "memory"] as const,
  settings: ["settings"] as const,
  insights: ["insights"] as const,
};

/* ------------------------------------------------------------------ */
/* Query options (shared by hooks and prefetching)                     */
/* ------------------------------------------------------------------ */

export const parentsQuery = {
  queryKey: keys.parents,
  queryFn: () => fetchJson<{ parents: any[] }>("/api/parents").then((d) => d.parents || []),
  // Keep the Today page current while it's open: new calls and reviews appear on their own.
  refetchInterval: 60_000,
};

export const callsQuery = {
  queryKey: keys.calls,
  queryFn: () => fetchJson<{ calls: any[] }>("/api/calls").then((d) => d.calls || []),
  refetchInterval: 60_000,
};

/** The trial call ledger for Insights; heavy, so it refreshes less often. */
export const insightsQuery = {
  queryKey: keys.insights,
  queryFn: () => fetchJson<import("./insights").Ledger>("/api/insights"),
  staleTime: 5 * 60_000,
  refetchInterval: 5 * 60_000,
};

export interface TranscriptTurn {
  turn_id: string;
  role: "agent" | "user";
  text: string;
}

export function transcriptQuery(attemptId: string, interactionId?: string) {
  return {
    queryKey: keys.transcript(attemptId, interactionId),
    queryFn: async (): Promise<TranscriptTurn[]> => {
      const params = new URLSearchParams();
      if (interactionId && interactionId !== "NO_INTERACTION_ID") params.set("interaction_id", interactionId);
      if (attemptId) params.set("attempt_id", attemptId);
      const data = await fetchJson(`/api/calls/transcript?${params.toString()}`);
      const raw = Array.isArray(data.transcript) && data.transcript.length ? data.transcript : data.messages || [];
      return raw
        .map((t: any, idx: number) => ({
          turn_id: String(t.turn_id || idx + 1),
          role: t.role === "assistant" || t.role === "agent" ? "agent" : "user",
          // Sarvam marks barge-ins with "<interruption>"; show a cut-off instead.
          text: (t.text || t.content || "").replace(/\s*<interruption>\s*/gi, "…").trim(),
        }))
        .filter((t: TranscriptTurn) => t.text);
    },
    // A finished call's transcript doesn't change.
    staleTime: 10 * 60_000,
  };
}

export function callDetailsQuery(attemptId: string) {
  return {
    queryKey: keys.callDetails(attemptId),
    queryFn: () =>
      fetchJson<{ record: any; decisionCard: any; dailyLog: any }>(
        `/api/calls/details?attempt_id=${encodeURIComponent(attemptId)}`
      ),
    staleTime: 60_000,
  };
}

export function memoryQuery(parentId: string) {
  return {
    queryKey: keys.memory(parentId),
    queryFn: () => fetchJson(`/api/parents/${parentId}/memory`),
  };
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

export function useCallsQuery() {
  return useQuery(callsQuery);
}

export function useCallDetails(attemptId?: string) {
  return useQuery({ ...callDetailsQuery(attemptId || ""), enabled: Boolean(attemptId) });
}

export function useTranscript(attemptId?: string, interactionId?: string) {
  return useQuery({ ...transcriptQuery(attemptId || "", interactionId), enabled: Boolean(attemptId || interactionId) });
}

export function useMemory(parentId: string) {
  return useQuery(memoryQuery(parentId));
}

/** Warm the cache for a call before its drawer opens (e.g. on hover). */
export function prefetchCall(qc: QueryClient, call: { attempt_id?: string; id?: string; interaction_id?: string } | null) {
  const attemptId = call?.attempt_id || call?.id;
  if (!attemptId) return;
  qc.prefetchQuery(callDetailsQuery(attemptId));
  qc.prefetchQuery(transcriptQuery(attemptId, call?.interaction_id));
}

/** Refresh everything that a call, edit or review can change. */
export function invalidateAll(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: keys.parents });
  qc.invalidateQueries({ queryKey: keys.calls });
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

/** Mark a follow-up done. The UI updates immediately and rolls back on failure. */
export function useMarkDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) =>
      fetchJson(`/api/decisions/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_completed: true }),
      }),
    onMutate: async (cardId) => {
      await qc.cancelQueries({ queryKey: keys.parents });
      const previous = qc.getQueryData<any[]>(keys.parents);
      qc.setQueryData<any[]>(keys.parents, (parents) =>
        (parents || []).map((p) => ({
          ...p,
          reviews: (p.reviews || []).map((r: any) => (r.card_id === cardId ? { ...r, action_completed: true } : r)),
        }))
      );
      return { previous };
    },
    onError: (_err, _cardId, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.parents, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.parents }),
  });
}

/** Save Anya's memory for a parent. */
export function useSaveMemory(parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memory: string) =>
      fetchJson<{ parent: any }>(`/api/parents/${parentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_user_context: memory }),
      }),
    onSuccess: (data, memory) => {
      qc.setQueryData(keys.memory(parentId), (prev: any) => ({
        ...(prev || {}),
        memory: data.parent?.current_user_context ?? memory,
        updatedAt: data.parent?.updated_at || new Date().toISOString(),
      }));
      qc.setQueryData<any[]>(keys.parents, (parents) =>
        (parents || []).map((p) =>
          p.id === parentId ? { ...p, current_user_context: data.parent?.current_user_context ?? memory } : p
        )
      );
    },
  });
}
