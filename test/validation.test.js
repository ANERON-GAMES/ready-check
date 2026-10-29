import assert from "node:assert/strict";
import test from "node:test";
import { advance, createCheck, respond } from "../src/index.js";
import { accept, decline, rawCheck, without } from "./helpers.js";

const FIELDS =
  "check fields must be status, reason, deadline, required, rule, players, accepted, declined, timedOut, pending, and resolvedAt";

test("createCheck rejects a bad options object before it reads fields", () => {
  assert.throws(() => createCheck(), {
    name: "TypeError",
    message: "options must be an object"
  });
  assert.throws(() => createCheck(undefined), TypeError);
  assert.throws(() => createCheck(null), TypeError);
  assert.throws(() => createCheck([]), TypeError);
  assert.throws(() => createCheck("players"), TypeError);
  assert.throws(() => createCheck(1), TypeError);
});

test("createCheck reads players, then deadline, then rule", () => {
  assert.throws(() => createCheck({}), {
    name: "TypeError",
    message: "players must be a non-empty array"
  });
  assert.throws(() => createCheck({ deadline: Number.NaN }), {
    name: "TypeError",
    message: "players must be a non-empty array"
  });
  assert.throws(
    () => createCheck({ players: [], deadline: 1, rule: { type: "count", count: 0 } }),
    {
      name: "TypeError",
      message: "players must be a non-empty array"
    }
  );
  assert.throws(() => createCheck({ players: "ab", deadline: 1 }), {
    name: "TypeError",
    message: "players must be a non-empty array"
  });
  assert.throws(() => createCheck({ players: [""], deadline: 1 }), {
    name: "TypeError",
    message: "player id must be a non-empty string"
  });
  assert.throws(() => createCheck({ players: ["a", ""], deadline: 1 }), {
    name: "TypeError",
    message: "player id must be a non-empty string"
  });
  assert.throws(() => createCheck({ players: ["a", 1], deadline: 1 }), TypeError);
  assert.throws(() => createCheck({ players: ["a", "a"], deadline: 1 }), {
    name: "TypeError",
    message: "player ids must be unique"
  });
  assert.throws(() => createCheck({ players: ["b", "a", "b"], deadline: 1 }), TypeError);
  assert.throws(() => createCheck({ players: ["a"] }), {
    name: "RangeError",
    message: "deadline must be a finite number"
  });
  assert.throws(() => createCheck({ players: ["a"], deadline: undefined }), RangeError);
  assert.throws(() => createCheck({ players: ["a"], deadline: null }), RangeError);
  assert.throws(() => createCheck({ players: ["a"], deadline: "10" }), RangeError);
  assert.throws(() => createCheck({ players: ["a"], deadline: Number.NaN }), RangeError);
  assert.throws(
    () => createCheck({ players: ["a"], deadline: Number.POSITIVE_INFINITY }),
    RangeError
  );
  assert.throws(
    () => createCheck({ players: ["a"], deadline: Number.NEGATIVE_INFINITY }),
    RangeError
  );
  assert.throws(() => createCheck({ players: ["a", "b"], deadline: 10, rule: null }), {
    name: "TypeError",
    message: "rule must be an object"
  });
  assert.throws(() => createCheck({ players: ["a"], deadline: 10, rule: [] }), TypeError);
  assert.throws(() => createCheck({ players: ["a"], deadline: 10, rule: "all" }), TypeError);
  assert.throws(() => createCheck({ players: ["a"], deadline: 10, rule: {} }), {
    name: "TypeError",
    message: "rule type must be all, count, or fraction"
  });
  assert.throws(
    () => createCheck({ players: ["a"], deadline: 10, rule: { type: "ALL" } }),
    TypeError
  );
  assert.throws(
    () => createCheck({ players: ["a"], deadline: 10, rule: { type: "most" } }),
    TypeError
  );
  assert.throws(() => createCheck({ players: ["a"], deadline: 10, rule: { type: 1 } }), TypeError);
});

test("count and fraction rules reject values outside their range", () => {
  const base = { players: ["a", "b"], deadline: 10 };
  assert.throws(() => createCheck({ ...base, rule: { type: "count" } }), {
    name: "RangeError",
    message: "count must be an integer from 1 to the number of players"
  });
  for (const count of [0, -1, 3, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "1", null, true]) {
    assert.throws(
      () => createCheck({ ...base, rule: { type: "count", count } }),
      RangeError,
      String(count)
    );
  }
  assert.throws(() => createCheck({ ...base, rule: { type: "fraction" } }), {
    name: "RangeError",
    message: "fraction must be a finite number greater than 0 and less than or equal to 1"
  });
  for (const fraction of [
    0,
    -0.1,
    1.0000001,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "0.5",
    null,
    true
  ]) {
    assert.throws(
      () => createCheck({ ...base, rule: { type: "fraction", fraction } }),
      RangeError,
      String(fraction)
    );
  }
});

