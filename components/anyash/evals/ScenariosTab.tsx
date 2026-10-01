"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ALL_CHECKS, CHECK_INFO, type EvalScenario } from "@/lib/evals";
import { Button, EmptyState, FieldLabel, FormError, Modal, SelectInput, TextArea, TextInput } from "../primitives";
import { Pill } from "./ui";

type Form = {
  id?: string;
  slug?: string | null;
  name: string;
  group_name: string;
  kind: "simulation" | "scripted";
  persona: string;
  behaviours: string;
  language: string;
  parent_name: string;
  honorific: string;
  child_name: string;
  call_number: number;
  max_exchanges: number;
  user_context: string;
  script: string;
  criteria: string;
  checks: string[];
  notes: string;
};

const EMPTY: Form = {
  name: "",
  group_name: "Custom",
  kind: "simulation",
  persona: "",
  behaviours: "",
  language: "Hinglish",
  parent_name: "Sunita",
  honorific: "Mummy Ji",
  child_name: "Priya",
  call_number: 3,
  max_exchanges: 12,
  user_context: "",
  script: "",
  criteria: "",
  checks: ALL_CHECKS,
  notes: "",
};

const toForm = (s: EvalScenario): Form => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  group_name: s.group_name,
  kind: s.kind,
  persona: s.persona,
  behaviours: s.behaviours || "",
  language: s.language || "",
  parent_name: s.parent_name || "",
  honorific: s.honorific || "",
  child_name: s.child_name || "",
  call_number: s.call_number,
  max_exchanges: s.max_exchanges,
  user_context: s.user_context || "",
  script: (s.script || []).join("\n"),
  criteria: s.criteria.map((c) => c.text).join("\n"),
  checks: s.checks || ALL_CHECKS,
  notes: s.notes || "",
});

const slugOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 5).join("_") || "criterion";

