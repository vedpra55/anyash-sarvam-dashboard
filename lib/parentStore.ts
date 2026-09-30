/**
 * Server-side save of a child's onboarding profile, shared by the dashboard
 * (add / edit parent) and the public /onboard/[token] page.
 */
import { createHash, randomBytes } from "crypto";
import { getServiceSupabase } from "./supabase";
import {
  buildProfileRow,
  buildStartingContext,
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
        "This phone number is already registered with Anyash. Please ask the Anyash team to update the details.",
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
    return { parent: data, created: false };
  }

  const { data, error } = await supabase
    .from("parent_profiles")
    .insert({ ...payload, number_of_calls: 1 })
    .select()
    .single();
  if (error) throw new ProfileSaveError(error.message, 500);
  return { parent: data, created: true };
}

/* ------------------------------------------------------------------ */
/* Onboarding links                                                    */
/* ------------------------------------------------------------------ */

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Looks like a token we issued (base64url, 32 bytes). */
export const isWellFormedToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

export async function createOnboardingToken(): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await getServiceSupabase()
    .from("onboarding_tokens")
    .insert({ token_hash: hashToken(token) })
    .select("expires_at")
    .single();
  if (error) throw new ProfileSaveError(error.message, 500);
  return { token, expiresAt: data.expires_at };
}

export type TokenState = "valid" | "used" | "expired" | "unknown";

export async function getTokenState(token: string): Promise<TokenState> {
  if (!isWellFormedToken(token)) return "unknown";
  const { data } = await getServiceSupabase()
    .from("onboarding_tokens")
    .select("used_at, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data) return "unknown";
  if (data.used_at) return "used";
  if (new Date(data.expires_at).getTime() < Date.now()) return "expired";
  return "valid";
}

/** Marks the token used; only one caller can win. Returns the token row id. */
export async function claimToken(token: string): Promise<string | null> {
  if (!isWellFormedToken(token)) return null;
  const { data } = await getServiceSupabase()
    .from("onboarding_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hashToken(token))
    .is("used_at", null)
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
