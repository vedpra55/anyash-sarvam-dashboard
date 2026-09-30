import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMemory, diffMemory } from "../lib/memory";

const V2 = `LAST UPDATED: Wed, 30 Sep 2026 | CALL COUNT: 5
BASELINE: Poonam | Child: Ved | No regular medicines
ROUTINE: Wakes 5 am; dinner 9 pm
PERSONAL: Lives with son Ved's family; grandson Aarav; enjoys bhajans

ROLLING LOG (LAST 2-3 CALLS):
• Wed, 30 Sep 2026 (Call #4):
  - Sleep: slept well

ACTIVE WATCHLIST:
- knee pain on stairs
LIFE THREADS:
- power cut and heat yesterday`;

test("parses the Phase 1 memory: LAST UPDATED, PERSONAL, LIFE THREADS", () => {
  const m = parseMemory(V2);
  assert.equal(m.today, "Wed, 30 Sep 2026");
  assert.equal(m.callCount, 5);
  assert.deepEqual(m.personal, ["Lives with son Ved's family", "grandson Aarav", "enjoys bhajans"]);
  assert.deepEqual(m.watchlist, ["knee pain on stairs"]);
  assert.deepEqual(m.lifeThreads, ["power cut and heat yesterday"]);
  assert.deepEqual(m.other, []);
});

test("older TODAY memories still parse, and placeholders are dropped", () => {
  const m = parseMemory("TODAY: Mon, Sep 28, 2026 | CALL COUNT: 4\nPERSONAL: not shared yet\nACTIVE WATCHLIST:\n- none yet\nLIFE THREADS:\n- none");
  assert.equal(m.today, "Mon, Sep 28, 2026");
  assert.deepEqual(m.personal, []);
  assert.deepEqual(m.watchlist, []);
  assert.deepEqual(m.lifeThreads, []);
});

test("diff reports new and closed life threads and personal changes", () => {
  const before = parseMemory(V2);
  const after = parseMemory(
    V2.replace("- power cut and heat yesterday", "- grandson visiting Sunday").replace("enjoys bhajans", "enjoys bhajans and gardening"),
  );
  const d = diffMemory(before, after);
  assert.deepEqual(d.lifeThreadsAdded, ["grandson visiting Sunday"]);
  assert.deepEqual(d.lifeThreadsClosed, ["power cut and heat yesterday"]);
  assert.equal(d.personalChanged, true);
  assert.equal(d.baselineChanged, false);
});
