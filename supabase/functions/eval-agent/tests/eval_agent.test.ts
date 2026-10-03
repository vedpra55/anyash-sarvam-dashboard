import { assert, assertEquals } from "jsr:@std/assert@1";
import { fakeDb, stubModel } from "../../sarvam-call-handler/tests/fake_db.ts";
import { estimateSeconds, renderTemplate, talkStats, type Turn } from "../lib/transcript.ts";
import { overall, runDeterministic } from "../lib/graders.ts";
import { stepResult } from "../lib/runner.ts";
import { agentTurn, END_INTERACTION_TOOL, parentTurn, REAL_PARENT_LINES } from "../lib/agent.ts";

const t = (role: "agent" | "parent", text: string): Turn => ({ role, text });
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

Deno.test("templates: placeholders are filled, unknown ones kept", () => {
  assertEquals(
    renderTemplate("Hi {{honorific}}, call {{number_of_calls}} {{sarvam_variables.current_datetime}} {{nope}}", {
      honorific: "Papa Ji",
      number_of_calls: 2,
      "sarvam_variables.current_datetime": "2026-10-01 09:00 IST",
    }),
    "Hi Papa Ji, call 2 2026-10-01 09:00 IST {{nope}}",
  );
});

Deno.test("time is estimated from the words spoken", () => {
  assertEquals(estimateSeconds([]), 0);
  assert(estimateSeconds([t("agent", words(25)), t("parent", words(22))]) >= 20);
  const s = talkStats([t("agent", "a b c"), t("parent", "d e f g h")]);
  assertEquals([s.agentWords, s.parentWords], [3, 5]);
});

Deno.test("talk share: the parent must say more", () => {
  const ok = runDeterministic([t("agent", "Namaste"), t("parent", "haan bol rahi hoon aap kaun")], "agent_end", ["talk_share"]);
  assertEquals(ok[0].pass, true);
  const bad = runDeterministic([t("agent", words(30)), t("parent", "haan")], "agent_end", ["talk_share"]);
  assertEquals(bad[0].pass, false);
});

Deno.test("format: markdown, emoji and em dashes fail", () => {
  const f = (text: string) => runDeterministic([t("agent", "Namaste"), t("parent", "haan"), t("agent", text)], "limit", ["format"])[0].pass;
  assertEquals(f("Aaj din kaisa raha?"), true);
  assertEquals(f("**Aaj** din kaisa raha?"), false);
  assertEquals(f("Achha 😊 aur sunaiye"), false);
  assertEquals(f("Achha — aur sunaiye"), false);
});

Deno.test("short turns: opening and goodbye are not counted, two questions fail", () => {
  const turns = [t("agent", words(60)), t("parent", "haan"), t("agent", "Neend kaisi rahi? Aur khana kaisa raha?"), t("parent", "theek"), t("agent", words(60))];
  assertEquals(runDeterministic(turns, "agent_end", ["turn_length"])[0].pass, false);
  const fine = [t("agent", words(60)), t("parent", "haan"), t("agent", "Neend kaisi rahi?"), t("parent", "theek"), t("agent", words(60))];
  assertEquals(runDeterministic(fine, "agent_end", ["turn_length"])[0].pass, true);
});

Deno.test("no repeated lines", () => {
  const turns = [t("agent", "Namaste ji"), t("parent", "haan"), t("agent", "Kal phir baat karenge."), t("parent", "theek"), t("agent", "Kal phir baat karenge.")];
  assertEquals(runDeterministic(turns, "agent_end", ["no_repeat"])[0].pass, false);
});

Deno.test("closing time: closed, cut off, or the parent hung up", () => {
  const turns = [t("agent", "a"), t("parent", "b")];
  assertEquals(runDeterministic(turns, "agent_end", ["closing_time"])[0].pass, true);
  assertEquals(runDeterministic(turns, "cutoff", ["closing_time"])[0].pass, false);
  assertEquals(runDeterministic(turns, "parent_hangup", ["closing_time"])[0].pass, null);
});

