import assert from "node:assert/strict";
import test from "node:test";
import { advance, createCheck, respond } from "../src/index.js";
import { accept, decline } from "./helpers.js";

test("the fraction usage expires at the deadline and rejects late, unknown, and duplicate votes", () => {
  const lobby = createCheck({
    players: ["a", "b", "c"],
    deadline: 1000,
    rule: { type: "fraction", fraction: 0.5 }
  });
  assert.equal(lobby.required, 2);
  const yes = respond(lobby, accept("a", 400));
  assert.equal(yes.result, "accepted");
  assert.deepEqual(yes.check.accepted, ["a"]);
  assert.deepEqual(yes.check.pending, ["b", "c"]);

  const stranger = respond(yes.check, decline("z", 450));
  assert.equal(stranger.result, "unknown");
  assert.equal(stranger.check, yes.check);
  const again = respond(yes.check, decline("a", 450));
  assert.equal(again.result, "duplicate");
  assert.equal(again.check, yes.check);
  const early = advance(yes.check, 999);
  assert.equal(early.result, "waiting");
  assert.equal(early.check, yes.check);

  const tooLate = respond(yes.check, accept("b", 1000));
  assert.equal(tooLate.result, "expired");
  assert.equal(tooLate.check.status, "failed");
  assert.equal(tooLate.check.reason, "deadline");
  assert.deepEqual(tooLate.check.accepted, ["a"]);
  assert.deepEqual(tooLate.check.declined, []);
  assert.deepEqual(tooLate.check.timedOut, ["b", "c"]);
  assert.deepEqual(tooLate.check.pending, []);
  assert.equal(tooLate.check.resolvedAt, 1000);
  assert.equal(yes.check.status, "open");

  const timed = advance(yes.check, 1000);
  assert.equal(timed.result, "expired");
  assert.deepEqual(timed.check.timedOut, ["b", "c"]);
  assert.equal(timed.check.resolvedAt, 1000);
  assert.deepEqual(timed.check.accepted, ["a"]);
  assert.notEqual(timed.check, tooLate.check);
  assert.deepEqual(timed.check.accepted, tooLate.check.accepted);
  assert.deepEqual(timed.check.timedOut, tooLate.check.timedOut);

  const after = advance(timed.check, 1001);
  assert.equal(after.result, "closed");
  assert.equal(after.check, timed.check);
});

test("expiry wins over an unknown player and over a duplicate vote", () => {
  const check = createCheck({
    players: ["a", "b", "c"],
    deadline: 1000,
    rule: { type: "count", count: 2 }
  });
  const missed = respond(check, accept("z", 1000));
  assert.equal(missed.result, "expired");
  assert.deepEqual(missed.check.timedOut, ["a", "b", "c"]);
  assert.deepEqual(missed.check.accepted, []);

  const first = respond(check, accept("a", 100));
  const duplicate = respond(first.check, decline("a", 1000));
  assert.equal(duplicate.result, "expired");
  assert.deepEqual(duplicate.check.accepted, ["a"]);
  assert.deepEqual(duplicate.check.declined, []);
  assert.deepEqual(duplicate.check.timedOut, ["b", "c"]);
});

test("a deadline failure keeps earlier answers and times out the rest in roster order", () => {
  const room = createCheck({
    players: ["a", "b", "c", "d"],
    deadline: 80,
    rule: { type: "count", count: 3 }
  });
  const accepted = respond(room, accept("c", 10));
  const declined = respond(accepted.check, decline("a", 20));
  assert.equal(declined.result, "declined");
  assert.equal(declined.check.status, "open");
  const waiting = advance(declined.check, 79);
  assert.equal(waiting.result, "waiting");
  assert.equal(waiting.check, declined.check);
  const ended = advance(declined.check, 90);
  assert.equal(ended.result, "expired");
  assert.equal(ended.check.status, "failed");
  assert.equal(ended.check.reason, "deadline");
  assert.deepEqual(ended.check.accepted, ["c"]);
  assert.deepEqual(ended.check.declined, ["a"]);
  assert.deepEqual(ended.check.timedOut, ["b", "d"]);
  assert.deepEqual(ended.check.pending, []);
  assert.equal(ended.check.resolvedAt, 90);
  const boundary = advance(declined.check, 80);
  assert.equal(boundary.result, "expired");
  assert.equal(boundary.check.resolvedAt, 80);
});

test("an accept that would have passed does not count once now has reached the deadline", () => {
  const check = createCheck({
    players: ["a", "b"],
    deadline: 10,
    rule: { type: "count", count: 1 }
  });
  const late = respond(check, accept("a", 10));
  assert.equal(late.result, "expired");
  assert.deepEqual(late.check.accepted, []);
  assert.deepEqual(late.check.timedOut, ["a", "b"]);
  assert.equal(late.check.status, "failed");
  const onTime = respond(check, accept("a", 9.5));
  assert.equal(onTime.result, "passed");
  assert.equal(onTime.check.resolvedAt, 9.5);
});

test("time is not required to be an integer or to move forward", () => {
  const check = createCheck({
    players: ["a", "b"],
    deadline: 10.5,
    rule: { type: "count", count: 2 }
  });
  const early = advance(check, 10.49);
  assert.equal(early.result, "waiting");
  const first = respond(check, accept("a", 10.49));
  assert.equal(first.result, "accepted");
  const laterNow = respond(first.check, accept("b", 1));
  assert.equal(laterNow.result, "passed");
  assert.equal(laterNow.check.resolvedAt, 1);
  const exact = advance(check, 10.5);
  assert.equal(exact.result, "expired");
  assert.equal(exact.check.resolvedAt, 10.5);
});

test("negative deadlines and a deadline of zero compare as finite numbers", () => {
  const check = createCheck({ players: ["a", "b"], deadline: -5 });
  assert.equal(advance(check, -6).result, "waiting");
  const expired = advance(check, -5);
  assert.equal(expired.result, "expired");
  assert.deepEqual(expired.check.timedOut, ["a", "b"]);
  assert.equal(expired.check.resolvedAt, -5);

  const zero = createCheck({ players: ["a"], deadline: 0 });
  assert.equal(respond(zero, accept("a", -1)).result, "passed");
  assert.equal(advance(zero, 0).result, "expired");
  assert.equal(respond(zero, accept("a", -0)).result, "expired");
});

test("advance before the deadline does not copy the check", () => {
  const check = createCheck({
    players: ["a", "b"],
    deadline: 8,
    rule: { type: "fraction", fraction: 0.5 }
  });
  const first = advance(check, -100);
  const second = advance(first.check, 7);
  assert.equal(first.result, "waiting");
  assert.equal(second.result, "waiting");
  assert.equal(second.check, check);
  assert.equal(check.required, 1);
});

test("a check stays open until a call observes the deadline", () => {
  const check = createCheck({ players: ["a"], deadline: -10 });
  assert.equal(check.status, "open");
  assert.equal(check.resolvedAt, null);
  const ended = advance(check, 0);
  assert.equal(ended.check.status, "failed");
  assert.equal(ended.check.resolvedAt, 0);
  assert.notEqual(ended.check.resolvedAt, check.deadline);
});
