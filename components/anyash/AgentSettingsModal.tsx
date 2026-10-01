"use client";

import React, { useState, useEffect } from "react";
import { Modal, Button, FieldLabel, TextInput, FormError } from "./primitives";

interface AgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentSettingsModal({ isOpen, onClose }: AgentSettingsModalProps) {
  const [agentVersion, setAgentVersion] = useState("");
  const [source, setSource] = useState<string>("none");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg("");
    setSavedMsg("");
    setIsLoading(true);
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setAgentVersion(data.agent_version ? String(data.agent_version) : "");
        setSource(data.source || "none");
        if (data.error) setErrorMsg(data.error);
      })
      .catch(() => setErrorMsg("Failed to load settings"))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMsg("");
    setSavedMsg("");

    const version = Number(agentVersion);
    if (!Number.isInteger(version) || version < 1) {
      setErrorMsg("Agent version must be a whole number of 1 or more");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_version: version }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }
      setSource("dashboard");
      setSavedMsg(`Saved. New calls will use agent version ${version}.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save settings");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sourceLabel =
    source === "dashboard"
      ? "Saved from the dashboard."
      : source === "env"
      ? "From the SARVAM_APP_VERSION environment variable."
      : "Not set. Calls use version 12.";

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      width={420}
      title="Settings"
      description="Applies to every new call."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Close
          </Button>
          <Button variant="primary" onClick={() => save()} disabled={isSubmitting || isLoading}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-3">
        <FieldLabel
          label="Sarvam agent version"
          htmlFor="agent-version"
          hint={isLoading ? undefined : sourceLabel}
        >
          <TextInput
            id="agent-version"
            type="number"
            min={1}
            step={1}
            value={agentVersion}
            disabled={isLoading}
            onChange={(e) => setAgentVersion(e.target.value)}
            placeholder={isLoading ? "Loading…" : "e.g. 26"}
            className="!w-32 tabular-nums"
          />
        </FieldLabel>
        {savedMsg && <p className="text-[13px] text-emerald-300">{savedMsg}</p>}
        <FormError>{errorMsg}</FormError>
      </form>
    </Modal>
  );
}