export function ScenariosTab({ scenarios }: { scenarios: EvalScenario[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError("");
    try {
      const body = {
        ...form,
        script: form.kind === "scripted" ? form.script : null,
        criteria: form.criteria
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean)
          .map((text) => ({ id: slugOf(text), text })),
      };
      const res = await fetch(form.id ? `/api/evals/scenarios/${form.id}` : "/api/evals/scenarios", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save.");
      await qc.invalidateQueries({ queryKey: ["eval-scenarios"] });
      setForm(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: EvalScenario) => {
    if (!confirm(`Delete "${s.name}"? Past results keep their transcripts.`)) return;
    await fetch(`/api/evals/scenarios/${s.id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["eval-scenarios"] });
  };

  const groups = new Map<string, EvalScenario[]>();
  for (const s of scenarios) groups.set(s.group_name, [...(groups.get(s.group_name) || []), s]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-zinc-500 max-w-xl leading-6">
          A scenario is a simulated parent (who they are and how they behave) plus what to check. Simulated scenarios are played by a model; scripted ones say fixed lines, so they repeat exactly.
        </p>
        <Button variant="primary" size="sm" onClick={() => setForm({ ...EMPTY })}>
          New scenario
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <EmptyState title="No scenarios yet.">Use "Load starting set" at the top, or add your own.</EmptyState>
      ) : (
        Array.from(groups.entries()).map(([group, list]) => (
          <div key={group} className="mb-8">
            <div className="text-[12.5px] text-zinc-500 mb-1">{group}</div>
            <ul className="divide-y divide-white/[0.05]">
              {list.map((s) => (
                <li key={s.id} className="py-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-6 gap-y-1">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] text-zinc-100">{s.name}</span>
                      <Pill tone="neutral">{s.kind === "scripted" ? "scripted" : "simulated"}</Pill>
                      <span className="text-[12px] text-zinc-600">call {s.call_number}</span>
                    </div>
                    <p className="text-[12.5px] text-zinc-500 leading-5 mt-1 line-clamp-2">{s.persona}</p>
                    {s.criteria.length > 0 && <p className="text-[12px] text-zinc-600 mt-1">{s.criteria.length} behaviour criteria</p>}
                  </div>
                  <div className="flex gap-3 text-[12.5px] sm:justify-end items-start">
                    <button className="text-zinc-400 hover:text-white" onClick={() => setForm(toForm(s))}>
                      Edit
                    </button>
                    <button className="text-zinc-600 hover:text-rose-300" onClick={() => remove(s)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {form && (
        <Modal open title={form.id ? "Edit scenario" : "New scenario"} onClose={() => setForm(null)} width={760}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldLabel label="Name">
                <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} />
              </FieldLabel>
              <FieldLabel label="Group">
                <TextInput value={form.group_name} onChange={(e) => set("group_name", e.target.value)} />
              </FieldLabel>
            </div>
            <FieldLabel label="Type" hint="Simulated: a model plays the parent from the description. Scripted: the parent says your fixed lines, one per turn.">
              <SelectInput value={form.kind} onChange={(e) => set("kind", e.target.value as Form["kind"])}>
                <option value="simulation">Simulated parent</option>
                <option value="scripted">Scripted parent lines</option>
              </SelectInput>
            </FieldLabel>
            <FieldLabel label="Who the parent is">
              <TextArea rows={3} value={form.persona} onChange={(e) => set("persona", e.target.value)} placeholder="Sunita, 68, retired teacher. Her knee has hurt for a week..." />
            </FieldLabel>
            {form.kind === "simulation" ? (
              <FieldLabel label="How she behaves" hint="Her habits in this call: short answers, long stories, questions she asks.">
                <TextArea rows={3} value={form.behaviours} onChange={(e) => set("behaviours", e.target.value)} />
              </FieldLabel>
            ) : (
              <FieldLabel label="Parent lines, one per line" hint="Said in order after each agent turn. When they run out the parent hangs up.">
                <TextArea rows={5} value={form.script} onChange={(e) => set("script", e.target.value)} />
              </FieldLabel>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <FieldLabel label="Parent name">
                <TextInput value={form.parent_name} onChange={(e) => set("parent_name", e.target.value)} />
              </FieldLabel>
              <FieldLabel label="Honorific">
                <TextInput value={form.honorific} onChange={(e) => set("honorific", e.target.value)} />
              </FieldLabel>
              <FieldLabel label="Child name">
                <TextInput value={form.child_name} onChange={(e) => set("child_name", e.target.value)} />
              </FieldLabel>
              <FieldLabel label="Language">
                <TextInput value={form.language} onChange={(e) => set("language", e.target.value)} />
              </FieldLabel>
              <FieldLabel label="Call number">
                <TextInput type="number" min={1} value={form.call_number} onChange={(e) => set("call_number", Number(e.target.value))} />
              </FieldLabel>
              <FieldLabel label="Max exchanges">
                <TextInput type="number" min={1} max={40} value={form.max_exchanges} onChange={(e) => set("max_exchanges", Number(e.target.value))} />
              </FieldLabel>
            </div>
            <FieldLabel label="Pre-call brief (sent as user_context)" hint="What the agent knows going in: the text from the Memory tab, or your own.">
              <TextArea rows={5} value={form.user_context} onChange={(e) => set("user_context", e.target.value)} />
            </FieldLabel>
            <FieldLabel label="Behaviour criteria, one per line" hint="Plain sentences the judge checks, e.g. “The agent never says the dizziness is normal.”">
              <TextArea rows={4} value={form.criteria} onChange={(e) => set("criteria", e.target.value)} />
            </FieldLabel>
            <div>
              <div className="text-[13px] text-zinc-300 mb-2">Checks that apply</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {ALL_CHECKS.map((id) => (
                  <label key={id} className="flex items-center gap-2 text-[13px] text-zinc-200 cursor-pointer" title={CHECK_INFO[id].meaning}>
                    <input
                      type="checkbox"
                      className="accent-amber-300"
                      checked={form.checks.includes(id)}
                      onChange={(e) => set("checks", e.target.checked ? [...form.checks, id] : form.checks.filter((c) => c !== id))}
                    />
                    {CHECK_INFO[id].label}
                  </label>
                ))}
              </div>
            </div>
            <FormError>{error}</FormError>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save scenario"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
