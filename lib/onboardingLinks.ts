/**
 * Invite links a family member shares with a friend, who fills in their own
 * parent's details on /onboard/[token]. Each link works once.
 * Pure helpers, shared by the dashboard, the API and the public page.
 */

export type LinkStatus = "waiting" | "filled" | "expired" | "off";

export interface OnboardingLinkRow {
  id: string;
  label: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  parent_id: string | null;
  parent_name?: string | null;
}

export interface OnboardingLink extends OnboardingLinkRow {
  status: LinkStatus;
}

/** How long a new link can stay open, in days. */
export const LINK_DAYS = [7, 14, 30] as const;
export const DEFAULT_LINK_DAYS = 14;

export const LINK_STATUS_LABEL: Record<LinkStatus, string> = {
  waiting: "Waiting",
  filled: "Filled",
  expired: "Expired",
  off: "Turned off",
};

/**
 * Where a link stands. A filled link stays "Filled" even after it expires or is
 * turned off, because the parent was added.
 */
export function linkStatus(
  row: Pick<OnboardingLinkRow, "used_at" | "revoked_at" | "expires_at" | "parent_id">,
  now = new Date(),
): LinkStatus {
  if (row.used_at && row.parent_id) return "filled";
  if (row.revoked_at) return "off";
  if (new Date(row.expires_at).getTime() < now.getTime()) return "expired";
  // used_at without a parent: a save is in progress, or failed and was released.
  return row.used_at ? "filled" : "waiting";
}

/** A friend's first name for the link: trimmed, single-spaced, at most 40 characters. */
export function cleanLinkLabel(raw: unknown): string | null {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 40).trim();
  return s || null;
}

/** One of LINK_DAYS; anything else becomes the default. */
export function cleanLinkDays(raw: unknown): number {
  const n = Number(raw);
  return (LINK_DAYS as readonly number[]).includes(n) ? n : DEFAULT_LINK_DAYS;
}

/** The message sent with the link. Uses the friend's first name when there is one. */
export function inviteMessage(url: string, friendName?: string | null): string {
  const hi = friendName ? `Hi ${friendName.split(" ")[0]}!` : "Hi!";
  return [
    `${hi} I'm using Anyash. It gives our parents a friendly check-in call every day, in their own language.`,
    "",
    "I'd love for your mom or dad to have it too. Could you add their details here? It takes about 2 minutes.",
    "",
    url,
  ].join("\n");
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** "in 5 days", "tomorrow", "today" for a link's expiry. */
export function expiresIn(expiresAt: string, now = new Date()): string {
  const days = Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
