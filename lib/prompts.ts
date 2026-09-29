import { ParentProfile, SupportedLanguage } from "./types";

/**
 * Resolves the effective call count number with strict precedence:
 * 1. Explicit numberOfCalls argument passed to function (user override)
 * 2. profile.number_of_calls (from Supabase parent_profiles / modal)
 * 3. profile.numberOfCalls (camelCase alternative)
 * 4. Default: 1 (for brand new profiles)
 */
export function resolveCallCount(
  numberOfCalls?: number | string,
  profile?: Partial<ParentProfile> & { numberOfCalls?: number | string; number_of_calls?: number | string },
): number {
  if (numberOfCalls !== undefined && numberOfCalls !== null && numberOfCalls !== "") {
    const parsed = Number(numberOfCalls);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (profile?.number_of_calls !== undefined && profile.number_of_calls !== null && profile.number_of_calls !== "") {
    const parsed = Number(profile.number_of_calls);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (profile?.numberOfCalls !== undefined && profile.numberOfCalls !== null && profile.numberOfCalls !== "") {
    const parsed = Number(profile.numberOfCalls);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 1;
}

export function buildHealthCompanionPrompt(
  profile: ParentProfile,
  languageOverride?: SupportedLanguage,
  numberOfCalls?: number | string,
): string {
  const language = languageOverride || profile.preferredLanguage;
  const numCalls = resolveCallCount(numberOfCalls, profile);
  const isFirstCall = numCalls <= 1;

  const conditionsStr =
    profile.knownConditions.length > 0
      ? profile.knownConditions.join(", ")
      : "None reported";

  const medicationsStr =
    profile.medications.length > 0
      ? profile.medications
          .map(
            (m) =>
              `- ${m.name} (${m.dosage}, ${m.timing})${m.purpose ? ` for ${m.purpose}` : ""}`,
          )
          .join("\n")
      : "No daily medications recorded";

  const routinesStr =
    profile.routines.length > 0
      ? profile.routines.map((r) => `- ${r.time}: ${r.activity}`).join("\n")
      : "Standard daily routine";

  const followUpsStr =
    profile.activeFollowUps.length > 0
      ? profile.activeFollowUps.map((f) => `- ${f}`).join("\n")
      : "None";

  const callContextStr = isFirstCall
    ? `THIS IS THE FIRST CALL (number_of_calls = 1): Introduce yourself clearly, establish trust, explain that you are calling on behalf of ${profile.childName} to support their day-to-day wellness, and ask how they are feeling today.`
    : `THIS IS A FOLLOW-UP CHECK-IN CALL (number_of_calls = ${numCalls}): Greet them familiarly, check on how they are feeling today, and follow up naturally on their routine and vitals.`;

  return `You are Anya, a caring, warm, and respectful family health companion calling on behalf of ${profile.childName} to check in on ${profile.honorific} ${profile.parentName}.

CALL CONTEXT (number_of_calls = ${numCalls}):
${callContextStr}

PRIMARY PURPOSE:
Have a natural, unhurried 2-to-4 minute phone conversation to understand how ${profile.honorific} is feeling today, check on their daily routine and medications without sounding like a clinical survey, and make them feel supported and valued.

LANGUAGE & TONE:
- Primary Language: ${language} (Use natural conversational phrasing, polite honorifics like "Aap", "Ji", "Namaste/Pranam").
- Tone: Warm, empathetic, respectful, attentive, unhurried.
- Avoid clinical jargon, automated scripts, or interrogation-style question checklists.

PATIENT CONTEXT YOU ALREADY KNOW:
- Known Health Conditions: ${conditionsStr}
- Daily Medications:
${medicationsStr}
- Regular Routines:
${routinesStr}
- Open Follow-ups from Previous Calls:
${followUpsStr}

CONVERSATION FLOW:
1. WARM GREETING & DISCLOSURE:
   - Greet warmly with "${profile.honorific}".
   - Identify yourself clearly: "I am Anya, calling on behalf of ${profile.childName} to check in on how you are doing today."
2. OPEN-ENDED INQUIRY:
   - Ask how their day is going and subtly reference a familiar routine (e.g. "Did you manage to take your walk today?").
3. SUBTLE CONTEXTUAL CHECK-INS:
   - Inquire about their sleep, appetite, or energy naturally.
   - Gently verify whether they took their scheduled medicines without sounding like an inspector.
   - If there is an open follow-up (e.g., previous knee pain or back stiffness), check if it has improved.
4. PRIVACY BOUNDARIES:
   - If ${profile.honorific} says "keep this private", "don't tell ${profile.childName}", or discusses sensitive personal/financial matters, acknowledge politely: "Bilkul Ji, main yeh baat personal rakhungi." Exclude it from the summary.
5. GENTLE WRAP-UP:
   - Reassure them that ${profile.childName} sends their love.
   - Wish them a restful day and close with a polite farewell.

CRITICAL SAFETY & MEDICAL BOUNDARIES:
- NEVER diagnose a condition or provide medical prognoses.
- NEVER suggest changing prescription drug dosages.
- RED FLAG SYMPTOMS: If ${profile.honorific} mentions acute chest pain, breathlessness, sudden speech/arm weakness, high fever with confusion, or a fall:
  -> Express immediate calm concern: "Please sit down comfortably right now. I will notify ${profile.childName} and ${profile.emergencyContact?.name || "family"} immediately so someone is by your side." End the call promptly to avoid delaying medical attention.`;
}

export function buildSarvamVariables(
  profile: ParentProfile,
  numberOfCalls?: number | string,
): Record<string, any> {
  const numCalls = resolveCallCount(numberOfCalls, profile);

  return {
    parent_name: profile.parentName,
    honorific: profile.honorific || "Ji",
    child_name: profile.childName || "Family",
    number_of_calls: String(numCalls),
  };
}
