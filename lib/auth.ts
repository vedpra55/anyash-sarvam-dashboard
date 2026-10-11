/**
 * Authentication and session helpers for protecting private dashboard routes
 * with a 5-character passcode and tamper-proof HMAC session cookies.
 */

export const SESSION_COOKIE_NAME = "anyash_session";
export const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Returns the configured 5-character dashboard passcode.
 * Defaults to "anyas" if unset.
 */
export function getDashboardPasscode(): string {
  const code = (process.env.APP_PASSWORD || process.env.DASHBOARD_PASSCODE || "anyas").trim();
  return code || "anyas";
}

/**
 * Verifies whether the provided passcode matches the configured passcode.
 * Both candidate and configured code are compared case-insensitively and trimmed.
 */
export function verifyPasscode(candidate: unknown): boolean {
  if (typeof candidate !== "string") return false;
  const cleaned = candidate.trim();
  const configured = getDashboardPasscode();

  // Ensure candidate is non-empty and matches
  if (!cleaned || cleaned.length !== 5) return false;
  return cleaned.toLowerCase() === configured.toLowerCase();
}

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.SUPABASE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "anyash-auth-session-signing-secret-default"
  );
}

/**
 * Converts ArrayBuffer to lowercase hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Generates an HMAC-SHA256 signature using the Web Crypto API.
 */
async function signMessage(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bufferToHex(signature);
}

/**
 * Creates a signed session token: "<expiryTimestamp>.<hmacSignature>"
 */
export async function createSessionToken(ttlSeconds = DEFAULT_SESSION_MAX_AGE_SECONDS): Promise<string> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const message = String(expiresAt);
  const sig = await signMessage(message, getSessionSecret());
  return `${message}.${sig}`;
}

/**
 * Verifies if a given session token is valid and has not expired.
 */
export async function verifySessionToken(token?: string | null): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0) return false;

  const expiresAtStr = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!expiresAtStr || !signature) return false;

  const expiresAt = parseInt(expiresAtStr, 10);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  try {
    const expectedSig = await signMessage(expiresAtStr, getSessionSecret());
    if (signature.length !== expectedSig.length) return false;

    // Constant-time comparison
    let match = 0;
    for (let i = 0; i < signature.length; i++) {
      match |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    return match === 0;
  } catch (err) {
    console.error("Session verification error:", err);
    return false;
  }
}

/**
 * Checks whether a given request pathname is publicly accessible without authentication.
 *
 * Public routes include:
 * - /login (and any subpaths)
 * - /onboard (and child onboarding form /onboard/[token])
 * - /api/onboarding/[token] (public submission of onboarding form)
 *   NOTE: /api/onboarding/links is private (operator link creation)
 * - /api/webhooks/* (carrier webhooks e.g. Sarvam telephony)
 * - /api/auth/* (auth verification and logout APIs)
 */
export function isPublicPath(pathname: string): boolean {
  if (!pathname) return false;

  // Login page
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;

  // Onboarding UI for parents/children
  if (pathname === "/onboard" || pathname.startsWith("/onboard/")) return true;

  // Authentication endpoints
  if (pathname.startsWith("/api/auth/")) return true;

  // External telephony carrier webhooks
  if (pathname.startsWith("/api/webhooks/")) return true;

  // Public onboarding submission (token route only; links route remains private!)
  if (pathname.startsWith("/api/onboarding/") && !pathname.startsWith("/api/onboarding/links")) {
    return true;
  }

  return false;
}
