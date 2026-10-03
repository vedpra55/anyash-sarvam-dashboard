/**
 * Server-side save of a child's onboarding profile, shared by the dashboard
 * (add / edit parent) and the public /onboard/[token] page.
 */
import { createHash, randomBytes } from "crypto";
import { getServiceSupabase } from "./supabase";
import { linkStatus, OnboardingLink } from "./onboardingLinks";
import {
  buildProfileRow,
  buildStartingContext,
  onboardingFacts,
  planFactSync,
  shouldWriteStartingContext,
  OnboardingInput,
} from "./onboarding";

const PROFILE_FIELDS = "id, number_of_calls, facts, routines, medical_baseline, phone_number";

export class ProfileSaveError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

type SaveMode =
  /** Dashboard "Add": a phone already on file updates that parent. */
  | { kind: "create" }
  /** Dashboard "Edit". */
  | { kind: "update"; parentId: string }
  /** Public onboarding link: never touches an existing parent. */
  | { kind: "public" };

const last10 = (phone: string) => phone.replace(/\D/g, "").slice(-10);

async function findByPhone(phone: string) {
  const { data, error } = await getServiceSupabase()
    .from("parent_profiles")
    .select(PROFILE_FIELDS)
    .ilike("phone_number", `%${last10(phone)}`)
    .limit(2);
  if (error) throw new ProfileSaveError(error.message, 500);
  return data?.[0] || null;
}

/**
 * Writes the profile. The starting memory is (re)written only while the parent
 * has had no real call, so a memory built from calls is never replaced.
 */
export async function saveOnboardingProfile(input: OnboardingInput, mode: SaveMode) {
  const supabase = getServiceSupabase();

  let existing: any = null;
  if (mode.kind === "update") {
    const { data, error } = await supabase.from("parent_profiles").select(PROFILE_FIELDS).eq("id", mode.parentId).maybeSingle();
    if (error) throw new ProfileSaveError(error.message, 500);
    if (!data) throw new ProfileSaveError("Parent not found.", 404);
    existing = data;
    const other = await findByPhone(input.phone_number);
    if (other && other.id !== existing.id) {
      throw new ProfileSaveError("Another parent already has this phone number.", 409);
    }
  } else {
    existing = await findByPhone(input.phone_number);
    if (existing && mode.kind === "public") {
      throw new ProfileSaveError(
        "This phone number is already set up with Anyash. If something needs changing, let the person who sent you this link know.",
        409,
      );
    }
  }

  const row = buildProfileRow(input, existing);
  const payload: Record<string, unknown> = { ...row, updated_at: new Date().toISOString() };
  if (shouldWriteStartingContext(existing)) {
    payload.current_user_context = buildStartingContext(input);
  }

  if (existing) {
    const { data, error } = await supabase.from("parent_profiles").update(payload).eq("id", existing.id).select().single();
    if (error) throw new ProfileSaveError(error.message, 500);
    await syncProfileFacts(data.id, input);
    return { parent: data, created: false };
  }

  const { data, error } = await supabase
    .from("parent_profiles")
    .insert({ ...payload, number_of_calls: 1 })
    .select()
    .single();
  if (error) throw new ProfileSaveError(error.message, 500);
  await syncProfileFacts(data.id, input);
  return { parent: data, created: true };
}

/**
 * Mirrors the form into the living profile (profile_facts) as the family's
 * unconfirmed facts. A failure here is logged, not raised: the profile itself
 * is saved, and the next save syncs again.
 */
async function syncProfileFacts(parentId: string, input: OnboardingInput) {
  const supabase = getServiceSupabase();
  try {
    const { data: current, error } = await supabase
      .from("profile_facts")
      .select("id, block, key, value, source")
      .eq("parent_id", parentId)
      .is("valid_to", null);
    if (error) throw error;
    const plan = planFactSync(onboardingFacts(input), current || []);
    const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10); // India date
    if (plan.close.length) {
      const { error: closeErr } = await supabase.from("profile_facts").update({ valid_to: today }).in("id", plan.close);
      if (closeErr) throw closeErr;
    }
    if (plan.insert.length) {
      const { error: insertErr } = await supabase.from("profile_facts").insert(
        plan.insert.map((f) => ({ parent_id: parentId, ...f, source: "child", confirmed: false, valid_from: today })),
      );
      if (insertErr) throw insertErr;
    }
  } catch (err: any) {
    console.error(`profile_facts sync failed for ${parentId}:`, err?.message || err);
  }
}

/* ------------------------------------------------------------------ */
/* Onboarding links                                                    */
/* ------------------------------------------------------------------ */

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Looks like a token we issued (base64url, 32 bytes). */
export const isWellFormedToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

export async function createOnboardingToken({
  label = null,
  days = 14,
}: { label?: string | null; days?: number } = {}): Promise<{ id: string; token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await getServiceSupabase()
    .from("onboarding_tokens")
    .insert({
      token_hash: hashToken(token),
      label,
      expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
    })
    .select("id, expires_at")
    .single();
  if (error) throw new ProfileSaveError(error.message, 500);
  return { id: data.id, token, expiresAt: data.expires_at };
}

export type TokenState = "valid" | "used" | "expired" | "revoked" | "unknown";

/** Whether the link can still be used, and the friend's name to greet them by. */
export async function getTokenState(token: string): Promise<{ state: TokenState; label: string | null }> {
  if (!isWellFormedToken(token)) return { state: "unknown", label: null };
  const { data } = await getServiceSupabase()
    .from("onboarding_tokens")
    .select("used_at, expires_at, revoked_at, label")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data) return { state: "unknown", label: null };
  const label = data.label || null;
  if (data.used_at) return { state: "used", label };
  if (data.revoked_at) return { state: "revoked", label };
  if (new Date(data.expires_at).getTime() < Date.now()) return { state: "expired", label };
  return { state: "valid", label };
}

/** Marks the token used; only one caller can win. Returns the token row id. */
export async function claimToken(token: string): Promise<string | null> {
  if (!isWellFormedToken(token)) return null;
  const { data } = await getServiceSupabase()
    .from("onboarding_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hashToken(token))
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  return data?.id || null;
}

export async function finishToken(tokenId: string, parentId: string) {
  await getServiceSupabase().from("onboarding_tokens").update({ parent_id: parentId }).eq("id", tokenId);
}

/** Gives the link back when saving failed, so the child can fix and resend. */
export async function releaseToken(tokenId: string) {
  await getServiceSupabase().from("onboarding_tokens").update({ used_at: null }).eq("id", tokenId);
}

/** The most recent invite links, newest first, with the parent each one added. */
export async function listOnboardingLinks(limit = 50): Promise<OnboardingLink[]> {
  const { data, error } = await getServiceSupabase()
    .from("onboarding_tokens")
    .select("id, label, created_at, expires_at, used_at, revoked_at, parent_id, parent:parent_profiles(parent_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new ProfileSaveError(error.message, 500);
  const now = new Date();
  return (data || []).map(({ parent, ...row }: any) => {
    const p = Array.isArray(parent) ? parent[0] : parent;
    const link = { ...row, parent_name: p?.parent_name || null };
    return { ...link, status: linkStatus(link, now) };
  });
}

/** Turns off a link that hasn't been filled. Returns false when there was nothing to turn off. */
export async function revokeOnboardingLink(id: string): Promise<boolean> {
  const { data, error } = await getServiceSupabase()
    .from("onboarding_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("used_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new ProfileSaveError(error.message, 500);
  return Boolean(data);
}