Deno.test("overall: not applicable checks are ignored, any failure fails", () => {
  assertEquals(overall([{ id: "a", pass: true, reason: "" }, { id: "b", pass: null, reason: "" }]), true);
  assertEquals(overall([{ id: "a", pass: true, reason: "" }, { id: "b", pass: false, reason: "" }]), false);
  assertEquals(overall([{ id: "a", pass: null, reason: "" }]), false);
});

const scenario = {
  id: "s1",
  name: "Chatty parent",
  kind: "simulation",
  persona: "Chatty grandmother",
  behaviours: null,
  language: "Hinglish",
  parent_name: "Sunita",
  honorific: "Mummy Ji",
  child_name: "Priya",
  call_number: 3,
  user_context: "Ask about the knee.",
  script: null,
  max_exchanges: 6,
  checks: ["talk_share", "closing_time", "feelings"],
  criteria: [{ id: "opens_with_knee", text: "The agent asks about the knee first." }],
  notes: "",
};

function world() {
  return fakeDb({
    eval_prompts: [{ id: "p1", name: "v2", text: "You are Anyash for {{parent_name}}. {{user_context}}", opening_line: "Namaste {{honorific}}" }],
    eval_scenarios: [scenario],
    eval_runs: [{ id: "r1", prompt_id: "p1", status: "running" }],
    eval_results: [{ id: "res1", run_id: "r1", scenario_id: "s1", scenario_name: "Chatty parent", status: "queued", transcript: [], ended: null, tokens: 0 }],
  });
}

function model() {
  let parentCalls = 0;
  return stubModel((system, user) => {
    if (system.includes("You play an elderly Indian parent")) {
      parentCalls++;
      return { say: parentCalls <= 2 ? `Haan beta, aaj bahut kuch hua, ${words(20)}` : "Theek hai, namaste", hangup: parentCalls > 2 };
    }
    if (system.includes("You grade one simulated phone call")) {
      return {
        checks: { feelings: { applies: false, pass: false, reason: "no hard moment" } },
        criteria: [{ id: "opens_with_knee", applies: true, pass: true, reason: 'Asked "ghutna kaisa hai"' }],
      };
    }
    // the agent under test
    assert(String(system).includes("Sunita"), "the prompt is filled with the scenario's variables");
    assert(String(system).includes("TEST HARNESS"));
    return "Ghutna kaisa hai?";
  });
}

Deno.test("a scenario is stepped in small pieces, then graded and saved", async () => {
  const w = world();
  const m = model();
  try {
    // The agent returns plain text, not JSON: the stub wraps whatever it is given.
    const first = await stepResult(w.client, "key", "res1", 2);
    assertEquals(first.done, false);
    assertEquals(w.tables.eval_results[0].status, "running");
    assertEquals(w.tables.eval_results[0].transcript.length, 5); // opening + 2 exchanges

    const second = await stepResult(w.client, "key", "res1", 2);
    assertEquals(second.done, true);
    const r = w.tables.eval_results[0];
    assertEquals([r.status, r.ended], ["done", "parent_hangup"]);
    assert(r.transcript[0].text === "Namaste Mummy Ji");
    const ids = r.grades.checks.map((c: any) => c.id);
    assertEquals(ids, ["talk_share", "closing_time", "feelings"]);
    assertEquals(r.grades.checks.find((c: any) => c.id === "feelings").pass, null);
    assertEquals(r.grades.criteria[0].pass, true);
    assertEquals(w.tables.eval_runs[0].status, "done");
  } finally {
    m.restore();
  }
});

Deno.test("a model failure is saved on the result, not lost", async () => {
  const w = world();
  const real = globalThis.fetch;
  globalThis.fetch = (() => Promise.resolve(new Response("rate limited", { status: 429 }))) as typeof fetch;
  try {
    let failed = false;
    try {
      await stepResult(w.client, "key", "res1", 2);
    } catch {
      failed = true;
    }
    assert(failed);
    assertEquals(w.tables.eval_results[0].status, "error");
    assert(String(w.tables.eval_results[0].error).includes("429"));
  } finally {
    globalThis.fetch = real;
  }
});

