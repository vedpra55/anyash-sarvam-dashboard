import { NextRequest, NextResponse } from "next/server";
import {
  ParentProfile,
  VoiceHealthConfig,
  SupportedLanguage,
} from "@/lib/types";
import { buildSarvamVariables, resolveCallCount } from "@/lib/prompts";
import { getServiceSupabase } from "@/lib/supabase";
import { getSavedAgentVersion } from "@/lib/settings";
import { checkCallTime } from "@/lib/callTime";

export const dynamic = "force-dynamic";

const PROFILE_COLUMNS =
  "id, parent_name, current_user_context, number_of_calls, phone_number, facts, preferred_call_time, sleep_time";

/**
 * Reads the variable names out of Sarvam's 422 error, e.g.
 * "Agent variables '{'language', 'preferred_language'}' not found in agent variables of app ..."
 */
function parseUnknownAgentVariables(errorText: string): string[] {
  const match = errorText.match(/Agent variables? '?\{([^}]*)\}'? not found/i);
  if (!match) return [];
  return Array.from(match[1].matchAll(/'([A-Za-z0-9_]+)'/g), (m) => m[1]);
}

interface OutboundRequestBody {
  profile: ParentProfile;
  config?: VoiceHealthConfig;
  customLanguage?: SupportedLanguage;
  number_of_calls?: number | string;
  numberOfCalls?: number | string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as any;
    const {
      profile,
      config,
      customLanguage,
      number_of_calls,
      numberOfCalls,
      user_context_override,
      initial_bot_message_override,
    } = body;

    if (!profile || !profile.parentPhone) {
      return NextResponse.json(
        { error: "Valid parent profile with phone number is required" },
        { status: 400 },
      );
    }

    const language = customLanguage || profile.preferredLanguage || "Hindi";

    // 1. Fetch persistent user_id, user_context, and call count from Supabase
    let userId = "";
    let fetchedUserContext = "";

    // Explicit user call number from modal stepper takes highest precedence ("no question asked")
    const hasExplicitCallNumber =
      number_of_calls !== undefined ||
      numberOfCalls !== undefined ||
      profile?.number_of_calls !== undefined;

    let callCount = resolveCallCount(
      number_of_calls ?? numberOfCalls,
      profile,
    );
    const normalizedPhone = profile.parentPhone ? profile.parentPhone.replace(/[^\d+]/g, "") : "";
    let refusedReason: string | null = null;

    try {
      const supabase = getServiceSupabase();
      let dbProfile: any = null;
      const last10 = normalizedPhone.slice(-10);

      // Primary check: search by phone number first so we never associate the wrong person
      if (normalizedPhone) {
        const { data: profByPhone } = await supabase
          .from("parent_profiles")
          .select(PROFILE_COLUMNS)
          .or(`phone_number.eq.${normalizedPhone},phone_number.ilike.%${last10}%`)
          .maybeSingle();
        if (profByPhone) {
          dbProfile = profByPhone;
        }
      }

      // Secondary check: if not found by phone, check by profile.id ONLY if phone digits match
      if (!dbProfile && profile.id) {
        const { data: profById } = await supabase
          .from("parent_profiles")
          .select(PROFILE_COLUMNS)
          .eq("id", profile.id)
          .maybeSingle();

        if (profById) {
          const profLast10 = (profById.phone_number || "").replace(/\D/g, "").slice(-10);
          if (!normalizedPhone || profLast10 === last10) {
            dbProfile = profById;
          }
        }
      }

      // Every family is onboarded (a profile from the child) before its first call,
      // and is never called after its latest call time (India time).
      const timeCheck = dbProfile ? checkCallTime(dbProfile) : null;
      if (!dbProfile) {
        refusedReason = "This number has no parent profile yet. Add the parent (or send the onboarding link) before calling.";
      } else if (timeCheck && !timeCheck.allowed) {
        refusedReason = timeCheck.reason;
      } else {
        userId = dbProfile.id;
        fetchedUserContext = dbProfile.current_user_context || "";

        // If user DID NOT specify an explicit call number, fallback to DB profile count
        // BUT if user incremented or specified it, that value is used "no question asked"!
        if (!hasExplicitCallNumber && dbProfile.number_of_calls) {
          callCount = Number(dbProfile.number_of_calls) || 1;
        }

        // Only normalize formatting if actual 10-digit phone is identical (safe formatting update)
        const profDigits = (dbProfile.phone_number || "").replace(/\D/g, "").slice(-10);
        if (normalizedPhone && profDigits === last10 && dbProfile.phone_number !== normalizedPhone) {
          await supabase
            .from("parent_profiles")
            .update({ phone_number: normalizedPhone, updated_at: new Date().toISOString() })
            .eq("id", dbProfile.id);
        }

        // Always sync the chosen callCount and active user_context to Supabase parent_profiles
        const effectiveContext =
          user_context_override && user_context_override.trim()
            ? user_context_override.trim()
            : (fetchedUserContext || `TODAY: Check-in | CALL COUNT: ${callCount}\nBASELINE: ${profile.parentName || "Parent"} | Child: ${profile.childName || "Family"}`);

        const currentFacts = dbProfile.facts || {};
        const updatedFacts = {
          ...currentFacts,
          language: language || currentFacts.language || "Hindi",
        };

        await supabase
          .from("parent_profiles")
          .update({
            current_user_context: effectiveContext,
            number_of_calls: callCount,
            facts: updatedFacts,
            language: updatedFacts.language,
            updated_at: new Date().toISOString(),
          })
          .eq("id", dbProfile.id);

        fetchedUserContext = effectiveContext;
      }
    } catch (dbErr) {
      console.error("Failed to query/create parent_profiles in Supabase:", dbErr);
    }

