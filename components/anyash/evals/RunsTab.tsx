"use client";

import React, { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/queries";
import { checkTotals, CHECK_INFO, summarizeResults, type CheckId, type EvalPrompt, type EvalResult, type EvalRun, type EvalScenario } from "@/lib/evals";
import { Button, EmptyState, FieldLabel, FormError, SelectInput, TextInput } from "../primitives";
import { CheckList, CheckPill, endedLabel, pct, Pill, SectionTitle, Transcript } from "./ui";

const CONCURRENCY = 3;
const MAX_STEPS = 60;

/** Steps each result until it is done. A result already being driven in this tab is skipped. */
function useDriver(onTick: () => void) {
  const driving = useRef(new Set<string>());
  const [active, setActive] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const drive = async (ids: string[]) => {
    const queue = ids.filter((id) => !driving.current.has(id));
    queue.forEach((id) => driving.current.add(id));
    setActive((n) => n + queue.length);
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()!;
        try {
          for (let i = 0; i < MAX_STEPS; i++) {
            const res = await fetch("/api/evals/step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resultId: id }) });
            const data = await res.json().catch(() => ({}));
            onTick();
            if (!res.ok) throw new Error(data.error || `Step failed (${res.status})`);
            if (data.status === "done") break;
          }
        } catch (err: any) {
          setErrors((e) => ({ ...e, [id]: err?.message || "Failed" }));
        } finally {
          driving.current.delete(id);
          setActive((n) => n - 1);
          onTick();
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  };
  return { drive, active, errors };
}

export function RunsTab({ prompts, scenarios }: { prompts: EvalPrompt[]; scenarios: EvalScenario[] }) {
  const qc = useQueryClient();
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [promptId, setPromptId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const runs = useQuery({
    queryKey: ["eval-runs"],
    queryFn: () => fetchJson<{ runs: (EvalRun & { results: { status: string; passed: boolean | null }[] })[] }>("/api/evals/runs"),
    refetchInterval: (q) => (q.state.data?.runs.some((r) => r.status === "running") ? 4000 : 30_000),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["eval-runs"] });
    qc.invalidateQueries({ queryKey: ["eval-run"] });
  };
  const { drive, active, errors } = useDriver(refresh);

  const groups = useMemo(() => {
    const g = new Map<string, EvalScenario[]>();
    for (const s of scenarios) g.set(s.group_name, [...(g.get(s.group_name) || []), s]);
    return Array.from(g.entries());
  }, [scenarios]);
  const chosenPrompt = promptId || prompts[0]?.id || "";

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const start = async () => {
    setError("");
    setStarting(true);
    try {
      const res = await fetch("/api/evals/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId: chosenPrompt, scenarioIds: Array.from(picked), label }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start the run.");
      setOpenRun(data.runId);
      setLabel("");
      refresh();
      void drive(data.resultIds);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      <SectionTitle>New run</SectionTitle>
      {prompts.length === 0 || scenarios.length === 0 ? (
        <EmptyState title="Nothing to run yet.">Add a prompt and some scenarios (the "Load starting set" button adds the ones we wrote).</EmptyState>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <FieldLabel label="Prompt to test">
              <SelectInput value={chosenPrompt} onChange={(e) => setPromptId(e.target.value)}>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectInput>
            </FieldLabel>
            <FieldLabel label="Label (optional)">
              <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. after the tips change" />
            </FieldLabel>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] text-zinc-300">Scenarios ({picked.size} chosen)</span>
              <span className="flex gap-3 text-[12.5px]">
                <button className="text-zinc-400 hover:text-white" onClick={() => setPicked(new Set(scenarios.map((s) => s.id)))}>
                  All
                </button>
                <button className="text-zinc-400 hover:text-white" onClick={() => setPicked(new Set())}>
                  None
                </button>
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {groups.map(([group, list]) => (
                <div key={group}>
                  <div className="text-[12.5px] text-zinc-500 mb-1">{group}</div>
                  {list.map((s) => (
                    <label key={s.id} className="flex items-center gap-2.5 py-1 text-[13px] text-zinc-200 cursor-pointer">
                      <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} className="accent-amber-300" />
                      {s.name}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <FormError>{error}</FormError>
          <div className="flex items-center gap-4">
            <Button variant="primary" onClick={start} disabled={starting || picked.size === 0}>
              {starting ? "Starting…" : `Run ${picked.size || ""} ${picked.size === 1 ? "scenario" : "scenarios"}`}
            </Button>
            <span className="text-[12.5px] text-zinc-600">Runs on OpenAI through the eval-agent function. It keeps going if you leave this page open; you can resume a run later.</span>
          </div>
        </div>
      )}

      <div className="mt-12">
        <SectionTitle>Runs</SectionTitle>
        {runs.isPending ? (
          <p className="text-[13px] text-zinc-600">Loading…</p>
        ) : !runs.data?.runs.length ? (
          <p className="text-[13px] text-zinc-500">No runs yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {runs.data.runs.map((r) => {
              const s = summarizeResults(r.results as any);
              const open = openRun === r.id;
              return (
                <li key={r.id}>
                  <button onClick={() => setOpenRun(open ? null : r.id)} className="w-full py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-left hover:bg-white/[0.02]">
                    <span className="text-[13.5px] text-zinc-100">{r.label || r.prompt_name}</span>
                    {r.label && <span className="text-[12.5px] text-zinc-500">{r.prompt_name}</span>}
                    <span className="text-[12.5px] text-zinc-600">{new Date(r.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <Pill tone={s.rate === null ? "neutral" : s.failed || s.errored ? "bad" : "good"}>
                        {s.passed}/{s.total} passed
                      </Pill>
                      {s.pending > 0 && <Pill tone="warn">{s.pending} running</Pill>}
                      {s.errored > 0 && <Pill tone="bad">{s.errored} errors</Pill>}
                    </span>
                  </button>
                  {open && <RunDetail runId={r.id} drive={drive} active={active} errors={errors} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function RunDetail({ runId, drive, active, errors }: { runId: string; drive: (ids: string[]) => Promise<void>; active: number; errors: Record<string, string> }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["eval-run", runId],
    queryFn: () => fetchJson<{ run: EvalRun; results: EvalResult[] }>(`/api/evals/runs/${runId}`),
    refetchInterval: (query) => (query.state.data?.results.some((r) => r.status === "queued" || r.status === "running") ? 3000 : false),
  });
  const [open, setOpen] = useState<string | null>(null);
  if (q.isPending) return <p className="pb-4 text-[13px] text-zinc-600">Loading…</p>;
  if (q.isError || !q.data) return <p className="pb-4 text-[13px] text-rose-300">{q.error?.message}</p>;

  const { results } = q.data;
  const totals = checkTotals(results);
  const todo = results.filter((r) => r.status !== "done");
  const tokens = results.reduce((n, r) => n + (r.tokens || 0), 0);

  return (
    <div className="pb-6 pl-1">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
        {(Object.keys(CHECK_INFO) as CheckId[])
          .filter((id) => totals[id])
          .map((id) => (
            <span key={id} className="text-[12.5px] text-zinc-500" title={CHECK_INFO[id].meaning}>
              {CHECK_INFO[id].label} <span className={totals[id].passed === totals[id].applied ? "text-emerald-300" : "text-amber-200"}>{totals[id].passed}/{totals[id].applied}</span>
            </span>
          ))}
        <span className="text-[12.5px] text-zinc-600">{tokens.toLocaleString()} tokens</span>
        {todo.length > 0 && (
          <Button size="sm" onClick={() => drive(todo.map((r) => r.id))} disabled={active > 0}>
            {active > 0 ? "Running…" : `Resume ${todo.length}`}
          </Button>
        )}
        <button
          className="ml-auto text-[12.5px] text-zinc-600 hover:text-rose-300"
          onClick={async () => {
            if (!confirm("Delete this run and its results?")) return;
            await fetch(`/api/evals/runs/${runId}`, { method: "DELETE" });
            qc.invalidateQueries({ queryKey: ["eval-runs"] });
          }}
        >
          Delete run
        </button>
      </div>

      <ul className="divide-y divide-white/[0.05]">
        {results.map((r) => {
          const isOpen = open === r.id;
          const err = r.error || errors[r.id];
          return (
            <li key={r.id}>
              <button onClick={() => setOpen(isOpen ? null : r.id)} className="w-full py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-left hover:bg-white/[0.02]">
                <span className="w-5 text-center">
                  {r.status === "done" ? (r.passed ? <span className="text-emerald-300">✓</span> : <span className="text-rose-300">✕</span>) : r.status === "error" ? <span className="text-rose-300">!</span> : <span className="text-zinc-600">…</span>}
                </span>
                <span className="text-[13px] text-zinc-100 min-w-[200px]">{r.scenario_name}</span>
                {r.status === "done" && r.stats && (
                  <span className="text-[12px] text-zinc-600">
                    {pct(r.stats.parentShare)} parent · ~{r.stats.estSeconds}s · {endedLabel(r.ended)}
                  </span>
                )}
                {r.status === "running" && <span className="text-[12px] text-amber-200">{Math.ceil(r.transcript.length / 2)} exchanges so far</span>}
                {r.status === "queued" && <span className="text-[12px] text-zinc-600">waiting</span>}
                <span className="flex flex-wrap gap-1.5 sm:ml-auto">{r.grades?.checks.filter((c) => c.pass === false).map((c) => <CheckPill key={c.id} check={c} />)}{r.grades?.criteria.filter((c) => c.pass === false).map((c) => <CheckPill key={c.id} check={{ ...c, id: `criterion:${c.id}` }} />)}</span>
              </button>
              {isOpen && (
                <div className="pb-5 grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div>
                    <div className="text-[12.5px] text-zinc-500 mb-2">Conversation</div>
                    <Transcript turns={r.transcript} />
                  </div>
                  <div>
                    <div className="text-[12.5px] text-zinc-500 mb-2">Checks</div>
                    {err && <p className="text-[13px] text-rose-300 mb-2 break-words">{err}</p>}
                    {r.grades ? <CheckList checks={r.grades.checks} criteria={r.grades.criteria} /> : <p className="text-[13px] text-zinc-600">Graded when the conversation ends.</p>}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
