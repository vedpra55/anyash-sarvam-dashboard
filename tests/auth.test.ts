import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSessionToken,
  getDashboardPasscode,
  isPublicPath,
  verifyPasscode,
  verifySessionToken,
} from "../lib/auth";

test("passcode verification: validates 5-character passcode", () => {
  const currentPasscode = getDashboardPasscode();
  assert.equal(currentPasscode.length, 5, "Configured passcode must be 5 characters");

  // Exact and case-insensitive match
  assert.equal(verifyPasscode(currentPasscode), true);
  assert.equal(verifyPasscode(currentPasscode.toUpperCase()), true);
  assert.equal(verifyPasscode(`  ${currentPasscode}  `), true);

  // Wrong passcode
  assert.equal(verifyPasscode("wrong"), false);
  assert.equal(verifyPasscode("123456"), false); // 6 chars
  assert.equal(verifyPasscode("1234"), false); // 4 chars
  assert.equal(verifyPasscode(""), false);
  assert.equal(verifyPasscode(null), false);
  assert.equal(verifyPasscode(undefined), false);
  assert.equal(verifyPasscode(12345), false);
});

test("session token: creates and verifies valid HMAC tokens", async () => {
  const token = await createSessionToken(3600);
  assert.ok(token.includes("."), "Token must contain a dot separator");

  const valid = await verifySessionToken(token);
  assert.equal(valid, true, "Fresh token must be valid");
});

test("session token: rejects tampered and malformed tokens", async () => {
  const token = await createSessionToken(3600);
  const [expiresAt, sig] = token.split(".");

  // Tampered timestamp
  const tamperedTime = `${Number(expiresAt) + 1}.${sig}`;
  assert.equal(await verifySessionToken(tamperedTime), false);

  // Tampered signature
  const tamperedSig = `${expiresAt}.${sig.slice(0, -1)}x`;
  assert.equal(await verifySessionToken(tamperedSig), false);

  // Malformed tokens
  assert.equal(await verifySessionToken(""), false);
  assert.equal(await verifySessionToken("garbage-no-dot"), false);
  assert.equal(await verifySessionToken(null), false);
  assert.equal(await verifySessionToken(undefined), false);
  assert.equal(await verifySessionToken("."), false);
});

test("session token: rejects expired tokens", async () => {
  // Negative TTL to simulate already expired token
  const expiredToken = await createSessionToken(-10);
  const valid = await verifySessionToken(expiredToken);
  assert.equal(valid, false, "Expired token must be rejected");
});

test("route classification: distinguishes public from private paths", () => {
  // Public UI
  assert.equal(isPublicPath("/login"), true);
  assert.equal(isPublicPath("/login/"), true);
  assert.equal(isPublicPath("/onboard"), true);
  assert.equal(isPublicPath("/onboard/"), true);
  assert.equal(isPublicPath("/onboard/my-token-123"), true);

  // Public APIs
  assert.equal(isPublicPath("/api/auth/verify"), true);
  assert.equal(isPublicPath("/api/auth/logout"), true);
  assert.equal(isPublicPath("/api/auth/session"), true);
  assert.equal(isPublicPath("/api/webhooks/sarvam"), true);
  assert.equal(isPublicPath("/api/onboarding/my-token-123"), true);

  // Private routes (MUST BE BLOCKED)
  assert.equal(isPublicPath("/"), false);
  assert.equal(isPublicPath("/parents"), false);
  assert.equal(isPublicPath("/calls"), false);
  assert.equal(isPublicPath("/insights"), false);
  assert.equal(isPublicPath("/evals"), false);
  assert.equal(isPublicPath("/memory/parent-123"), false);

  // Private APIs (MUST BE BLOCKED)
  assert.equal(isPublicPath("/api/calls/outbound"), false);
  assert.equal(isPublicPath("/api/parents"), false);
  assert.equal(isPublicPath("/api/settings"), false);
  assert.equal(isPublicPath("/api/evals/runs"), false);
  assert.equal(isPublicPath("/api/memory/parent-123"), false);
  assert.equal(isPublicPath("/api/analytics"), false);

  // Critical security check: onboarding links creation is private!
  assert.equal(isPublicPath("/api/onboarding/links"), false);
});
