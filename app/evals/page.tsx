"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/queries";
import type { EvalPrompt, EvalScenario } from "@/lib/evals";
import { Button, TabBar } from "@/components/anyash/primitives";
import { RunsTab } from "@/components/anyash/evals/RunsTab";
import { ScenariosTab } from "@/components/anyash/evals/ScenariosTab";
import { PromptsTab } from "@/components/anyash/evals/PromptsTab";
import { ManualTab } from "@/components/anyash/evals/ManualTab";

type Tab = "runs" | "manual" | "scenarios" | "prompts";

/** Our own evals: run a prompt against simulated parents and grade the conversations, or test it by hand. */
export default function EvalsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("runs");
  const [seedMsg, setSeedMsg] = useState("");
  const [seeding, setSeeding] = useState(false);

  const prompts = useQuery({ queryKey: ["eval-prompts"], queryFn: () => fetchJson<{ prompts: EvalPrompt[] }>("/api/evals/prompts") });
  const scenarios = useQuery({ queryKey: ["eval-scenarios"], queryFn: () => fetchJson<{ scenarios: EvalScenario[] }>("/api/evals/scenarios") });
  const p = prompts.data?.prompts || [];
  const s = scenarios.data?.scenarios || [];
  const loadError = prompts.error?.message || scenarios.error?.message;

  const seed = async () => {
    setSeeding(true);
    setSeedMsg("");
    try {
      const d = await fetchJson<{ scenarios: number; prompts: number; skippedPrompts: string[] }>("/api/evals/seed", { method: "POST" });
      setSeedMsg(
        `Added ${d.scenarios} scenarios and ${d.prompts} prompts.` + (d.skippedPrompts.length ? ` Could not read ${d.skippedPrompts.join(", ")}; paste them on the Prompts tab.` : ""),
      );
      qc.invalidateQueries({ queryKey: ["eval-prompts"] });
      qc.invalidateQueries({ queryKey: ["eval-scenarios"] });
    } catch (e: any) {
      setSeedMsg(e.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1180px] mx-auto px-5 sm:px-10 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold text-white tracking-tight">Evals</h1>
            <p className="mt-1 text-[13px] text-zinc-500 max-w-xl leading-6">
              Test a prompt without placing a call. Simulated parents talk to the agent, and every conversation is graded on talk share, feelings, echo, open and closed doors, closing and safety.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {seedMsg && <span className="text-[12.5px] text-zinc-500 max-w-xs">{seedMsg}</span>}
            <Button size="sm" onClick={seed} disabled={seeding}>
              {seeding ? "Loading…" : "Load starting set"}
            </Button>
          </div>
        </div>

        {loadError && (
          <p className="mt-6 text-[13px] text-rose-300 leading-6">
            {loadError}. If this says a table does not exist, the evals migration has not been applied to the database yet.
          </p>
        )}

        <TabBar
          className="mt-8 mb-8"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "runs", label: "Runs" },
            { id: "manual", label: "Manual" },
            { id: "scenarios", label: "Scenarios", count: s.length },
            { id: "prompts", label: "Prompts", count: p.length },
          ]}
        />

        {tab === "runs" && <RunsTab prompts={p} scenarios={s} />}
        {tab === "manual" && <ManualTab prompts={p} scenarios={s} />}
        {tab === "scenarios" && <ScenariosTab scenarios={s} />}
        {tab === "prompts" && <PromptsTab prompts={p} />}
      </div>
    </div>
  );
}
