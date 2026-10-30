import assert from "node:assert/strict";
import test from "node:test";
import { RESULTS, advance, createCheck, respond } from "../src/index.js";
import { accept, decline } from "./helpers.js";

test("unknown and duplicate leave the same check, and a second decision cannot replace the first", () => {
  const check = createCheck({
    players: ["a", "b", "c"],
    deadline: 20,
    rule: { type: "count", count: 2 }
  });
  const first = respond(check, accept("b", 2));
  const unknown = respond(first.check, decline("d", 3));
  assert.equal(unknown.result, "unknown");
  assert.equal(unknown.check, first.check);
  const same = respond(first.check, accept("b", 4));
  assert.equal(same.result, "duplicate");
  assert.equal(same.check, first.check);
  const flipped = respond(first.check, decline("b", 4));
  assert.equal(flipped.result, "duplicate");
  assert.deepEqual(first.check.accepted, ["b"]);
  assert.deepEqual(first.check.declined, []);
});

test("every result code produced by the usage rules is one of RESULTS", () => {
  const seen = new Set();
  const check = createCheck({
    players: ["a", "b", "c", "d"],
    deadline: 100,
    rule: { type: "count", count: 2 }
  });
  seen.add(advance(check, 0).result);
  const accepted = respond(check, accept("d", 1));
  seen.add(accepted.result);
  seen.add(respond(accepted.check, accept("d", 2)).result);
  seen.add(respond(accepted.check, decline("missing", 2)).result);
  const declined = respond(accepted.check, decline("a", 3));
  seen.add(declined.result);
  const passed = respond(declined.check, accept("b", 4));
  seen.add(passed.result);
  seen.add(respond(passed.check, accept("c", 5)).result);

  const other = createCheck({ players: ["a", "b", "c"], deadline: 10 });
  seen.add(respond(other, decline("a", 1)).result);
  seen.add(advance(createCheck({ players: ["a"], deadline: 1 }), 1).result);

  assert.deepEqual(Array.from(seen).sort(), Array.from(RESULTS).sort());
  for (const result of seen) {
    assert.equal(RESULTS.includes(result), true);
  }
});

test("a decline that is still short of impossible stays open", () => {
  const check = createCheck({
    players: ["a", "b", "c", "d"],
    deadline: 30,
    rule: { type: "fraction", fraction: 0.5 }
  });
  assert.equal(check.required, 2);
  const step = respond(check, decline("c", 5));
  assert.equal(step.result, "declined");
  assert.equal(step.check.status, "open");
  assert.deepEqual(step.check.declined, ["c"]);
  assert.deepEqual(step.check.pending, ["a", "b", "d"]);
  assert.equal(step.check.resolvedAt, null);
});

test("five players on the all rule fail on the first decline", () => {
  const check = createCheck({
    players: ["a", "b", "c", "d", "e"],
    deadline: 12
  });
  const failed = respond(check, decline("e", 6));
  assert.equal(failed.result, "failed");
  assert.deepEqual(failed.check.declined, ["e"]);
  assert.deepEqual(failed.check.pending, ["a", "b", "c", "d"]);
  assert.equal(failed.check.resolvedAt, 6);
});

test("repeated runs do not share list or rule objects", () => {
  const first = createCheck({
    players: ["a", "b"],
    deadline: 3,
    rule: { type: "count", count: 1 }
  });
  const second = createCheck({
    players: ["a", "b"],
    deadline: 3,
    rule: { type: "count", count: 1 }
  });
  assert.notEqual(first.players, second.players);
  assert.notEqual(first.rule, second.rule);
  assert.notEqual(first.pending, second.pending);
  const answered = respond(first, accept("a", 1));
  assert.notEqual(answered.check.players, first.players);
  assert.notEqual(answered.check.rule, first.rule);
  assert.deepEqual(answered.check.players, first.players);
  assert.equal(second.status, "open");
  assert.deepEqual(second.accepted, []);
});
