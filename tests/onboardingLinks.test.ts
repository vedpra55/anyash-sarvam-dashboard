import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanLinkDays,
  cleanLinkLabel,
  expiresIn,
  inviteMessage,
  linkStatus,
  whatsappShareUrl,
} from "../lib/onboardingLinks";
import { isValidIndianPhone, localIndianDigits, onboardingErrors, validateOnboarding } from "../lib/onboarding";

const NOW = new Date("2026-10-03T10:00:00Z");
const LATER = "2026-10-10T10:00:00Z";
const EARLIER = "2026-10-01T10:00:00Z";

test("link status: waiting, filled, expired, turned off", () => {
  const base = { used_at: null, revoked_at: null, parent_id: null, expires_at: LATER };
  assert.equal(linkStatus(base, NOW), "waiting");
  assert.equal(linkStatus({ ...base, expires_at: EARLIER }, NOW), "expired");
  assert.equal(linkStatus({ ...base, revoked_at: EARLIER }, NOW), "off");
  assert.equal(linkStatus({ ...base, used_at: EARLIER, parent_id: "p1" }, NOW), "filled");
  // Filled stays filled after it expires.
  assert.equal(linkStatus({ ...base, used_at: EARLIER, parent_id: "p1", expires_at: EARLIER }, NOW), "filled");
});

test("link label and days are cleaned", () => {
  assert.equal(cleanLinkLabel("  Rahul   Mehta "), "Rahul Mehta");
  assert.equal(cleanLinkLabel(""), null);
  assert.equal(cleanLinkLabel(undefined), null);
  assert.equal(cleanLinkLabel("x".repeat(80))?.length, 40);
  assert.equal(cleanLinkDays(7), 7);
  assert.equal(cleanLinkDays("30"), 30);
  assert.equal(cleanLinkDays(365), 14);
  assert.equal(cleanLinkDays("abc"), 14);
});

test("invite message greets by first name and carries the link", () => {
  const url = "https://example.com/onboard/abc";
  const msg = inviteMessage(url, "Rahul Mehta");
  assert.ok(msg.startsWith("Hi Rahul!"));
  assert.ok(msg.endsWith(url));
  assert.ok(inviteMessage(url).startsWith("Hi!"));
  assert.ok(whatsappShareUrl(msg).startsWith("https://wa.me/?text=Hi%20Rahul!"));
});

test("expiry reads in plain words", () => {
  assert.equal(expiresIn("2026-10-08T10:00:00Z", NOW), "in 5 days");
  assert.equal(expiresIn("2026-10-04T09:00:00Z", NOW), "tomorrow");
  assert.equal(expiresIn(EARLIER, NOW), "today");
});

test("phone: pasted numbers become 10 local digits", () => {
  assert.equal(localIndianDigits("+91 98765 43210"), "9876543210");
  assert.equal(localIndianDigits("098765 43210"), "9876543210");
  assert.equal(localIndianDigits("9876543210123"), "9876543210");
  assert.equal(localIndianDigits("98765"), "98765");
});

test("phone: +91 needs exactly 10 digits; landlines with STD code pass", () => {
  assert.equal(isValidIndianPhone("+919876543210"), true);
  assert.equal(isValidIndianPhone("+911123456789"), true);
  assert.equal(isValidIndianPhone("+91987654321"), false);
  assert.equal(isValidIndianPhone("+9198765432101"), false);
  assert.equal(isValidIndianPhone("+14155550123"), true);
});

test("field errors name each field, in the form's order", () => {
  const errors = onboardingErrors({ phone_number: "+91", wake_time: "late" });
  assert.deepEqual(Object.keys(errors), ["parent_name", "honorific", "language", "phone_number", "child_name", "wake_time"]);
  assert.match(errors.phone_number!, /add their phone/);
  assert.equal(onboardingErrors({ phone_number: "+91 98765 4321" }).phone_number?.includes("too short"), false);
  assert.match(onboardingErrors({ phone_number: "98765" }).phone_number!, /too short/);
  // The server reports the first problem.
  const r = validateOnboarding({ parent_name: "Sunita", honorific: "Mummy Ji", language: "Hindi", phone_number: "+91 98765", child_name: "Priya" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /too short/);
});

test("parent role: stored, read back, and named in the starting memory", async () => {
  const { buildProfileRow, buildStartingContext, readOnboarding } = await import("../lib/onboarding");
  const base = { parent_name: "Sunita Sharma", honorific: "Mummy", language: "Hindi", phone_number: "+919876543210", child_name: "Priya" };
  const v = validateOnboarding({ ...base, parent_role: "mother" });
  assert.ok(v.ok);
  if (!v.ok) return;
  assert.match(buildStartingContext(v.input), /^PERSON: Mummy \(Sunita Sharma\), Priya's mother/);
  const row = buildProfileRow(v.input);
  assert.deepEqual(row.facts.parent_role, { value: "mother", source: "child", confirmed: false });
  assert.equal(readOnboarding(row).parent_role, "mother");
  // Left out (dashboard, older profiles): no role in the memory, no error.
  const none = validateOnboarding(base);
  assert.ok(none.ok);
  if (none.ok) assert.match(buildStartingContext(none.input), /^PERSON: Mummy \(Sunita Sharma\)\n/);
  assert.equal(validateOnboarding({ ...base, parent_role: "uncle" as any }).ok, false);
});
