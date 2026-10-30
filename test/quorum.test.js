import assert from "node:assert/strict";
import test from "node:test";
import { advance, createCheck, respond } from "../src/index.js";
import { accept, decline } from "./helpers.js";

const CHECK_KEYS = [
  "accepted",
  "deadline",
  "declined",
  "pending",
  "players",
  "reason",
  "required",
  "resolvedAt",
  "rule",
  "status",
  "timedOut"
];

test("the count usage reaches quorum on the second accept and then closes", () => {
  const check = createCheck({
    players: ["a", "b", "c"],
    deadline: 1000,
    rule: { type: "count", count: 2 }
  });
  assert.equal(check.required, 2);
  assert.equal(check.status, "open");
  assert.equal(check.reason, null);
  assert.equal(check.resolvedAt, null);
  assert.equal(check.deadline, 1000);
  assert.deepEqual(check.rule, { type: "count", count: 2 });
  assert.deepEqual(check.players, ["a", "b", "c"]);
  assert.deepEqual(check.pending, ["a", "b", "c"]);
  assert.deepEqual(check.accepted, []);
  assert.deepEqual(check.declined, []);
  assert.deepEqual(check.timedOut, []);
  assert.deepEqual(Object.keys(check).sort(), CHECK_KEYS);
  assert.equal(Object.isFrozen(check), true);
  assert.equal(Object.isFrozen(check.players), true);
  assert.equal(Object.isFrozen(check.rule), true);

  const first = respond(check, accept("a", 100));
  assert.equal(first.result, "accepted");
  assert.equal(Object.isFrozen(first), true);
  assert.equal(first.check.status, "open");
  assert.equal(first.check.reason, null);
  assert.deepEqual(first.check.accepted, ["a"]);
  assert.deepEqual(first.check.pending, ["b", "c"]);
  assert.notEqual(first.check, check);
  assert.equal(check.status, "open");
  assert.deepEqual(check.pending, ["a", "b", "c"]);

  const second = respond(first.check, accept("b", 200));
  assert.equal(second.result, "passed");
  assert.equal(second.check.status, "passed");
  assert.equal(second.check.reason, "quorum");
  assert.deepEqual(second.check.accepted, ["a", "b"]);
  assert.deepEqual(second.check.pending, ["c"]);
  assert.deepEqual(second.check.declined, []);
  assert.deepEqual(second.check.timedOut, []);
  assert.equal(second.check.resolvedAt, 200);
  assert.equal(second.check.required, 2);
  assert.equal(first.check.status, "open");

  const late = respond(second.check, accept("c", 300));
  assert.equal(late.result, "closed");
  assert.equal(late.check, second.check);
  const earlier = advance(second.check, 0);
  assert.equal(earlier.result, "closed");
  assert.equal(earlier.check, second.check);
  const stranger = respond(second.check, decline("z", 5000));
  assert.equal(stranger.result, "closed");
  assert.equal(stranger.check, second.check);
});

test("the default rule is all, so one decline fails the check", () => {
  const vote = createCheck({
    players: ["a", "b", "c"],
    deadline: 1000
  });
  const explicit = createCheck({
    players: ["a", "b", "c"],
    deadline: 1000,
    rule: undefined
  });
  assert.deepEqual(vote.rule, { type: "all" });
  assert.deepEqual(explicit.rule, { type: "all" });
  assert.equal(vote.required, 3);
  assert.equal(explicit.required, 3);
  const no = respond(vote, decline("b", 50));
  assert.equal(no.result, "failed");
  assert.equal(no.check.status, "failed");
  assert.equal(no.check.reason, "decline");
  assert.deepEqual(no.check.declined, ["b"]);
  assert.deepEqual(no.check.pending, ["a", "c"]);
  assert.deepEqual(no.check.accepted, []);
  assert.deepEqual(no.check.timedOut, []);
  assert.equal(no.check.resolvedAt, 50);
  assert.equal(no.check.required, 3);
  assert.equal(vote.status, "open");
});

test("all of the roster must accept before an all-rule check passes", () => {
  const check = createCheck({ players: ["a", "b", "c"], deadline: 30 });
  const first = respond(check, accept("c", 1));
  assert.equal(first.result, "accepted");
  assert.deepEqual(first.check.accepted, ["c"]);
  const second = respond(first.check, accept("a", 2));
  assert.equal(second.result, "accepted");
  assert.deepEqual(second.check.accepted, ["a", "c"]);
  const third = respond(second.check, accept("b", 3));
  assert.equal(third.result, "passed");
  assert.deepEqual(third.check.accepted, ["a", "b", "c"]);
  assert.deepEqual(third.check.pending, []);
  assert.equal(third.check.resolvedAt, 3);
});

