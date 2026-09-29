import {
  ParentProfile,
  VoiceHealthConfig,
  CallRecord,
  DecisionCard,
} from "./types";

const PROFILES_KEY = "anyash_operator_parents_v5";
const ACTIVE_PROFILE_KEY = "anyash_operator_active_profile_id_v5";
const CONFIG_KEY = "anyash_health_config";
const CALLS_KEY = "anyash_operator_calls_v5";

export const DEFAULT_PROFILES: ParentProfile[] = [];

export const DEFAULT_DECISION_CARDS: DecisionCard[] = [];

export const DEFAULT_CALLS: CallRecord[] = [];

export const DEFAULT_CONFIG: VoiceHealthConfig = {
  sarvamApiKey: "",
  sarvamOrgId: "",
  sarvamWorkspaceId: "",
  sarvamAppId: "",
  sarvamAppVersion: 14,
  connectionId: "",
  agentPhoneNumber: "",
  telephonyProvider: "sarvam_vobiz",
  systemPromptOverride: "",
};

function isClient(): boolean {
  return typeof window !== "undefined";
}

function normalizeProfile(p: any): ParentProfile {
  let numCalls = p.number_of_calls;
  if (numCalls === undefined && p.is_first_call !== undefined) {
    numCalls = p.is_first_call === true || p.is_first_call === "true" ? 1 : 2;
  }
  const cleanProfile = { ...p };
  delete cleanProfile.is_first_call;
  return {
    ...cleanProfile,
    number_of_calls: numCalls !== undefined ? Number(numCalls) || 1 : 1,
  };
}

function normalizeCallRecord(c: any): CallRecord {
  let numCalls = c.number_of_calls;
  if (numCalls === undefined && c.is_first_call !== undefined) {
    numCalls = c.is_first_call === true || c.is_first_call === "true" ? 1 : 2;
  }
  const cleanCall = { ...c };
  delete cleanCall.is_first_call;
  const rawVars = cleanCall.rawAgentVariables ? { ...cleanCall.rawAgentVariables } : {};
  delete rawVars.is_first_call;
  if (numCalls !== undefined) {
    rawVars.number_of_calls = String(numCalls);
  }
  return {
    ...cleanCall,
    number_of_calls: numCalls !== undefined ? Number(numCalls) || 1 : 1,
    rawAgentVariables: cleanCall.rawAgentVariables ? rawVars : undefined,
  };
}

export function getStoredProfiles(): ParentProfile[] {
  if (!isClient()) return [];
  try {
    const data = localStorage.getItem(PROFILES_KEY);
    if (!data) {
      localStorage.setItem(PROFILES_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeProfile);
    }
    return [];
  } catch (e) {
    console.error("Failed to read profiles from localStorage", e);
    return [];
  }
}

export function saveProfiles(profiles: ParentProfile[]): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles.map(normalizeProfile)));
  } catch (e) {
    console.error("Failed to save profiles to localStorage", e);
  }
}

export function getActiveProfileId(): string | null {
  if (!isClient()) return null;
  try {
    return localStorage.getItem(ACTIVE_PROFILE_KEY);
  } catch {
    return null;
  }
}

export function setActiveProfileId(id: string): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  } catch (e) {
    console.error("Failed to set active profile", e);
  }
}

export function getActiveProfile(): ParentProfile | null {
  const profiles = getStoredProfiles();
  const activeId = getActiveProfileId();
  return profiles.find((p) => p.id === activeId) || profiles[0] || null;
}

export function updateProfile(updated: ParentProfile): ParentProfile[] {
  const profiles = getStoredProfiles();
  const index = profiles.findIndex((p) => p.id === updated.id);
  if (index !== -1) {
    profiles[index] = updated;
  } else {
    profiles.push(updated);
  }
  saveProfiles(profiles);
  return profiles;
}

export function addParentProfile(newProfile: ParentProfile): ParentProfile[] {
  const profiles = getStoredProfiles();
  profiles.unshift(newProfile);
  saveProfiles(profiles);
  setActiveProfileId(newProfile.id);
  return profiles;
}

export function deleteProfile(id: string): ParentProfile[] {
  const profiles = getStoredProfiles().filter((p) => p.id !== id);
  saveProfiles(profiles);
  return profiles;
}

export function getStoredConfig(): VoiceHealthConfig {
  if (!isClient()) return DEFAULT_CONFIG;
  try {
    const data = localStorage.getItem(CONFIG_KEY);
    if (!data) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(DEFAULT_CONFIG));
      return DEFAULT_CONFIG;
    }
    const parsed = JSON.parse(data);
    if (!parsed.sarvamAppVersion || parsed.sarvamAppVersion < 14) {
      parsed.sarvamAppVersion = 14;
      localStorage.setItem(CONFIG_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: VoiceHealthConfig): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save config", e);
  }
}

export function getStoredCalls(): CallRecord[] {
  if (!isClient()) return [];
  try {
    const data = localStorage.getItem(CALLS_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.map(normalizeCallRecord) : [];
  } catch {
    return [];
  }
}

export function saveCalls(calls: CallRecord[]): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(CALLS_KEY, JSON.stringify(calls.map(normalizeCallRecord)));
  } catch (e) {
    console.error("Failed to save calls list", e);
  }
}

export function saveCallRecord(call: CallRecord): void {
  if (!isClient()) return;
  try {
    const calls = getStoredCalls();
    const normalizedCall = normalizeCallRecord(call);
    const existingIdx = calls.findIndex((c) => c.attemptId === normalizedCall.attemptId);
    if (existingIdx !== -1) {
      calls[existingIdx] = normalizedCall;
    } else {
      calls.unshift(normalizedCall);
    }
    localStorage.setItem(CALLS_KEY, JSON.stringify(calls));
  } catch (e) {
    console.error("Failed to save call record", e);
  }
}

export function getStoredDecisions(): DecisionCard[] {
  const calls = getStoredCalls();
  const callDecisions = calls.filter((c) => c.decisionCard).map((c) => c.decisionCard!);
  const map = new Map<string, DecisionCard>();
  callDecisions.forEach((d) => map.set(d.id, d));
  return Array.from(map.values());
}

export function toggleDecisionActionCompleted(decisionId: string): void {
  if (!isClient()) return;
  try {
    const calls = getStoredCalls();
    let updated = false;
    for (const call of calls) {
      if (call.decisionCard && call.decisionCard.id === decisionId) {
        call.decisionCard.actionCompleted = !call.decisionCard.actionCompleted;
        updated = true;
        break;
      }
    }
    if (updated) {
      localStorage.setItem(CALLS_KEY, JSON.stringify(calls));
    }
  } catch (e) {
    console.error("Failed to toggle decision action", e);
  }
}
