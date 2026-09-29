"use client";

import React, { useEffect, useState } from "react";
import { Minus, Plus, ChevronRight, Phone } from "lucide-react";
import { ParentItem } from "./ParentsListColumn";
import { SupportedLanguage } from "@/lib/types";
import { LANGUAGES, formatPhone } from "@/lib/languages";
import { Modal, Button, FieldLabel, TextInput, SelectInput, TextArea } from "./primitives";

interface CallModalProps {
  isOpen: boolean;
  parent: ParentItem | null;
  onClose: () => void;
  onDispatchCall: (payload: any) => Promise<void>;
  isCalling: boolean;
}

export function CallModal({ isOpen, parent, onClose, onDispatchCall, isCalling }: CallModalProps) {
  const [callNumber, setCallNumber] = useState(1);
  const [phone, setPhone] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [language, setLanguage] = useState<SupportedLanguage>("Hindi");
  const [context, setContext] = useState("");
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    if (!isOpen || !parent) return;
    const count =
      typeof parent.number_of_calls === "number" && parent.number_of_calls > 0
        ? parent.number_of_calls
        : parent.calls && parent.calls.length > 0
        ? parent.calls.length + 1
        : 1;
    setCallNumber(count);
    setPhone(parent.phone_number || "");
    setEditingPhone(false);
    setLanguage((parent.facts?.language as SupportedLanguage) || "Hindi");
    setContext(parent.current_user_context || "");
    setShowContext(false);
  }, [isOpen, parent]);

  if (!parent) return null;

  const updateCallNumber = (n: number) => {
    const valid = Math.max(1, n);
    setCallNumber(valid);
    // Keep "CALL COUNT: N" in the context in step with the number.
    setContext((prev) =>
      prev && /CALL COUNT:\s*\d+/i.test(prev) ? prev.replace(/CALL COUNT:\s*\d+/i, `CALL COUNT: ${valid}`) : prev
    );
  };

  const start = async () => {
    await onDispatchCall({
      profile: {
        id: parent.id,
        parentName: parent.parent_name,
        parentPhone: phone.replace(/\s+/g, ""),
        childName: parent.child_name || parent.facts?.family_member || "Family",
        honorific: parent.honorific || "Ji",
        preferredLanguage: language,
        number_of_calls: callNumber,
      },
      customLanguage: language,
      number_of_calls: callNumber,
      numberOfCalls: callNumber,
      user_context_override: context.trim(),
    });
  };

  const firstName = parent.parent_name.split(" ")[0];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      dismissable={!isCalling}
      title={`Call ${firstName}`}
      description={
        editingPhone ? (
          "Anya will call this number."
        ) : (
          <span>
            {formatPhone(phone)}
            <button onClick={() => setEditingPhone(true)} className="ml-2 text-zinc-300 hover:text-white" disabled={isCalling}>
              Change
            </button>
          </span>
        )
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isCalling}>
            Cancel
          </Button>
          <Button variant="primary" onClick={start} disabled={isCalling || !phone.trim()} icon={<Phone className="w-3.5 h-3.5 fill-black" />}>
            {isCalling ? "Calling…" : "Call now"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {editingPhone && (
          <FieldLabel label="Phone number" htmlFor="call-phone">
            <TextInput id="call-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoFocus />
          </FieldLabel>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
          <FieldLabel label="Language" htmlFor="call-lang">
            <SelectInput
              id="call-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              disabled={isCalling}
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label} · {l.nativeName}
                </option>
              ))}
            </SelectInput>
          </FieldLabel>
          <FieldLabel label="Call number">
            <div className="h-10 inline-flex items-center rounded-lg ring-1 ring-white/[0.08] bg-white/[0.04]">
              <button
                type="button"
                aria-label="Previous call number"
                onClick={() => updateCallNumber(callNumber - 1)}
                disabled={callNumber <= 1 || isCalling}
                className="w-9 h-full flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center text-[14px] text-white tabular-nums">{callNumber}</span>
              <button
                type="button"
                aria-label="Next call number"
                onClick={() => updateCallNumber(callNumber + 1)}
                disabled={isCalling}
                className="w-9 h-full flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </FieldLabel>
        </div>
        <p className="text-[12px] text-zinc-600 -mt-3">
          {callNumber <= 1 ? "First call: Anya will introduce herself." : "Follow-up call: Anya will pick up from her memory."}
        </p>

        <div>
          <button
            type="button"
            onClick={() => setShowContext(!showContext)}
            className="inline-flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-white"
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showContext ? "rotate-90" : ""}`} />
            What Anya knows going in
          </button>
          {showContext && (
            <div className="mt-3">
              <TextArea
                rows={9}
                maxLength={3000}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                disabled={isCalling}
                spellCheck={false}
                placeholder="Anything Anya should know or ask about on this call."
                className="font-mono text-[12px]"
              />
              <p className="text-[12px] text-zinc-600 mt-1.5">
                Edits here are saved to her memory for this parent when the call starts.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