test("a count of one passes on the first accept and fails only when nobody can accept", () => {
  const check = createCheck({
    players: ["a", "b", "c"],
    deadline: 40,
    rule: { type: "count", count: 1 }
  });
  const passed = respond(check, accept("c", 2));
  assert.equal(passed.result, "passed");
  assert.deepEqual(passed.check.accepted, ["c"]);
  assert.deepEqual(passed.check.pending, ["a", "b"]);

  let open = check;
  const declined = [];
  for (const id of ["b", "a"]) {
    const step = respond(open, decline(id, declined.length + 1));
    declined.push(id);
    if (id === "b") {
      assert.equal(step.result, "declined");
      assert.equal(step.check.status, "open");
      assert.deepEqual(step.check.declined, ["b"]);
    }
    open = step.check;
  }
  const last = respond(open, decline("c", 3));
  assert.equal(last.result, "failed");
  assert.equal(last.check.reason, "decline");
  assert.deepEqual(last.check.declined, ["a", "b", "c"]);
  assert.deepEqual(last.check.pending, []);
  assert.equal(last.check.resolvedAt, 3);
});

test("count stays short of impossible until the remaining players drop below it", () => {
  const group = createCheck({
    players: ["a", "b", "c", "d"],
    deadline: 50,
    rule: { type: "count", count: 3 }
  });
  const one = respond(group, decline("d", 1));
  assert.equal(one.result, "declined");
  assert.equal(one.check.status, "open");
  assert.deepEqual(one.check.declined, ["d"]);
  assert.deepEqual(one.check.pending, ["a", "b", "c"]);
  const two = respond(one.check, decline("b", 2));
  assert.equal(two.result, "failed");
  assert.equal(two.check.reason, "decline");
  assert.deepEqual(two.check.declined, ["b", "d"]);
  assert.deepEqual(two.check.pending, ["a", "c"]);
  assert.deepEqual(two.check.accepted, []);
  assert.deepEqual(two.check.timedOut, []);
  assert.equal(two.check.resolvedAt, 2);
});

test("a fraction stores the caller value and requires the ceiling of the product", () => {
  const half = createCheck({
    players: ["a", "b", "c"],
    deadline: 10,
    rule: { type: "fraction", fraction: 0.5 }
  });
  assert.equal(half.required, 2);
  assert.equal(Math.ceil(3 * 0.5), 2);
  assert.deepEqual(half.rule, { type: "fraction", fraction: 0.5 });

  const tenth = createCheck({
    players: ["a", "b"],
    deadline: 10,
    rule: { type: "fraction", fraction: 0.1 }
  });
  assert.equal(tenth.required, 1);
  assert.equal(respond(tenth, accept("b", 1)).result, "passed");

  const seven = createCheck({
    players: ["a", "b", "c", "d", "e", "f", "g"],
    deadline: 10,
    rule: { type: "fraction", fraction: 0.3 }
  });
  assert.equal(Math.ceil(7 * 0.3), 3);
  assert.equal(seven.required, 3);

  const third = createCheck({
    players: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    deadline: 10,
    rule: { type: "fraction", fraction: 1 / 3 }
  });
  assert.equal(Math.ceil(10 * (1 / 3)), 4);
  assert.equal(third.required, 4);
  let open = third;
  const order = ["j", "a", "c", "b"];
  for (let index = 0; index < order.length; index += 1) {
    const step = respond(open, accept(order[index], index + 1));
    open = step.check;
    if (index < 3) {
      assert.equal(step.result, "accepted");
    } else {
      assert.equal(step.result, "passed");
      assert.equal(step.check.accepted.length, 4);
      assert.deepEqual(step.check.accepted, ["a", "b", "c", "j"]);
    }
  }

  let failing = third;
  for (let index = 0; index < 6; index += 1) {
    const step = respond(failing, decline(third.players[index], index + 1));
    assert.equal(step.result, "declined");
    failing = step.check;
  }
  const seventh = respond(failing, decline("g", 7));
  assert.equal(seventh.result, "failed");
  assert.equal(seventh.check.declined.length, 7);
  assert.equal(10 - seventh.check.declined.length < third.required, true);
});

test("count and fraction of the full roster keep their own rule type", () => {
  const counted = createCheck({
    players: ["a", "b"],
    deadline: 5,
    rule: { type: "count", count: 2 }
  });
  assert.equal(counted.required, 2);
  assert.equal(respond(counted, decline("a", 1)).result, "failed");
  const whole = createCheck({
    players: ["a", "b"],
    deadline: 5,
    rule: { type: "fraction", fraction: 1 }
  });
  assert.equal(whole.required, 2);
  assert.deepEqual(whole.rule, { type: "fraction", fraction: 1 });
  assert.equal(respond(whole, decline("b", 1)).check.reason, "decline");
});