function stubAgent(message: Record<string, unknown>) {
  const real = globalThis.fetch;
  const bodies: any[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ choices: [{ message }], usage: { total_tokens: 7 } }), { status: 200 });
  }) as typeof fetch;
  return { bodies, restore: () => (globalThis.fetch = real) };
}

Deno.test("the agent has an end_interaction tool for hanging up only, and plain text never ends the call", async () => {
  const s = stubAgent({ content: "Main Anyaash hoon. Priya ne mujhe aapke liye set kiya hai." });
  try {
    const a = await agentTurn("key", "system", [t("agent", "Namaste"), t("parent", "Aap kaun?")]);
    assertEquals(a.ends, false);
    assertEquals(s.bodies[0].tools, [END_INTERACTION_TOOL]);
    assertEquals(END_INTERACTION_TOOL.function.name, "end_interaction");
    assert(END_INTERACTION_TOOL.function.description.includes("Never use it to say an ordinary reply"));
    assertEquals(s.bodies[0].reasoning_effort, "none"); // OpenAI refuses function tools with reasoning on
    assert(!String(s.bodies[0].messages[0].content).includes("END_CALL"));
  } finally {
    s.restore();
  }
});

Deno.test("calling end_interaction ends the call and its end_message is the last line spoken", async () => {
  const s = stubAgent({
    content: null,
    tool_calls: [{ type: "function", function: { name: "end_interaction", arguments: JSON.stringify({ end_message: "Kal phir baat karenge, Mummy Ji." }) } }],
  });
  try {
    const a = await agentTurn("key", "system", [t("agent", "Namaste"), t("parent", "Theek hai beta, chalo.")]);
    assertEquals([a.ends, a.text], [true, "Kal phir baat karenge, Mummy Ji."]);
    assertEquals(a.end, { said: "", end_message: "Kal phir baat karenge, Mummy Ji." });
  } finally {
    s.restore();
  }
});

Deno.test("the simulated parent gets the real-call examples, the hidden brief and one turn to say", async () => {
  const s = stubAgent({ content: JSON.stringify({ say: "हाँ, बोलिए।", hangup: false }) });
  try {
    const p = await parentTurn("key", { persona: "Sunita, wakes at five", behaviours: "Brief answers", language: "Hinglish" }, [t("agent", "नमस्ते")]);
    assertEquals([p.say, p.hangup], ["हाँ, बोलिए।", false]);
    const system = String(s.bodies[0].messages[0].content);
    const user = String(s.bodies[0].messages[1].content);
    assert(system.includes(REAL_PARENT_LINES[0]) && system.includes("Never give everything away at once"));
    assert(user.includes("WHO YOU ARE AND WHAT YOU KNOW (private, reveal only when asked):\nSunita, wakes at five"));
    assert(user.includes("Devanagari"), "Hinglish scenarios are spoken as a Devanagari transcript, like real calls");
    assertEquals(s.bodies[0].temperature, undefined);
  } finally {
    s.restore();
  }
});

Deno.test("the agent runs at Sarvam's temperature, and drops it if OpenAI refuses it", async () => {
  const real = globalThis.fetch;
  const bodies: any[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    bodies.push(body);
    if ("temperature" in body) {
      return new Response(JSON.stringify({ error: { message: "Unsupported parameter: 'temperature'", param: "temperature" } }), { status: 400 });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "हाँ जी।" } }], usage: { total_tokens: 3 } }), { status: 200 });
  }) as typeof fetch;
  try {
    const a = await agentTurn("key", "system", [t("agent", "नमस्ते"), t("parent", "हाँ")]);
    assertEquals(a.text, "हाँ जी।");
    assertEquals([bodies[0].temperature, "temperature" in bodies[1]], [0.5, false]);
    await agentTurn("key", "system", [t("agent", "नमस्ते"), t("parent", "हाँ")]);
    assertEquals(bodies.length, 3, "after one refusal, temperature is not sent again");
  } finally {
    globalThis.fetch = real;
  }
});
