/** In-call tool `query_parent_history`: answers from the parent's daily_health_logs. */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const NO_RECORD = "Pichla record check kiya, lekin is bare mein koi purani entry nahi mili.";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isHistoryQuery(body: Record<string, any>): boolean {
  return (
    body.action === "query_parent_history" ||
    body.tool_name === "query_parent_history" ||
    body.query_type === "history" ||
    (body.topic !== undefined && body.call_outcome === undefined && body.status === undefined)
  );
}

export async function answerHistoryQuery(supabase: SupabaseClient, body: Record<string, any>) {
  const userId = body.user_id || body.userId || body.parent_id || null;
  const topic = String(body.topic || body.category || "general").toLowerCase();

  // Without the caller's id there is no safe way to know whose records to read,
  // so answer "no record" rather than guess another parent's history.
  if (!userId) {
    console.warn("query_parent_history called without user_id; returning no record");
    return { success: true, action: "query_parent_history", user_id: null, topic, answer: NO_RECORD };
  }

  const { data: pastLogs, error } = await supabase
    .from("daily_health_logs")
    .select("log_date, meals_reported, sleep_hours, sleep_quality, sleep_notes, medication_adherence, mobility_and_pain, vitals_reported, raw_summary")
    .eq("parent_id", userId)
    .order("log_date", { ascending: false })
    .limit(7);

  if (error) console.error("Error querying past logs:", error);

  let answer = NO_RECORD;

  if (pastLogs && pastLogs.length > 0) {
    const todayMs = new Date(new Date().toISOString().split("T")[0]).getTime();
    const answers: string[] = [];

    for (const log of pastLogs) {
      const d = new Date(log.log_date);
      const diffDays = Math.round((todayMs - d.getTime()) / 86400000);
      const dayTag =
        diffDays === 0 ? "Aaj" : diffDays === 1 ? "Kal" : diffDays === 2 ? "Parso" : diffDays > 2 ? `${diffDays} din pehle` : "";
      const dateShort = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
      const dateLabel = dayTag ? `${dayTag} (${dateShort})` : dateShort;

      if (topic.includes("vital") || topic.includes("bp") || topic.includes("sugar")) {
        const vitals = log.vitals_reported || {};
        const parts: string[] = [];
        const bp = vitals.bp || vitals.blood_pressure;
        const sugar = vitals.sugar || vitals.blood_sugar;
        if (bp) parts.push(`BP ${bp}`);
        if (sugar) parts.push(`Sugar ${sugar}`);
        if (parts.length) answers.push(`${dateLabel} ko ${parts.join(", ")} tha`);
      } else if (topic.includes("diet") || topic.includes("meal") || topic.includes("eat") || topic.includes("khana")) {
        const meals = log.meals_reported || {};
        const items: string[] = [];
        if (meals.breakfast && meals.breakfast !== "Not reported") items.push(`breakfast mein ${meals.breakfast}`);
        if (meals.lunch && meals.lunch !== "Not reported") items.push(`lunch mein ${meals.lunch}`);
        if (meals.dinner && meals.dinner !== "Not reported") items.push(`dinner mein ${meals.dinner}`);
        if (items.length) answers.push(`${dateLabel} ko ${items.join(", ")}`);
      } else if (topic.includes("sleep") || topic.includes("neend")) {
        if (log.sleep_hours || log.sleep_quality) {
          answers.push(`${dateLabel} ko ${log.sleep_hours ? log.sleep_hours + " ghante " : ""}${log.sleep_quality || "theek"} neend aayi thi`);
        }
      } else if (topic.includes("pain") || topic.includes("knee") || topic.includes("ghutna") || topic.includes("stiff")) {
        const mob = log.mobility_and_pain || {};
        if (mob.nature || mob.nature_triggers || mob.activity_done) {
          answers.push(`${dateLabel} ko: ${mob.nature || mob.nature_triggers || mob.activity_done}`);
        }
      }
    }

    answer = answers.length
      ? "Record ke anusaar: " + answers.join("; ") + "।"
      : `Record ke anusaar: ${pastLogs[0].raw_summary || "pichle dino tabiyat theek thi aur medicines time pe li thi."}`;
  }

  console.log("Returning tool answer:", answer);
  return { success: true, action: "query_parent_history", user_id: userId, topic, answer };
}
