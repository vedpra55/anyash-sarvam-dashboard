"use client";

import React, { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import { ParentItem } from "./ParentsListColumn";
import { LANGUAGES, RELATIONSHIPS } from "@/lib/languages";
import {
  Modal,
  Button,
  FieldLabel,
  TextInput,
  SelectInput,
  FormError,
} from "./primitives";

interface RoutineRow {
  time: string;
  activity: string;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v : v?.name ? `${v.name}${v.dosage ? ` ${v.dosage}` : ""}` : ""))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** An editable list of short text items. */
function ListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <TextInput
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            type="button"
            aria-label="Remove"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="w-8 h-8 shrink-0 rounded-full text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.05] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="inline-flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-white"
      >
        <Plus className="w-3.5 h-3.5" />
        {addLabel}
      </button>
    </div>
  );
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[13px] font-medium text-zinc-500 pt-2">{children}</h3>;
}

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
  const [name, setName] = useState("");
  const [honorific, setHonorific] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [childName, setChildName] = useState("");
  const [relationship, setRelationship] = useState("Daughter");
  const [conditions, setConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setName(parent?.parent_name || "");
    setHonorific(parent?.honorific || "");
    setPhone(parent?.phone_number || "+91 ");
    setLanguage(parent?.facts?.language || "Hindi");
    setChildName(parent?.child_name || parent?.facts?.family_member || "");
    setRelationship(parent?.facts?.relationship || "Daughter");
    setConditions(toStringList(parent?.medical_baseline?.conditions));
    setMedications(toStringList(parent?.medical_baseline?.medications));
    setRoutines(
      (parent?.routines || [])
        .map((r: any) => ({
          time: r.time && r.time !== "Daily Routine" ? String(r.time) : "",
          activity: String(r.activity || ""),
        }))
        .filter((r: RoutineRow) => r.activity)
    );
  }, [open, parent]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanPhone = phone.replace(/[^\d+]/g, "");
    if (!name.trim()) return setError("Add the parent's name.");
    if (cleanPhone.replace(/\D/g, "").length < 10) return setError("Add a full phone number, e.g. +91 98765 43210.");

    const cleanConditions = conditions.map((s) => s.trim()).filter(Boolean);
    const cleanMedications = medications.map((s) => s.trim()).filter(Boolean);
    const cleanRoutines = routines
      .map((r) => ({ time: r.time.trim(), activity: r.activity.trim() }))
      .filter((r) => r.activity);

    setSaving(true);
    setError("");
    try {
      const res = isEdit
        ? await fetch(`/api/parents/${parent!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parent_name: name.trim(),
              honorific: honorific.trim() || undefined,
              phone_number: cleanPhone,
              child_name: childName.trim() || undefined,
              facts: {
                ...(parent!.facts || {}),
                relationship,
                language,
                family_member: childName.trim() || parent!.facts?.family_member,
              },
              routines: cleanRoutines,
              medical_baseline: {
                ...(parent!.medical_baseline || {}),
                conditions: cleanConditions,
                medications: cleanMedications,
              },
            }),
          })
        : await fetch("/api/parents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parent_name: name.trim(),
              honorific: honorific.trim() || undefined,
              phone_number: cleanPhone,
              preferred_language: language,
              child_name: childName.trim() || undefined,
              relationship,
              routines: cleanRoutines,
              conditions: cleanConditions,
              medications: cleanMedications,
            }),
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      title={isEdit ? `Edit ${parent?.parent_name}` : "Add a parent"}
      description={
        isEdit
          ? "Changes apply from the next call."
          : "Anya will use these details to call and check in every day."
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
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldLabel label="Name" htmlFor="pf-name">
            <TextInput id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunita Sharma" autoFocus={!isEdit} />
          </FieldLabel>
          <FieldLabel label="Anya calls them" htmlFor="pf-honorific">
            <TextInput id="pf-honorific" value={honorific} onChange={(e) => setHonorific(e.target.value)} placeholder="Mummy Ji" />
          </FieldLabel>
          <FieldLabel label="Phone number" htmlFor="pf-phone">
            <TextInput id="pf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" />
          </FieldLabel>
          <FieldLabel label="Language" htmlFor="pf-lang">
            <SelectInput id="pf-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </SelectInput>
          </FieldLabel>
          <FieldLabel label="Your name" htmlFor="pf-child">
            <TextInput id="pf-child" value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Priya" />
          </FieldLabel>
          <FieldLabel label="You are their" htmlFor="pf-rel">
            <SelectInput id="pf-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
              {Array.from(new Set([...RELATIONSHIPS, relationship])).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </SelectInput>
          </FieldLabel>
        </div>

        <SectionTitle>Health</SectionTitle>
        <FieldLabel label="Conditions">
          <ListEditor items={conditions} onChange={setConditions} placeholder="High blood pressure" addLabel="Add condition" />
        </FieldLabel>
        <FieldLabel label="Medicines">
          <ListEditor items={medications} onChange={setMedications} placeholder="Amlodipine 5 mg, morning" addLabel="Add medicine" />
        </FieldLabel>

        <SectionTitle>Daily routine</SectionTitle>
        <RoutineEditor rows={routines} onChange={setRoutines} />

        <FormError>{error}</FormError>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
