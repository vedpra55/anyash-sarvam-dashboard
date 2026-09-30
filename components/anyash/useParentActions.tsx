"use client";

import React, { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateAll } from "@/lib/queries";
import { ParentItem } from "./ParentsListColumn";
import { ParentFormModal } from "./ParentFormModal";
import { CallModal } from "./CallModal";
import { Modal, Button, Toast, ToastMessage, TextInput } from "./primitives";

/**
 * Call, add, edit and remove flows shared by every page, with their pop-ups
 * and toast. Render `actions.ui` once in the page.
 */
export function useParentActions({
  onAdded,
  onDeleted,
}: {
  onAdded?: (parent: ParentItem) => void;
  onDeleted?: (parentId: string) => void;
} = {}) {
  const queryClient = useQueryClient();
  const onChanged = useCallback(() => invalidateAll(queryClient), [queryClient]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ParentItem | null>(null);
  const [calling, setCalling] = useState<ParentItem | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [deleting, setDeleting] = useState<ParentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [linking, setLinking] = useState(false);
  const [shownLink, setShownLink] = useState<string | null>(null);

  const closeToast = useCallback(() => setToast(null), []);

  /** Creates a single-use onboarding link and copies it for the child. */
  const copyOnboardingLink = useCallback(async () => {
    setLinking(true);
    try {
      const res = await fetch("/api/onboarding/links", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't create the link.");
      try {
        await navigator.clipboard.writeText(data.url);
        setToast({ tone: "success", message: "Onboarding link copied. It works once and expires in 14 days." });
      } catch {
        setShownLink(data.url); // clipboard blocked: show it to copy by hand
      }
    } catch (err: any) {
      setToast({ tone: "error", message: err.message || "Couldn't create the link." });
    } finally {
      setLinking(false);
    }
  }, []);

  const openAdd = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((parent: ParentItem) => {
    setEditing(parent);
    setFormOpen(true);
  }, []);

  const openCall = useCallback((parent: ParentItem) => setCalling(parent), []);
  const askDelete = useCallback((parent: ParentItem) => {
    setFormOpen(false);
    setDeleting(parent);
  }, []);

  const dispatchCall = async (payload: any) => {
    const name = payload.profile?.parentName || "them";
    setIsCalling(true);
    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The call couldn't be placed.");
      setCalling(null);
      setToast({
        tone: data.mode === "simulation" ? "info" : "success",
        message:
          data.mode === "simulation"
            ? "Test mode: telephony isn't configured, so no real call was placed."
            : `Calling ${name} in ${payload.customLanguage}. The summary appears here a minute after the call ends.`,
      });
      // Show the new attempt right away; the review lands after the call ends.
      onChanged();
      setTimeout(onChanged, 20000);
      setTimeout(onChanged, 90000);
    } catch (err: any) {
      setToast({ tone: "error", message: err.message || "The call couldn't be placed." });
    } finally {
      setIsCalling(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/parents/${deleting.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't remove");
      setToast({ tone: "success", message: `${deleting.parent_name} was removed.` });
      onDeleted?.(deleting.id);
      setDeleting(null);
      onChanged();
    } catch (err: any) {
      setToast({ tone: "error", message: err.message || "Couldn't remove" });
    } finally {
      setIsDeleting(false);
    }
  };

  const ui = (
    <>
      <ParentFormModal
        open={formOpen}
        parent={editing}
        onClose={() => setFormOpen(false)}
        onDeleteRequest={askDelete}
        onSaved={(parent, isNew) => {
          setToast({ tone: "success", message: isNew ? `${parent?.parent_name || "Parent"} was added.` : "Changes saved." });
          if (isNew && parent) onAdded?.(parent);
          onChanged();
        }}
      />

      <CallModal
        isOpen={Boolean(calling)}
        parent={calling}
        onClose={() => setCalling(null)}
        onDispatchCall={dispatchCall}
        isCalling={isCalling}
      />

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        dismissable={!isDeleting}
        width={420}
        title={`Remove ${deleting?.parent_name}?`}
        description="This deletes their profile, daily logs, call reviews and Anya's memory of them. Call recordings stay in Sarvam. This can't be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button onClick={confirmDelete} disabled={isDeleting} className="!bg-rose-600 hover:!bg-rose-500 !text-white">
              {isDeleting ? "Removing…" : "Remove"}
            </Button>
          </>
        }
      />

      <Modal
        open={Boolean(shownLink)}
        onClose={() => setShownLink(null)}
        width={480}
        title="Onboarding link"
        description="Send this to the child. It works once and expires in 14 days."
        footer={<Button variant="primary" onClick={() => setShownLink(null)}>Done</Button>}
      >
        <TextInput readOnly value={shownLink || ""} onFocus={(e) => e.currentTarget.select()} aria-label="Onboarding link" />
      </Modal>

      <Toast toast={toast} onClose={closeToast} />
    </>
  );

  return {
    openAdd,
    openEdit,
    openCall,
    askDelete,
    copyOnboardingLink,
    isLinking: linking,
    isCalling,
    callingId: calling?.id || null,
    ui,
  };
}