test("roster order, not answer order, is how every list is reported", () => {
  const ordered = createCheck({
    players: ["c", "a", "b"],
    deadline: 10,
    rule: { type: "count", count: 2 }
  });
  const bFirst = respond(ordered, accept("b", 1));
  assert.equal(bFirst.result, "accepted");
  assert.deepEqual(bFirst.check.accepted, ["b"]);
  const aSecond = respond(bFirst.check, accept("a", 2));
  assert.equal(aSecond.result, "passed");
  assert.deepEqual(aSecond.check.accepted, ["a", "b"]);
  assert.deepEqual(aSecond.check.pending, ["c"]);
  assert.equal(aSecond.check.resolvedAt, 2);
});

test("a single player passes on accept and fails on decline", () => {
  const check = createCheck({ players: ["a"], deadline: 4 });
  assert.equal(respond(check, accept("a", 1)).result, "passed");
  const failed = respond(check, decline("a", 1));
  assert.equal(failed.result, "failed");
  assert.deepEqual(failed.check.declined, ["a"]);
  assert.deepEqual(failed.check.pending, []);
});

test("ids are exact, including prototype names and surrounding spaces", () => {
  const ids = ["__proto__", "constructor", "toString"];
  const check = createCheck({ players: ids, deadline: 5, rule: { type: "count", count: 2 } });
  const first = respond(check, accept("__proto__", 1));
  assert.equal(first.result, "accepted");
  assert.deepEqual(first.check.accepted, ["__proto__"]);
  assert.equal(Object.hasOwn(first.check, "__proto__"), false);
  const second = respond(first.check, accept("toString", 2));
  assert.equal(second.result, "passed");
  assert.deepEqual(second.check.accepted, ["__proto__", "toString"]);
  assert.deepEqual(second.check.pending, ["constructor"]);

  const spaced = createCheck({ players: [" "], deadline: 5 });
  assert.equal(respond(spaced, accept(" ", 1)).result, "passed");
  const upper = createCheck({ players: ["A"], deadline: 5 });
  assert.equal(respond(upper, accept("a", 1)).result, "unknown");
});

test("inputs are copied and unknown option or response fields are ignored", () => {
  const players = ["a", "b"];
  const rule = { type: "all", count: 0, fraction: 9, note: "x" };
  const options = { players, deadline: 5, rule, label: "ignored" };
  const check = createCheck(options);
  players.push("c");
  rule.type = "count";
  assert.deepEqual(check.players, ["a", "b"]);
  assert.deepEqual(check.rule, { type: "all" });
  assert.equal(Object.hasOwn(check, "label"), false);
  assert.equal(Object.is(check.deadline, 0), false);

  const negative = createCheck({ players: ["a"], deadline: -0 });
  assert.equal(Object.is(negative.deadline, 0), true);

  const response = accept("a", 1);
  response.note = "ignored";
  const outcome = respond(check, response);
  response.playerId = "b";
  assert.deepEqual(outcome.check.accepted, ["a"]);
  assert.equal(Object.hasOwn(outcome.check, "note"), false);

  const counted = createCheck({
    players: ["a", "b", "c"],
    deadline: 5,
    rule: { type: "count", count: 1, fraction: 0.2, extra: true }
  });
  assert.deepEqual(counted.rule, { type: "count", count: 1 });
  const fractional = createCheck({
    players: ["a", "b"],
    deadline: 5,
    rule: { type: "fraction", fraction: 0.5, count: 9 }
  });
  assert.deepEqual(fractional.rule, { type: "fraction", fraction: 0.5 });
});

test("the same calls produce deep-equal checks and a plain copy still responds", () => {
  const options = {
    players: ["a", "b", "c"],
    deadline: 10,
    rule: { type: "count", count: 2 }
  };
  const left = respond(createCheck(options), accept("c", 4));
  const right = respond(createCheck(options), accept("c", 4));
  assert.deepEqual(left, right);
  assert.notEqual(left.check, right.check);

  const clone = JSON.parse(JSON.stringify(left.check));
  const next = respond(clone, accept("a", 5));
  assert.equal(next.result, "passed");
  assert.deepEqual(next.check.accepted, ["a", "c"]);
  assert.throws(() => {
    next.check.accepted.push("b");
  }, TypeError);
});

test("a tiny positive fraction still requires one accept", () => {
  const check = createCheck({
    players: ["a", "b", "c"],
    deadline: 3,
    rule: { type: "fraction", fraction: Number.MIN_VALUE }
  });
  assert.equal(check.required, 1);
  assert.equal(respond(check, accept("a", 1)).result, "passed");
});
