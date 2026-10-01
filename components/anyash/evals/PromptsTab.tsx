"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { EvalPrompt } from "@/lib/evals";
import { Button, EmptyState, FieldLabel, FormError, TextArea, TextInput } from "../primitives";

export function PromptsTab({ prompts }: { prompts: EvalPrompt[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [opening, setOpening] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const add = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/evals/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, text, opening_line: opening }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setName("");
      setText("");
      setOpening("");
      qc.invalidateQueries({ queryKey: ["eval-prompts"] });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setText(await file.text());
    if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
  };

  const backticks = (t: string) => ["`@answer`", "`query_parent_history`"].filter((x) => !t.includes(x));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-12">
      <div>
        <h2 className="text-[13px] font-medium text-zinc-500 mb-3">Saved prompts</h2>
        {prompts.length === 0 ? (
          <EmptyState title="No prompts yet.">Paste one on the right, or use "Load starting set" to add the two we wrote.</EmptyState>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {prompts.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="text-[13.5px] text-zinc-100">{p.name}</span>
                  <span className="text-[12px] text-zinc-600 tabular-nums">{p.text.length.toLocaleString()} characters · ~{Math.round(p.text.length / 4).toLocaleString()} tokens</span>
                  {backticks(p.text).length > 0 && <span className="text-[12px] text-amber-200">missing backticks around {backticks(p.text).join(", ")}: Sarvam rejects this</span>}
                  <span className="ml-auto flex gap-3 text-[12.5px]">
                    <button className="text-zinc-400 hover:text-white" onClick={() => setOpen(open === p.id ? null : p.id)}>
                      {open === p.id ? "Hide" : "View"}
                    </button>
                    <button
                      className="text-zinc-600 hover:text-rose-300"
                      onClick={async () => {
                        if (!confirm(`Delete "${p.name}"? Runs that used it keep their results.`)) return;
                        await fetch(`/api/evals/prompts/${p.id}`, { method: "DELETE" });
                        qc.invalidateQueries({ queryKey: ["eval-prompts"] });
                      }}
                    >
                      Delete
                    </button>
                  </span>
                </div>
                {open === p.id && <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-[12.5px] leading-6 text-zinc-300 bg-white/[0.03] rounded-lg p-4 max-h-[480px] overflow-y-auto">{p.text}</pre>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-[13px] font-medium text-zinc-500">Add a prompt</h2>
        <FieldLabel label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. v33 draft" />
        </FieldLabel>
        <FieldLabel label="Prompt text" hint="Placeholders like {{parent_name}} and {{user_context}} are filled from each scenario.">
          <TextArea rows={12} value={text} onChange={(e) => setText(e.target.value)} />
        </FieldLabel>
        <input type="file" accept=".txt,.md" onChange={(e) => onFile(e.target.files?.[0])} className="text-[12.5px] text-zinc-500" />
        <FieldLabel label="Opening line (optional)" hint="What the agent says first. Left empty, the current intro is used.">
          <TextInput value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="Namaste {{honorific}}, main Anyaash bol raha hoon. Abhi baat kar sakte hain?" />
        </FieldLabel>
        <FormError>{error}</FormError>
        <Button variant="primary" onClick={add} disabled={saving || !name.trim() || text.trim().length < 50}>
          {saving ? "Saving…" : "Save prompt"}
        </Button>
      </div>
    </div>
  );
}
