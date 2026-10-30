import { DEADLINE, DECLINE, FAILED, OPEN, PASSED, QUORUM } from "./constants.js";
import { assertStoredRule } from "./rule.js";
import {
  assertExactKeys,
  assertIdList,
  assertPartition,
  assertPlayers,
  isObject,
  readFinite
} from "./shape.js";

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

const CHECK_FIELDS_MESSAGE =
  "check fields must be status, reason, deadline, required, rule, players, accepted, declined, timedOut, pending, and resolvedAt";

export function assertCheck(check) {
  if (!isObject(check)) {
    throw new TypeError("check must be an object");
  }
  assertExactKeys(check, CHECK_KEYS, CHECK_FIELDS_MESSAGE);
  if (check.status !== OPEN && check.status !== PASSED && check.status !== FAILED) {
    throw new TypeError("status must be open, passed, or failed");
  }
  assertPlayers(check.players);
  const deadline = readFinite(check.deadline, "deadline must be a finite number");
  if (
    !Number.isInteger(check.required) ||
    check.required < 1 ||
    check.required > check.players.length
  ) {
    throw new RangeError("required must be an integer from 1 to the number of players");
  }
  assertIdList(check.accepted, "accepted");
  assertIdList(check.declined, "declined");
  assertIdList(check.timedOut, "timedOut");
  assertIdList(check.pending, "pending");
  assertPartition(check.players, check.accepted, check.declined, check.timedOut, check.pending);
  assertStoredRule(check);
  if (check.status === OPEN) {
    assertOpen(check);
    return check;
  }
  if (check.status === PASSED) {
    if (check.reason !== QUORUM) {
      throw new TypeError("reason must be quorum when the check passed");
    }
  } else if (check.reason !== DECLINE && check.reason !== DEADLINE) {
    throw new TypeError("reason must be decline or deadline when the check failed");
  }
  const resolvedAt = readFinite(check.resolvedAt, "resolvedAt must be a finite number");
  if (check.status === PASSED) {
    assertPassed(check, deadline, resolvedAt);
    return check;
  }
  assertFailed(check, deadline, resolvedAt);
  return check;
}

function assertOpen(check) {
  if (check.reason !== null) {
    throw new TypeError("reason must be null while the check is open");
  }
  if (check.resolvedAt !== null) {
    throw new TypeError("resolvedAt must be null while the check is open");
  }
  if (check.timedOut.length !== 0) {
    throw new TypeError("an open check must have no timed-out players");
  }
  if (check.accepted.length >= check.required) {
    throw new TypeError("an open check must be short of the required accepts");
  }
  if (check.players.length - check.declined.length < check.required) {
    throw new TypeError("an open check must still be able to pass");
  }
}

function assertPassed(check, deadline, resolvedAt) {
  if (resolvedAt >= deadline) {
    throw new TypeError("a passed check must resolve before the deadline");
  }
  if (check.timedOut.length !== 0) {
    throw new TypeError("a passed check must have no timed-out players");
  }
  if (check.accepted.length !== check.required) {
    throw new TypeError("a passed check must have exactly the required accepts");
  }
}

function assertFailed(check, deadline, resolvedAt) {
  if (check.reason === DECLINE) {
    if (resolvedAt >= deadline) {
      throw new TypeError("a decline failure must resolve before the deadline");
    }
    if (check.timedOut.length !== 0) {
      throw new TypeError("a decline failure must have no timed-out players");
    }
    if (check.players.length - check.declined.length >= check.required) {
      throw new TypeError("a decline failure must make passing impossible");
    }
    return;
  }
  if (resolvedAt < deadline) {
    throw new TypeError("a deadline failure must resolve at or after the deadline");
  }
  if (check.pending.length !== 0) {
    throw new TypeError("a deadline failure must have no pending players");
  }
  if (check.timedOut.length === 0) {
    throw new TypeError("a deadline failure must have timed-out players");
  }
  if (check.accepted.length >= check.required) {
    throw new TypeError("a deadline failure must be short of the required accepts");
  }
}
