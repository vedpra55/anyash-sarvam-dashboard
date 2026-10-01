"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CheckResult, EvalPrompt, EvalScenario, Turn } from "@/lib/evals";
import { Button, FieldLabel, FormError, SelectInput, TextArea, TextInput } from "../primitives";
import { CheckList, Pill, SectionTitle, Transcript } from "./ui";

const LIMIT = 240;

type Graded = { checks: CheckResult[]; criteria: CheckResult[]; passed: boolean; stats?: { parentShare: number } };

/** Manual testing: you play the parent, the agent answers with the prompt you picked. */
export function ManualTab({ prompts, scenarios }: { prompts: EvalPrompt[]; scenarios: EvalScenario[] }) {
  const [promptId, setPromptId] = useState("");
  const [callNumber, setCallNumber] = useState(3);
  const [names, setNames] = useState({ parent_name: "Sunita", honorific: "Mummy Ji", child_name: "Priya" });
  const [context, setContext] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState<"" | "reply" | "grade">("");
  const [error, setError] = useState("");
  const [graded, setGraded] = useState<Graded | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const chosenPrompt = promptId || prompts[0]?.id || "";
  const vars = { ...names, call_number: callNumber, user_context: context };
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [turns]);

  const pickScenario = (id: string) => {
    setScenarioId(id);
    const s = scenarios.find((x) => x.id === id);
    if (!s) return;
    setCallNumber(s.call_number);
    setContext(s.user_context || "");
    setNames({ parent_name: s.parent_name || "Sunita", honorific: s.honorific || "Mummy Ji", child_name: s.child_name || "Priya" });
  };

  const call = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  };

  const start = async () => {
    setError("");
    setGraded(null);
    setEnded(false);
    setBusy("reply");
    try {
      const d = await call("/api/evals/chat", { promptId: chosenPrompt, vars, turns: [] });
      setTurns([{ role: "agent", text: d.text }]);
      setSeconds(0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || busy || ended) return;
    const next: Turn[] = [...turns, { role: "parent", text }];
    setTurns(next);
    setDraft("");
    setBusy("reply");
    setError("");
    try {
      const d = await call("/api/evals/chat", { promptId: chosenPrompt, vars, turns: next });
      setTurns([...next, { role: "agent", text: d.text }]);
      setSeconds(d.est_seconds || 0);
      if (d.ends) setEnded(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const grade = async () => {
    setBusy("grade");
    setError("");
    try {
      const s = scenarios.find((x) => x.id === scenarioId);
      const d = await call("/api/evals/grade", {
        turns,
        ended: ended ? "agent_end" : seconds >= LIMIT ? "cutoff" : "parent_hangup",
        scenario: s ? { name: s.name, persona: s.persona, notes: s.notes } : { name: "Manual conversation" },
        checks: s?.checks || null,
        criteria: s?.criteria || null,
      });
      setGraded(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const started = turns.length > 0;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-12">
      <div className="space-y-4">
        <SectionTitle>Set up the call</SectionTitle>
        <FieldLabel label="Prompt">
          <SelectInput value={chosenPrompt} onChange={(e) => setPromptId(e.target.value)} disabled={started}>
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectInput>
        </FieldLabel>
        <FieldLabel label="Fill from a scenario (optional)" hint="Copies its call number and brief, and grades against its criteria.">
          <SelectInput value={scenarioId} onChange={(e) => pickScenario(e.target.value)} disabled={started}>
            <option value="">None</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.group_name}: {s.name}
              </option>
            ))}
          </SelectInput>
        </FieldLabel>
        <div className="grid grid-cols-3 gap-3">
          <FieldLabel label="Parent">
            <TextInput value={names.parent_name} onChange={(e) => setNames({ ...names, parent_name: e.target.value })} disabled={started} />
          </FieldLabel>
          <FieldLabel label="Honorific">
            <TextInput value={names.honorific} onChange={(e) => setNames({ ...names, honorific: e.target.value })} disabled={started} />
          </FieldLabel>
          <FieldLabel label="Child">
            <TextInput value={names.child_name} onChange={(e) => setNames({ ...names, child_name: e.target.value })} disabled={started} />
          </FieldLabel>
        </div>
        <FieldLabel label="Call number">
          <SelectInput value={callNumber} onChange={(e) => setCallNumber(Number(e.target.value))} disabled={started}>
            <option value={1}>1 (introduction)</option>
            <option value={2}>2 (their normal day)</option>
            <option value={3}>3 or later</option>
          </SelectInput>
        </FieldLabel>
        <FieldLabel label="Pre-call brief (user_context)">
          <TextArea rows={7} value={context} onChange={(e) => setContext(e.target.value)} disabled={started} />
        </FieldLabel>
        <Button variant={started ? "secondary" : "primary"} onClick={start} disabled={!chosenPrompt || busy !== ""}>
          {started ? "Start over" : "Start the call"}
        </Button>
      </div>

      <div className="min-w-0">
        <SectionTitle
          aside={
            started && (
              <span className="flex items-center gap-2">
                <Pill tone={seconds >= LIMIT - 40 ? "warn" : "neutral"}>~{seconds}s of {LIMIT}s</Pill>
                {ended && <Pill tone="good">Agent ended the call</Pill>}
              </span>
            )
          }
        >
          Conversation
        </SectionTitle>
        <div className="min-h-[260px] max-h-[520px] overflow-y-auto pr-1">
          <Transcript turns={turns} empty="Press “Start the call”. Anyash speaks first, then you reply as the parent." />
          <div ref={bottom} />
        </div>
        {busy === "reply" && <p className="text-[12.5px] text-zinc-600 mt-2">Anyash is replying…</p>}
        <FormError>{error}</FormError>

        {started && (
          <div className="mt-4 flex gap-2">
            <TextInput
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={ended ? "The call has ended" : "Type what the parent says…"}
              disabled={ended || busy !== ""}
              autoFocus
            />
            <Button variant="primary" onClick={send} disabled={!draft.trim() || ended || busy !== ""}>
              Send
            </Button>
            <Button onClick={grade} disabled={turns.length < 3 || busy !== ""}>
              {busy === "grade" ? "Grading…" : "Grade"}
            </Button>
          </div>
        )}

        {graded && (
          <div className="mt-8">
            <SectionTitle aside={<Pill tone={graded.passed ? "good" : "bad"}>{graded.passed ? "Passed" : "Failed"}</Pill>}>Grades</SectionTitle>
            <CheckList checks={graded.checks} criteria={graded.criteria} />
          </div>
        )}
      </div>
    </div>
  );
}
