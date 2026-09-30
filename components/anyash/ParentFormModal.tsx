"use client";

import React, { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import { ParentItem } from "./ParentsListColumn";
import { OnboardingInput, readOnboarding, validateOnboarding } from "@/lib/onboarding";
import { EMPTY_ONBOARDING, OnboardingForm } from "./OnboardingForm";
import { Modal, Button, FieldLabel, TextInput, FormError } from "./primitives";

interface RoutineRow {
  time: string;
  activity: string;
}

function RoutineEditor({ rows, onChange }: { rows: RoutineRow[]; onChange: (rows: RoutineRow[]) => void }) {
  const update = (i: number, patch: Partial<RoutineRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <TextInput
            value={row.time}
            placeholder="7:00 AM"
            aria-label="Time"
            className="!w-28 shrink-0"
            onChange={(e) => update(i, { time: e.target.value })}
          />
          <TextInput
            value={row.activity}
            placeholder="Morning walk"
            aria-label="Activity"
            onChange={(e) => update(i, { activity: e.target.value })}
          />
          <button
            type="button"
            aria-label="Remove"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="w-8 h-8 shrink-0 rounded-full text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.05] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { time: "", activity: "" }])}
        className="inline-flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-white"
      >
        <Plus className="w-3.5 h-3.5" />
        Add to routine
      </button>
    </div>
  );
}

/** Add or edit a parent with the child's onboarding questions. */
export function ParentFormModal({
  open,
  parent,
  onClose,
  onSaved,
  onDeleteRequest,
}: {
  open: boolean;
  /** Edit this parent; add a new one when null. */
  parent: ParentItem | null;
  onClose: () => void;
  onSaved: (parent: any, isNew: boolean) => void;
  onDeleteRequest?: (parent: ParentItem) => void;
}) {
  const isEdit = Boolean(parent);
  const [form, setForm] = useState<OnboardingInput>(EMPTY_ONBOARDING);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(parent ? readOnboarding(parent) : EMPTY_ONBOARDING);
  }, [open, parent]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const valid = validateOnboarding(form);
    if (!valid.ok) return setError(valid.error);

    setSaving(true);
    setError("");
    try {
      const res = isEdit
        ? await fetch(`/api/parents/${parent!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profile: form }),
          })
        : await fetch("/api/parents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      onSaved(data.parent, !isEdit);
      onClose();
    } catch (err: any) {
      setError(err.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const startsFresh = !parent || !(Number(parent.number_of_calls) > 1);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={600}
      title={isEdit ? `Edit ${parent?.parent_name}` : "Add a parent"}
      description={
        isEdit
          ? startsFresh
            ? "Changes apply from the next call, and Anyash's starting notes are rewritten from these answers."
            : "Changes apply from the next call. Anyash's memory from past calls is kept."
          : "Anyash starts the first call knowing these details, and confirms them gently with the parent."
      }
      footer={
        <>
          {isEdit && onDeleteRequest && (
            <Button type="button" variant="danger" className="mr-auto -ml-3" onClick={() => onDeleteRequest(parent!)}>
              Remove
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={() => submit()} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add parent"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4 pb-2">
        <OnboardingForm
          idPrefix="pf"
          value={form}
          onChange={setForm}
          extra={
            <FieldLabel label="Other routine (optional)">
              <RoutineEditor
                rows={form.other_routines || []}
                onChange={(rows) => setForm({ ...form, other_routines: rows })}
              />
            </FieldLabel>
          }
        />
        <FormError>{error}</FormError>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
