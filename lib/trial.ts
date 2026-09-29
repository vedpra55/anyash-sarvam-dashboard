/**
 * The trial window and the test-call rule, shared by every screen so all
 * numbers agree.
 *
 * The trial starts at 25 Sep 2026 00:00 IST (= 24 Sep 18:30 UTC). Anything
 * earlier was setup and testing.
 */

export const TRIAL_START_ISO = "2026-09-24T18:30:00.000Z";
export const TRIAL_START_MS = Date.parse(TRIAL_START_ISO);

/** Placeholder numbers used while building the product. */
const DUMMY_NUMBERS = ["9876543210", "1234567890"];

export type TestReason =
  | "before_trial"
  | "playground"
  | "debug"
  | "inbound"
  | "dummy_number"
  | "test_name"
  | "test_outcome"
  | "unknown_number";

export const TEST_REASON_LABEL: Record<TestReason, string> = {
  before_trial: "Before the trial started",
  playground: "Web / playground session",
  debug: "Marked as a debug call in Sarvam",
  inbound: "Not an outbound check-in call",
  dummy_number: "Placeholder test number",
  test_name: "Parent named “Test”",
  test_outcome: "Agent classified it as a test call",
  unknown_number: "Number doesn't belong to any parent",
};

export function last10(phone?: string | null): string {
  return (phone || "").replace(/\D/g, "").slice(-10);
}

/**
 * Sarvam returns timestamps without a timezone; they are UTC. Returns epoch ms
 * or NaN.
 */
export function parseSarvamTime(value?: string | null): number {
  if (!value) return NaN;
  const v = value.trim();
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(v);
  return Date.parse(hasZone ? v : `${v}Z`);
}

export function attemptTime(item: any): number {
  return parseSarvamTime(item?.attempted_at || item?.start_datetime);
}

/**
 * Why a Sarvam attempt is not a real trial call, or null if it is one.
 * `parentNumbers` holds the last 10 digits of every parent's phone; pass it to
 * also exclude calls to numbers that don't belong to a parent.
 */
export function testReason(item: any, parentNumbers?: Set<string>): TestReason | null {
  const t = attemptTime(item);
  if (!isNaN(t) && t < TRIAL_START_MS) return "before_trial";

  const contact = String(item?.user_contact || item?.user_contact_masked || "");
  if (contact.includes("@")) return "playground";
  if (Number(item?.is_debug_call) === 1) return "debug";
  if (item?.channel_direction && item.channel_direction !== "outbound") return "inbound";

  const digits = last10(contact);
  if (DUMMY_NUMBERS.includes(digits)) return "dummy_number";

  const vars = item?.agent_variables || {};
  if (String(vars.parent_name || "").trim().toLowerCase() === "test") return "test_name";
  if (vars.call_outcome === "test_call") return "test_outcome";

  if (parentNumbers && digits && !parentNumbers.has(digits)) return "unknown_number";
  return null;
}

export function isRealTrialCall(item: any, parentNumbers?: Set<string>): boolean {
  return testReason(item, parentNumbers) === null;
}