test("respond and advance validate the check before the event", () => {
  const check = createCheck({ players: ["a"], deadline: 5 });
  assert.throws(() => respond(null, accept("a", 1)), {
    name: "TypeError",
    message: "check must be an object"
  });
  assert.throws(() => respond([], accept("a", 1)), TypeError);
  assert.throws(() => respond("check", accept("a", 1)), TypeError);
  assert.throws(() => advance(null, 1), {
    name: "TypeError",
    message: "check must be an object"
  });
  assert.throws(() => respond(without(rawCheck(), "status"), accept("a", 1)), {
    name: "TypeError",
    message: FIELDS
  });
  assert.throws(() => respond({ ...rawCheck(), label: "x" }, accept("a", 1)), {
    name: "TypeError",
    message: FIELDS
  });
  assert.throws(() => respond(rawCheck({ status: "OPEN" }), accept("a", 1)), {
    name: "TypeError",
    message: "status must be open, passed, or failed"
  });
  assert.throws(() => respond(rawCheck({ status: "done" }), accept("a", 1)), TypeError);
  assert.throws(() => advance(check), {
    name: "RangeError",
    message: "now must be a finite number"
  });
  assert.throws(() => respond(check, null), {
    name: "TypeError",
    message: "response must be an object"
  });
});

test("a response rejects a bad player, decision, or time in that order", () => {
  const check = createCheck({ players: ["a", "b"], deadline: 10 });
  assert.throws(() => respond(check, []), {
    name: "TypeError",
    message: "response must be an object"
  });
  assert.throws(() => respond(check, { decision: "accept", now: 1 }), {
    name: "TypeError",
    message: "player id must be a non-empty string"
  });
  assert.throws(() => respond(check, { playerId: "", decision: "nope", now: Number.NaN }), {
    name: "TypeError",
    message: "player id must be a non-empty string"
  });
  assert.throws(() => respond(check, { playerId: 1, decision: "accept", now: 1 }), TypeError);
  assert.throws(() => respond(check, { playerId: "a", now: 1 }), {
    name: "TypeError",
    message: "decision must be accept or decline"
  });
  assert.throws(() => respond(check, { playerId: "a", decision: "Accept", now: 1 }), TypeError);
  assert.throws(
    () => respond(check, { playerId: "a", decision: "ACCEPT", now: Number.NaN }),
    TypeError
  );
  assert.throws(() => respond(check, { playerId: "a", decision: "accept" }), {
    name: "RangeError",
    message: "now must be a finite number"
  });
  for (const now of [Number.NaN, Number.POSITIVE_INFINITY, "1", null, true]) {
    assert.throws(() => respond(check, accept("a", now)), {
      name: "RangeError",
      message: "now must be a finite number"
    });
    assert.throws(() => advance(check, now), RangeError);
  }
});

