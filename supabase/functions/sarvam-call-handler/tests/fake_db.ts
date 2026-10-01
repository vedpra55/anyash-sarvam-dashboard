/**
 * An in-memory stand-in for the parts of supabase-js the memory code uses.
 * It enforces the two database rules that matter here: memory_events is
 * append-only, and a parent has one current profile fact per block/key.
 */
type Row = Record<string, any>;

export function fakeDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }));
  let seq = 0;
  const newId = (t: string) => `${t}-${++seq}`;

  const get = (row: Row, col: string) => row[col];

  function query(table: string) {
    const rows = () => (tables[table] ||= []);
    const filters: ((r: Row) => boolean)[] = [];
    let op: "select" | "insert" | "update" | "upsert" = "select";
    let payload: any = null;
    let order: { col: string; asc: boolean } | null = null;
    let limit: number | null = null;
    let returning = false;

    const matching = () => rows().filter((r) => filters.every((f) => f(r)));

    function checkFacts() {
      if (table !== "profile_facts") return;
      const seen = new Set<string>();
      for (const r of rows()) {
        if (r.valid_to !== null && r.valid_to !== undefined) continue;
        const k = `${r.parent_id}/${r.block}/${r.key}`;
        if (seen.has(k)) throw new Error(`duplicate current fact ${k}`);
        seen.add(k);
      }
    }

    function run(): { data: any; error: any; count?: number } {
      try {
        if (op === "insert") {
          const list = (Array.isArray(payload) ? payload : [payload]).map((p: Row) => ({
            id: newId(table),
            created_at: new Date(Date.now() + seq).toISOString(),
            valid_to: table === "profile_facts" ? null : undefined,
            ...p,
          }));
          rows().push(...list);
          checkFacts();
          return { data: returning ? list : null, error: null };
        }
        if (op === "update") {
          if (table === "memory_events") throw new Error("memory_events is append-only");
          const hit = matching();
          for (const r of hit) Object.assign(r, payload);
          checkFacts();
          return { data: returning ? hit : null, error: null };
        }
        let out = matching();
        if (order) {
          const { col, asc } = order;
          out = [...out].sort((a, b) => (get(a, col) > get(b, col) ? 1 : get(a, col) < get(b, col) ? -1 : 0) * (asc ? 1 : -1));
        }
        if (limit !== null) out = out.slice(0, limit);
        return { data: out, error: null, count: out.length };
      } catch (error) {
        return { data: null, error };
      }
    }

    const b: any = {
      select: () => {
        if (op !== "select") returning = true;
        return b;
      },
      insert: (p: any) => ((op = "insert"), (payload = p), b),
      update: (p: any) => ((op = "update"), (payload = p), b),
      eq: (c: string, v: any) => (filters.push((r) => get(r, c) === v), b),
      neq: (c: string, v: any) => (filters.push((r) => get(r, c) !== v), b),
      in: (c: string, vs: any[]) => (filters.push((r) => vs.includes(get(r, c))), b),
      is: (c: string, v: any) => (filters.push((r) => (v === null ? get(r, c) == null : get(r, c) === v)), b),
      not: (c: string, operator: string, v: any) => {
        if (operator === "is" && v === null) filters.push((r) => get(r, c) != null);
        return b;
      },
      gte: (c: string, v: any) => (filters.push((r) => get(r, c) >= v), b),
      lte: (c: string, v: any) => (filters.push((r) => get(r, c) <= v), b),
      order: (col: string, opts?: { ascending?: boolean }) => ((order = { col, asc: opts?.ascending !== false }), b),
      limit: (n: number) => ((limit = n), b),
      maybeSingle: () => {
        const r = run();
        return Promise.resolve({ ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data });
      },
      single: () => {
        const r = run();
        return Promise.resolve({ ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data });
      },
      then: (ok: any, bad: any) => Promise.resolve(run()).then(ok, bad),
    };
    return b;
  }

  return { client: { from: query } as any, tables };
}

/**
 * Replaces fetch for OpenAI calls: `answer(systemPrompt, userPayload)` returns
 * the JSON the model "says". Returns a restore function.
 */
export function stubModel(answer: (system: string, user: any) => unknown) {
  const real = globalThis.fetch;
  const calls: { system: string; user: string }[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const system = body.messages[0].content as string;
    const userText = body.messages[1].content as string;
    calls.push({ system, user: userText });
    let user: any = userText;
    try {
      user = JSON.parse(userText.split("\n\nYour previous brief")[0]);
    } catch { /* retry feedback */ }
    const out = answer(system, user);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(out) } }], usage: {} }), { status: 200 });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = real) };
}
