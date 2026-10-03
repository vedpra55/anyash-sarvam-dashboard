"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { fetchJson, invalidateAll } from "@/lib/queries";
import {
  DEFAULT_LINK_DAYS,
  LINK_DAYS,
  LINK_STATUS_LABEL,
  LinkStatus,
  OnboardingLink,
  expiresIn,
  inviteMessage,
  whatsappShareUrl,
} from "@/lib/onboardingLinks";
import { Dot, formatRelative } from "./detail-ui";
import { Button, FieldLabel, FormError, Modal, Segmented, TextInput } from "./primitives";

const LINKS_KEY = ["onboarding-links"] as const;

const STATUS_TONE: Record<LinkStatus, "good" | "watch" | "neutral"> = {
  filled: "good",
  waiting: "watch",
  expired: "neutral",
  off: "neutral",
};

interface Created {
  id: string;
  url: string;
  label: string | null;
  expiresAt: string;
}

/** Copies text, returning false when the browser blocks the clipboard. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a single-use invite link for a friend, share it (WhatsApp, the phone's
 * share sheet or copy), and see which links were filled.
 */
export function InviteLinksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<string>(String(DEFAULT_LINK_DAYS));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const [canShare, setCanShare] = useState(false);

  const links = useQuery({
    queryKey: LINKS_KEY,
    queryFn: () => fetchJson<{ links: OnboardingLink[] }>("/api/onboarding/links").then((d) => d.links),
    enabled: open,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!open) return;
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    // Friends may have filled links since the list was last loaded.
    invalidateAll(queryClient);
  }, [open, queryClient]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const reset = () => {
    setCreated(null);
    setLabel("");
    setDays(String(DEFAULT_LINK_DAYS));
    setError("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const create = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const data = await fetchJson<Created>("/api/onboarding/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, days: Number(days) }),
      });
      setCreated(data);
      queryClient.invalidateQueries({ queryKey: LINKS_KEY });
    } catch (err: any) {
      setError(err.message || "Couldn't create the link.");
    } finally {
      setCreating(false);
    }
  };

  const message = created ? inviteMessage(created.url, created.label) : "";

  const share = async () => {
    if (!created) return;
    try {
      await navigator.share({ title: "Add your parent to Anyash", text: message });
    } catch {
      // Closed the share sheet: nothing to do.
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      width={540}
      title="Invite a friend"
      description="Make a private link for one friend. They open it on their phone and add their parent's details. Each link works once."
      footer={<Button variant="ghost" onClick={close}>Done</Button>}
    >
      <div className="space-y-8 pb-2">
        {!created ? (
          <form onSubmit={create} className="space-y-4">
            <FieldLabel label="Friend's first name (optional)" htmlFor="invite-label" hint="The form greets them by name and fills it in for them.">
              <TextInput
                id="invite-label"
                value={label}
                maxLength={40}
                placeholder="e.g. Rahul"
                autoComplete="off"
                onChange={(e) => setLabel(e.target.value)}
              />
            </FieldLabel>
            <div>
              <p className="block text-[13px] text-zinc-300 mb-1.5">Link works for</p>
              <Segmented
                options={LINK_DAYS.map((d) => ({ id: String(d), label: `${d} days` }))}
                value={days}
                onChange={setDays}
              />
            </div>
            <FormError>{error}</FormError>
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? "Creating…" : "Create link"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.07] p-4">
              <p className="text-[13px] text-zinc-400">
                Link {created.label ? <>for <span className="text-white">{created.label}</span></> : "ready"} · works once ·
                expires {expiresIn(created.expiresAt)}
              </p>
              <TextInput
                readOnly
                value={created.url}
                aria-label="Invite link"
                onFocus={(e) => e.currentTarget.select()}
                className="mt-3 !text-[13px] font-mono"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={whatsappShareUrl(message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[#25D366] hover:bg-[#2ee072] text-black text-[13px] font-medium transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
                {canShare && (
                  <Button onClick={share} icon={<Share2 className="w-4 h-4" />}>
                    Share
                  </Button>
                )}
                <Button
                  onClick={async () => setCopied((await copyText(created.url)) ? "link" : null)}
                  icon={copied === "link" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                >
                  {copied === "link" ? "Copied" : "Copy link"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => setCopied((await copyText(message)) ? "message" : null)}
                  icon={copied === "message" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                >
                  {copied === "message" ? "Copied" : "Copy with message"}
                </Button>
              </div>
            </div>
            <details className="group">
              <summary className="cursor-pointer text-[12.5px] text-zinc-500 hover:text-zinc-300 select-none">
                See the message your friend gets
              </summary>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white/[0.03] p-3 text-[13px] leading-6 text-zinc-300 break-words">{message}</p>
            </details>
            <Button size="sm" variant="secondary" onClick={reset}>
              Make another link
            </Button>
          </div>
        )}

        <LinksList
          links={links.data || []}
          loading={links.isLoading}
          error={links.error ? (links.error as Error).message : ""}
          highlightId={created?.id}
          onChanged={() => queryClient.invalidateQueries({ queryKey: LINKS_KEY })}
        />
      </div>
    </Modal>
  );
}

function LinksList({
  links,
  loading,
  error,
  highlightId,
  onChanged,
}: {
  links: OnboardingLink[];
  loading: boolean;
  error: string;
  highlightId?: string;
  onChanged: () => void;
}) {
  const filled = links.filter((l) => l.status === "filled").length;
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 border-t border-ay-line pt-5">
        <h3 className="text-[13px] font-medium text-zinc-300">Your links</h3>
        {links.length > 0 && (
          <span className="text-[12px] text-zinc-600 tabular-nums">
            {filled} of {links.length} filled
          </span>
        )}
      </div>
      {loading ? (
        <p className="mt-3 text-[13px] text-zinc-600">Loading…</p>
      ) : error ? (
        <p className="mt-3 text-[13px] text-rose-300">{error}</p>
      ) : links.length === 0 ? (
        <p className="mt-3 text-[13px] text-zinc-500 leading-5">No links yet. Links you make show up here, with who filled them.</p>
      ) : (
        <ul className="mt-2 divide-y divide-white/[0.04]">
          {links.map((link) => (
            <LinkRow key={link.id} link={link} highlight={link.id === highlightId} onChanged={onChanged} />
          ))}
        </ul>
      )}
      {links.length > 0 && (
        <p className="mt-3 text-[12px] text-zinc-600 leading-5">
          For privacy, a link is shown only once. Lost one? Turn it off and make a new one.
        </p>
      )}
    </section>
  );
}

function LinkRow({ link, highlight, onChanged }: { link: OnboardingLink; highlight: boolean; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  const turnOff = async () => {
    if (!confirming) return setConfirming(true);
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/onboarding/links/${link.id}`, { method: "DELETE" });
      onChanged();
    } catch (err: any) {
      setError(err.message || "Couldn't turn it off.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const detail =
    link.status === "filled"
      ? link.parent_name
        ? `Added ${link.parent_name} · ${formatRelative(link.used_at)}`
        : `Filled ${formatRelative(link.used_at)}`
      : link.status === "waiting"
        ? `Made ${formatRelative(link.created_at)} · expires ${expiresIn(link.expires_at)}`
        : `Made ${formatRelative(link.created_at)}`;

  return (
    <li className={`py-3 flex items-center gap-3 ${highlight ? "-mx-2 px-2 rounded-lg bg-white/[0.03]" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] text-zinc-100 truncate">{link.label || "Unnamed link"}</p>
        <p className="text-[12px] text-zinc-500 truncate">{detail}</p>
        {error && <p className="text-[12px] text-rose-300">{error}</p>}
      </div>
      <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 shrink-0">
        <Dot tone={STATUS_TONE[link.status]} />
        {LINK_STATUS_LABEL[link.status]}
      </span>
      {link.status === "waiting" && (
        <Button size="sm" variant={confirming ? "danger" : "ghost"} onClick={turnOff} disabled={busy} className="shrink-0">
          {busy ? "…" : confirming ? "Confirm" : "Turn off"}
        </Button>
      )}
    </li>
  );
}
