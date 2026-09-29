export type SupportedLanguage =
  | "Hindi"
  | "English"
  | "Hinglish"
  | "Tamil"
  | "Telugu"
  | "Marathi"
  | "Bengali"
  | "Kannada"
  | "Gujarati"
  | "Punjabi"
  | "Malayalam"
  | "Odia"
  | "Assamese"
  | "Konkani";

export type MedicationTiming = "morning" | "afternoon" | "evening" | "night";

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  timing: MedicationTiming;
  takenToday: boolean;
  purpose?: string;
}

export interface Routine {
  id: string;
  time: string;
  activity: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export type ParentOperationalStatus = "Active" | "Pending" | "Paused";

export interface ParentProfile {
  id: string;
  parentName: string;
  parentPhone: string;
  honorific: string; // e.g. "Ji", "Mummy Ji", "Papa Ji"
  preferredLanguage: SupportedLanguage;
  childName: string;
  childPhone: string;
  emergencyContact: EmergencyContact;
  knownConditions: string[];
  medications: Medication[];
  routines: Routine[];
  activeFollowUps: string[];
  lastCallDate?: string;
  avatarColor?: string;

  // Operational Dashboard fields
  age?: number;
  status?: ParentOperationalStatus;
  familyRelation?: string; // e.g. "Daughter: Priya", "Son: Amit"
  lastCallText?: string; // e.g. "Today, 9:12 AM"
  nextCallText?: string; // e.g. "Tomorrow"
  riskFollowUp?: string; // e.g. "None", "Knee pain", "Repeated dizziness"
  currentStatusNote?: string; // e.g. "No concerning change detected" or "Knee pain mentioned yesterday"
  number_of_calls?: number | string;
}

export type ActionType = "remind" | "ask" | "buy" | "check" | "schedule" | "escalate";
export type UrgencyLevel = "low" | "medium" | "urgent";

export type AnyashDecisionType =
  | "MONITOR"
  | "FAMILY_NOTIFICATION"
  | "ESCALATION"
  | "NORMAL";

export interface FamilyNotificationStatus {
  sent: boolean;
  recipient?: string;
  channel?: "WhatsApp" | "SMS" | "Call";
  time?: string;
  note?: string;
}

export interface DecisionCard {
  id: string;
  profileId: string;
  parentName?: string;
  timestamp: string;
  observation: string; // What the parent actually said
  interpretation: string; // What pattern may be present
  recommendedAction: string; // What operator / child can do next
  actionType: ActionType;
  uncertainty: string; // What the agent does not know / needs checking
  urgency: UrgencyLevel;
  actionCompleted: boolean;

  // Anyash Operational Decision attributes
  decision?: AnyashDecisionType;
  symptom?: string;
  why?: string; // Clear clinical/agent explanation
  nextAction?: string; // Specific next step
  nextFollowUpDate?: string; // e.g. "Sep 23", "Tomorrow"
  familyNotification?: FamilyNotificationStatus;
}

export interface CallTranscriptTurn {
  turn_id?: number;
  role: "agent" | "user" | "assistant";
  text: string;
  timestamp?: string;
  audioUrl?: string;
}

export type CallStatus = "connected" | "no_answer" | "busy" | "failed" | "in_progress";

export interface CallRecord {
  attemptId: string;
  interactionId?: string;
  userIdentifier?: string;
  profileId: string;
  parentName?: string;
  timestamp: string; // Formatted date/time
  dateOnly?: string; // e.g. "Sep 22"
  status: CallStatus;
  durationSeconds: number;
  summary?: string; // e.g. "Fasting, no weakness", "Knee pain"
  decisionCard?: DecisionCard;
  transcript?: CallTranscriptTurn[];
  failureReason?: string;
  audioUrl?: string;
  usageCostInr?: number;
  telephonyCostInr?: number;
  averageLatencyMs?: number;
  numMessages?: number;
  languageName?: string;
  number_of_calls?: number | string;
  rawAgentVariables?: Record<string, any>;
}

export interface VoiceHealthConfig {
  sarvamApiKey: string;
  sarvamOrgId: string;
  sarvamWorkspaceId: string;
  sarvamAppId: string;
  sarvamAppVersion: number;
  connectionId: string;
  agentPhoneNumber: string;
  telephonyProvider: "sarvam_vobiz" | "twilio" | "exotel";
  systemPromptOverride?: string;
  webhookUrl?: string;
}

export interface OutboundCallRequest {
  profileId: string;
  customLanguage?: SupportedLanguage;
  urgencyNote?: string;
}

// ---------------------------------------------------------------------------
// Modern Voice Agent Analytics Interfaces (Matching Sarvam Platform UI)
// ---------------------------------------------------------------------------

export interface HourlyConnectivityPoint {
  hourLabel: string; // e.g. "12AM", "2PM", "3PM"
  hour: number; // 0-23
  connectivityRate: number; // 0-100%
  callsAttempted: number;
  callsConnected: number;
}

export interface PlatformAnalyticsOverview {
  callsAttempted: number; // e.g. 14
  connectedCalls: number; // e.g. 11
  connectivityRate: number; // e.g. 78.57%
  latencyMs: number; // e.g. 480
  avgCallDurationFormatted: string; // e.g. "01:22"
  avgCallDurationSeconds: number; // e.g. 82
  totalMinutes: number; // e.g. 21
  shortCalls: number; // e.g. 1 (<30s)
  callOutcomesCount: number; // 14
  topFailureReasonsCount: number; // 0
  hourlyData: HourlyConnectivityPoint[];
  dailyTimeline: { date: string; calls: number }[];
}

export interface CohortMetrics {
  callCount: number;
  percentage: number;
  baseConnected: number;
  avgCallDurationFormatted: string;
  avgCallDurationSeconds: number;
  avgTurnsPerCall: number;
  avgLatencyMs: number;
  durationDiffPercent?: number;
  turnsDiffPercent?: number;
  latencyDiffMs?: number;
}

export interface GoalsAnalytics {
  goalAchievementRate: number; // e.g. 62.50%
  goalEligibleCalls: number; // e.g. 8
  goalAchievedCount: number; // e.g. 5
  avgTurnsToGoal: number; // e.g. 19.8
  avgTurnsNotAchieved: number; // e.g. 7.0
  achievedCohort: CohortMetrics;
  notAchievedCohort: CohortMetrics;
  turnDistribution: {
    turnBracket: string;
    achievedPct: number;
    notAchievedPct: number;
  }[];
  languageSplit: {
    language: string;
    achievedPct: number;
    notAchievedPct: number;
  }[];
}

export interface TTSSettingsSpec {
  text: string;
  language: string; // e.g. "hi-IN"
  speaker: string; // e.g. "shubh"
  pitch: number; // e.g. 0
  pace: number; // e.g. 1
  style: number; // e.g. 0.5
  speed: number; // e.g. 1
}

export interface LogAnalyserPayload {
  interactionId: string;
  attemptId: string;
  userIdentifier: string;
  userContactMasked?: string;
  parentName: string;
  durationFormatted: string;
  durationSeconds: number;
  startTime: string;
  audioUrl?: string;
  transcript: CallTranscriptTurn[];
  decisionCard?: DecisionCard;
  ttsSpec: TTSSettingsSpec;
  rawAgentVariables?: Record<string, any>;
}