test("stored player lists and the roster are validated before the rule", () => {
  assert.throws(() => respond(rawCheck({ players: [] }), accept("a", 1)), {
    name: "TypeError",
    message: "players must be a non-empty array"
  });
  assert.throws(() => respond(rawCheck({ players: ["a", ""] }), accept("a", 1)), {
    name: "TypeError",
    message: "player id must be a non-empty string"
  });
  assert.throws(() => respond(rawCheck({ players: ["a", "a"] }), accept("a", 1)), {
    name: "TypeError",
    message: "player ids must be unique"
  });
  assert.throws(() => respond(rawCheck({ deadline: Number.NaN }), accept("a", 1)), {
    name: "RangeError",
    message: "deadline must be a finite number"
  });
  assert.throws(() => respond(rawCheck({ required: 0 }), accept("a", 1)), {
    name: "RangeError",
    message: "required must be an integer from 1 to the number of players"
  });
  assert.throws(() => respond(rawCheck({ required: 1.5 }), accept("a", 1)), RangeError);
  assert.throws(() => respond(rawCheck({ required: 4 }), accept("a", 1)), RangeError);
  assert.throws(() => respond(rawCheck({ accepted: "a" }), accept("a", 1)), {
    name: "TypeError",
    message: "accepted must be an array"
  });
  assert.throws(() => respond(rawCheck({ declined: null }), accept("a", 1)), {
    name: "TypeError",
    message: "declined must be an array"
  });
  assert.throws(() => respond(rawCheck({ timedOut: {} }), accept("a", 1)), {
    name: "TypeError",
    message: "timedOut must be an array"
  });
  assert.throws(() => respond(rawCheck({ pending: "abc" }), accept("a", 1)), {
    name: "TypeError",
    message: "pending must be an array"
  });
  assert.throws(() => respond(rawCheck({ accepted: [1], pending: ["b", "c"] }), accept("a", 1)), {
    name: "TypeError",
    message: "accepted must contain player ids"
  });
  assert.throws(() => respond(rawCheck({ pending: ["a", ""] }), accept("a", 1)), {
    name: "TypeError",
    message: "pending must contain player ids"
  });
  assert.throws(() => respond(rawCheck({ accepted: ["b", "a"], pending: ["c"] }), accept("a", 1)), {
    name: "TypeError",
    message: "player lists must partition the roster in roster order"
  });
  assert.throws(
    () => respond(rawCheck({ accepted: ["a"], pending: ["a", "b", "c"] }), accept("a", 1)),
    {
      name: "TypeError",
      message: "player lists must partition the roster in roster order"
    }
  );
  assert.throws(() => respond(rawCheck({ pending: ["a", "b"] }), accept("a", 1)), {
    name: "TypeError",
    message: "player lists must partition the roster in roster order"
  });
  assert.throws(() => respond(rawCheck({ accepted: ["z"], pending: ["b", "c"] }), accept("a", 1)), {
    name: "TypeError",
    message: "player lists must partition the roster in roster order"
  });
});

test("a stored rule must match its type and the required count", () => {
  assert.throws(() => respond(rawCheck({ rule: null }), accept("a", 1)), {
    name: "TypeError",
    message: "rule must be an object"
  });
  assert.throws(() => respond(rawCheck({ rule: [] }), accept("a", 1)), TypeError);
  assert.throws(() => respond(rawCheck({ required: 2, rule: { type: "all" } }), accept("a", 1)), {
    name: "TypeError",
    message: "rule must match its type and the required count"
  });
  assert.throws(
    () =>
      respond(
        rawCheck({
          required: 3,
          rule: { type: "count", count: 2 }
        }),
        accept("a", 1)
      ),
    {
      name: "TypeError",
      message: "rule must match its type and the required count"
    }
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          required: 2,
          rule: { type: "count", count: 2, extra: true }
        }),
        accept("a", 1)
      ),
    TypeError
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          required: 1,
          rule: { type: "fraction", fraction: 0.5 }
        }),
        accept("a", 1)
      ),
    {
      name: "TypeError",
      message: "rule must match its type and the required count"
    }
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          required: 2,
          rule: { type: "fraction", fraction: 2 }
        }),
        accept("a", 1)
      ),
    TypeError
  );
  assert.throws(() => respond(rawCheck({ rule: { type: "most" } }), accept("a", 1)), TypeError);
});

