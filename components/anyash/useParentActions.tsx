"use client";

import React, { useCallback, useState } from "react";
import { ParentItem } from "./ParentsListColumn";
import { ParentFormModal } from "./ParentFormModal";
import { CallModal } from "./CallModal";
import { Modal, Button, Toast, ToastMessage } from "./primitives";

/**
 * Call, add, edit and remove flows shared by every page, with their pop-ups
 * and toast. Render `actions.ui` once in the page.
 */
export function useParentActions({
  onChanged,
  onAdded,
  onDeleted,
}: {
  onChanged: () => void;
  onAdded?: (parent: ParentItem) => void;
  onDeleted?: (parentId: string) => void;
}) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ParentItem | null>(null);
  const [calling, setCalling] = useState<ParentItem | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [deleting, setDeleting] = useState<ParentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const closeToast = useCallback(() => setToast(null), []);

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
      // The review lands after the call ends; refresh a couple of times.
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

      <Toast toast={toast} onClose={closeToast} />
    </>
  );

  return { openAdd, openEdit, openCall, askDelete, isCalling, callingId: calling?.id || null, ui };
}