    if (refusedReason) {
      console.warn(`Outbound call refused: ${refusedReason}`);
      return NextResponse.json({ error: refusedReason }, { status: 409 });
    }

    const callCountStr = String(callCount);

    const apiKey = config?.sarvamApiKey || process.env.SARVAM_API_KEY || "";
    const orgId = config?.sarvamOrgId || process.env.SARVAM_ORG_ID || "";
    const workspaceId =
      config?.sarvamWorkspaceId || process.env.SARVAM_WORKSPACE_ID || "";
    const appId = config?.sarvamAppId || process.env.SARVAM_APP_ID || "";
    // Precedence: version saved in dashboard settings > request config > env > 12
    const savedAppVersion = await getSavedAgentVersion();
    const appVersion =
      savedAppVersion ??
      ((config?.sarvamAppVersion && config.sarvamAppVersion > 1)
        ? config.sarvamAppVersion
        : (Number(process.env.SARVAM_APP_VERSION) || 12));
    const connectionId =
      config?.connectionId || process.env.SARVAM_CONNECTION_ID || "";
    const agentPhone =
      config?.agentPhoneNumber || process.env.SARVAM_AGENT_PHONE_NUMBER || "";

    const hasLiveTelephonyCredentials =
      apiKey && orgId && workspaceId && appId && connectionId && agentPhone;

    // If live credentials exist, trigger Sarvam Instant Outbound REST API
    if (hasLiveTelephonyCredentials) {
      const sarvamUrl = `https://apps.sarvam.ai/api/outbounds/v1/orgs/${orgId}/workspaces/${workspaceId}/outbounds`;
      const webhookUrl =
        config?.webhookUrl ||
        `${process.env.APP_BASE_URL || "https://anyash.vercel.app"}/api/webhooks/sarvam`;

      // Sarvam supported initial language enum
      const ALLOWED_LANGUAGES = [
        "Bengali",
        "Gujarati",
        "Kannada",
        "Konkani",
        "Malayalam",
        "Tamil",
        "Telugu",
        "Punjabi",
        "Sanskrit",
        "Odia",
        "Marathi",
        "Hindi",
        "English",
        "Assamese",
      ];
      const validLanguage =
        language === "Hinglish" || !ALLOWED_LANGUAGES.includes(language)
          ? "Hindi"
          : language;

      const effectiveUserContext = (user_context_override !== undefined && user_context_override.trim())
        ? user_context_override.trim()
        : fetchedUserContext;

      // The agent's own prompt and intro open the call. A greeting is sent only
      // when a manual test passes initial_bot_message_override.
      const botMessageOverride =
        typeof initial_bot_message_override === "string" && initial_bot_message_override.trim()
          ? initial_bot_message_override.trim()
          : undefined;

      const sarvamPayload: any = {
        app_config: {
          app_id: appId,
          app_version: appVersion,
          connection_config: {
            connection_id: connectionId,
            agent_phone_number: agentPhone,
          },
          agent_variables: {
            ...buildSarvamVariables(profile, callCountStr),
            user_id: userId,
            user_context: effectiveUserContext,
            number_of_calls: callCountStr,
          },
          app_overrides: {
            initial_language_name: validLanguage,
            user_id: userId,
            user_context: effectiveUserContext,
            ...(botMessageOverride ? { initial_bot_message: botMessageOverride } : {}),
          },
        },
        user_config: {
          user_phone_number: profile.parentPhone,
        },
        webhook_config: {
          url: webhookUrl,
          metadata: {
            user_id: userId,
            profile_id: userId || profile.id,
            child_name: profile.childName,
            number_of_calls: callCountStr,
            language: validLanguage,
          },
        },
      };

      const sendOutbound = () =>
        fetch(sarvamUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey.trim(),
          },
          body: JSON.stringify(sarvamPayload),
        });

      let sarvamRes = await sendOutbound();

      // Agent versions define different variables, and Sarvam rejects unknown ones.
      // Drop the variables it names and retry once.
      let droppedVariables: string[] = [];
      if (sarvamRes.status === 422) {
        const errorText = await sarvamRes.clone().text();
        droppedVariables = parseUnknownAgentVariables(errorText);
        if (droppedVariables.length > 0) {
          for (const name of droppedVariables) {
            delete sarvamPayload.app_config.agent_variables[name];
          }
          console.warn(
            `Agent version ${appVersion} does not define ${droppedVariables.join(", ")}; retrying without them.`,
          );
          sarvamRes = await sendOutbound();
        }
      }

      if (!sarvamRes.ok) {
        const errorText = await sarvamRes.text();
        console.error(
          "Sarvam Instant Outbound error:",
          sarvamRes.status,
          errorText,
        );
        return NextResponse.json(
          {
            error: `Sarvam API error (${sarvamRes.status}): ${errorText}`,
            status: sarvamRes.status,
          },
          { status: 502 },
        );
      }

      const data = await sarvamRes.json();
      return NextResponse.json({
        success: true,
        attemptId: data.attempt_id || `sarvam-att-${Date.now()}`,
        mode: "live_telephony",
        recipient: profile.parentPhone,
        language,
        number_of_calls: callCountStr,
      });
    }

    // Otherwise, generate a simulated attempt ID for rapid testing/development
    const simulatedAttemptId = `sim-att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    return NextResponse.json({
      success: true,
      attemptId: simulatedAttemptId,
      mode: "simulation",
      message:
        "Telephony credentials not fully configured. Created simulated call session for UI testing.",
      recipient: profile.parentPhone,
      language,
      number_of_calls: callCountStr,
    });
  } catch (err: any) {
    console.error("Outbound call handler error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
