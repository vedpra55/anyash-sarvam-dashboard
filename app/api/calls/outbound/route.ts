import { NextRequest, NextResponse } from "next/server";
import {
  ParentProfile,
  VoiceHealthConfig,
  SupportedLanguage,
} from "@/lib/types";
import { buildSarvamVariables, resolveCallCount } from "@/lib/prompts";
import { getServiceSupabase } from "@/lib/supabase";
import { getSavedAgentVersion } from "@/lib/settings";

export const dynamic = "force-dynamic";

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

    try {
      const supabase = getServiceSupabase();
      let dbProfile: any = null;
      const last10 = normalizedPhone.slice(-10);

      // Primary check: search by phone number first so we never associate the wrong person
      if (normalizedPhone) {
        const { data: profByPhone } = await supabase
          .from("parent_profiles")
          .select("id, current_user_context, number_of_calls, phone_number")
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
          .select("id, current_user_context, number_of_calls, phone_number")
          .eq("id", profile.id)
          .maybeSingle();

        if (profById) {
          const profLast10 = (profById.phone_number || "").replace(/\D/g, "").slice(-10);
          if (!normalizedPhone || profLast10 === last10) {
            dbProfile = profById;
          }
        }
      }

      // If still not found, create a new separate profile for this phone number
      if (!dbProfile && normalizedPhone) {
        const { data: newProfile } = await supabase
          .from("parent_profiles")
          .insert({
            phone_number: normalizedPhone,
            parent_name: profile.parentName || "Parent",
            child_name: profile.childName || "Family",
            honorific: profile.honorific || "Mummy Ji",
            number_of_calls: callCount,
            current_user_context: `TODAY: Initial Check-in | CALL COUNT: ${callCount}\nBASELINE: ${profile.parentName || "Parent"} | Child: ${profile.childName || "Family"}\nACTIVE WATCHLIST:\n- First call check-in.`,
          })
          .select("id, current_user_context, number_of_calls, phone_number")
          .single();
        dbProfile = newProfile;
      }

      if (dbProfile) {
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
            updated_at: new Date().toISOString(),
          })
          .eq("id", dbProfile.id);

        fetchedUserContext = effectiveContext;
      }
    } catch (dbErr) {
      console.error("Failed to query/create parent_profiles in Supabase:", dbErr);
    }

    const callCountStr = String(callCount);
    const isFirstCall = callCount <= 1;

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

      const isEnglish = validLanguage === "English";
      const defaultGreeting = isFirstCall
        ? (isEnglish
            ? `Hello ${profile.parentName}! I am Anya calling on behalf of ${profile.childName} to check in on you. How are you feeling today?`
            : `Namaste ${profile.honorific || profile.parentName}! Main Anya bol rahi hoon, ${profile.childName} ne aapka haal-chaal lene ke liye pehli baar phone karne ko kaha tha. Aap aaj kaisa mehsoos kar rahe hain?`)
        : (isEnglish
            ? `Hello ${profile.parentName}! I am Anya calling on behalf of ${profile.childName}. How are you feeling today?`
            : `Namaste ${profile.honorific || profile.parentName}! Main Anya bol rahi hoon, ${profile.childName} ki taraf se. Aap aaj kaisa mehsoos kar rahe hain?`);

      // If initial_bot_message_override was passed, respect it.
      // If language is English or Hindi, use our tailored greeting.
      // For other Indic languages, omit initial_bot_message to allow Sarvam's native audio intro to speak in that language.
      const effectiveBotMessage = (initial_bot_message_override !== undefined && initial_bot_message_override.trim())
        ? initial_bot_message_override.trim()
        : (isEnglish || validLanguage === "Hindi" ? defaultGreeting : undefined);

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
            preferred_language: validLanguage,
            language: validLanguage,
          },
          app_overrides: {
            initial_language_name: validLanguage,
            user_id: userId,
            user_context: effectiveUserContext,
            ...(effectiveBotMessage ? { initial_bot_message: effectiveBotMessage } : {}),
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

      const sarvamRes = await fetch(sarvamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey.trim(),
        },
        body: JSON.stringify(sarvamPayload),
      });

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