test("open, passed, and failed checks enforce their own invariants in order", () => {
  assert.throws(() => respond(rawCheck({ reason: "quorum" }), accept("a", 1)), {
    name: "TypeError",
    message: "reason must be null while the check is open"
  });
  assert.throws(() => respond(rawCheck({ resolvedAt: 1 }), accept("a", 1)), {
    name: "TypeError",
    message: "resolvedAt must be null while the check is open"
  });
  assert.throws(
    () =>
      respond(
        rawCheck({
          timedOut: ["c"],
          pending: ["a", "b"]
        }),
        accept("a", 1)
      ),
    {
      name: "TypeError",
      message: "an open check must have no timed-out players"
    }
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          accepted: ["a", "b", "c"],
          pending: []
        }),
        accept("a", 1)
      ),
    {
      name: "TypeError",
      message: "an open check must be short of the required accepts"
    }
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          declined: ["a", "b"],
          pending: ["c"]
        }),
        accept("a", 1)
      ),
    {
      name: "TypeError",
      message: "an open check must still be able to pass"
    }
  );

  const passed = {
    status: "passed",
    reason: null,
    required: 1,
    rule: { type: "count", count: 1 },
    accepted: ["a"],
    pending: ["b", "c"],
    resolvedAt: null
  };
  assert.throws(() => respond(rawCheck(passed), accept("a", 1)), {
    name: "TypeError",
    message: "reason must be quorum when the check passed"
  });
  assert.throws(() => respond(rawCheck({ ...passed, reason: "quorum" }), accept("a", 1)), {
    name: "RangeError",
    message: "resolvedAt must be a finite number"
  });
  assert.throws(
    () => respond(rawCheck({ ...passed, reason: "quorum", resolvedAt: 1000 }), accept("a", 1)),
    {
      name: "TypeError",
      message: "a passed check must resolve before the deadline"
    }
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          ...passed,
          reason: "quorum",
          resolvedAt: 1,
          accepted: ["a"],
          timedOut: ["b"],
          pending: ["c"]
        }),
        accept("a", 1)
      ),
    {
      name: "TypeError",
      message: "a passed check must have no timed-out players"
    }
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          ...passed,
          reason: "quorum",
          resolvedAt: 1,
          accepted: ["a", "b"],
          pending: ["c"]
        }),
        accept("a", 1)
      ),
    {
      name: "TypeError",
      message: "a passed check must have exactly the required accepts"
    }
  );

  const failed = {
    status: "failed",
    reason: "quorum",
    resolvedAt: null
  };
  assert.throws(() => respond(rawCheck(failed), accept("a", 1)), {
    name: "TypeError",
    message: "reason must be decline or deadline when the check failed"
  });
  assert.throws(
    () =>
      respond(
        rawCheck({
          status: "failed",
          reason: "decline",
          resolvedAt: null,
          declined: ["a", "b", "c"],
          pending: []
        }),
        accept("a", 1)
      ),
    {
      name: "RangeError",
      message: "resolvedAt must be a finite number"
    }
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          status: "failed",
          reason: "decline",
          resolvedAt: 1000,
          declined: ["a"],
          pending: ["b", "c"]
        }),
        decline("b", 1)
      ),
    {
      name: "TypeError",
      message: "a decline failure must resolve before the deadline"
    }
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          status: "failed",
          reason: "decline",
          resolvedAt: 1,
          required: 1,
          rule: { type: "count", count: 1 },
          declined: ["a"],
          timedOut: ["b"],
          pending: ["c"]
        }),
        accept("c", 1)
      ),
    {
      name: "TypeError",
      message: "a decline failure must have no timed-out players"
    }
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          status: "failed",
          reason: "decline",
          resolvedAt: 1,
          required: 2,
          rule: { type: "count", count: 2 },
          declined: ["a"],
          pending: ["b", "c"]
        }),
        accept("b", 1)
      ),
    {
      name: "TypeError",
      message: "a decline failure must make passing impossible"
    }
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          status: "failed",
          reason: "deadline",
          resolvedAt: 999,
          timedOut: ["a", "b", "c"],
          pending: []
        }),
        accept("a", 1)
      ),
    {
      name: "TypeError",
      message: "a deadline failure must resolve at or after the deadline"
    }
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          status: "failed",
          reason: "deadline",
          resolvedAt: 1000,
          required: 2,
          rule: { type: "count", count: 2 },
          accepted: ["a", "b"],
          pending: ["c"]
        }),
        accept("c", 1)
      ),
    {
      name: "TypeError",
      message: "a deadline failure must have no pending players"
    }
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          status: "failed",
          reason: "deadline",
          resolvedAt: 1000,
          deadline: 5,
          declined: ["a", "b"],
          pending: [],
          players: ["a", "b"],
          required: 2,
          rule: { type: "all" }
        }),
        accept("a", 1)
      ),
    {
      name: "TypeError",
      message: "a deadline failure must have timed-out players"
    }
  );
  assert.throws(
    () =>
      respond(
        rawCheck({
          status: "failed",
          reason: "deadline",
          resolvedAt: 10,
          deadline: 10,
          required: 2,
          rule: { type: "count", count: 2 },
          accepted: ["a", "b"],
          timedOut: ["c"],
          pending: []
        }),
        accept("c", 1)
      ),
    {
      name: "TypeError",
      message: "a deadline failure must be short of the required accepts"
    }
  );
});

test("a structurally valid hand-built check can accept a player", () => {
  const check = rawCheck({
    required: 2,
    rule: { type: "fraction", fraction: 0.5 }
  });
  const outcome = respond(check, accept("b", 4));
  assert.equal(outcome.result, "accepted");
  assert.deepEqual(outcome.check.accepted, ["b"]);
  assert.deepEqual(check.pending, ["a", "b", "c"]);
  assert.equal(check.status, "open");
});
