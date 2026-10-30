import {
  ACCEPT,
  ACCEPTED,
  CLOSED,
  DEADLINE,
  DECLINE,
  DECLINED,
  DUPLICATE,
  EXPIRED,
  FAILED,
  OPEN,
  PASSED,
  QUORUM,
  UNKNOWN,
  WAITING
} from "./constants.js";
import { copyRule, readRule, requiredCount } from "./rule.js";
import { assertPlayers, isObject, normalizeZero, readFinite } from "./shape.js";
import { assertCheck } from "./validate.js";

const NOW_MESSAGE = "now must be a finite number";

export function createCheck(options) {
  if (!isObject(options)) {
    throw new TypeError("options must be an object");
  }
  const players = readPlayers(options);
  const deadline = readFinite(
    Object.hasOwn(options, "deadline") ? options.deadline : undefined,
    "deadline must be a finite number"
  );
  const rule = readRule(options, players.length);
  const pending = players.slice();
  const check = freezeCheck({
    status: OPEN,
    reason: null,
    deadline,
    required: requiredCount(players.length, rule),
    rule,
    players,
    accepted: [],
    declined: [],
    timedOut: [],
    pending,
    resolvedAt: null
  });
  assertCheck(check);
  return check;
}

export function respond(check, response) {
  assertCheck(check);
  const event = readResponse(response);
  if (check.status !== OPEN) {
    return outcome(CLOSED, check);
  }
  if (event.now >= normalizeZero(check.deadline)) {
    return finish(EXPIRED, expire(check, event.now));
  }
  if (!listed(check.players, event.playerId)) {
    return outcome(UNKNOWN, check);
  }
  if (listed(check.accepted, event.playerId) || listed(check.declined, event.playerId)) {
    return outcome(DUPLICATE, check);
  }
  const acceptedIds =
    event.decision === ACCEPT ? check.accepted.concat([event.playerId]) : check.accepted.slice();
  const declinedIds =
    event.decision === DECLINE ? check.declined.concat([event.playerId]) : check.declined.slice();
  const lists = orderLists(check.players, acceptedIds, declinedIds, []);
  if (lists.accepted.length >= check.required) {
    return finish(PASSED, assemble(check, PASSED, QUORUM, lists, event.now));
  }
  if (check.players.length - lists.declined.length < check.required) {
    return finish(FAILED, assemble(check, FAILED, DECLINE, lists, event.now));
  }
  const result = event.decision === ACCEPT ? ACCEPTED : DECLINED;
  return finish(result, assemble(check, OPEN, null, lists, null));
}

export function advance(check, now) {
  assertCheck(check);
  const time = readFinite(now, NOW_MESSAGE);
  if (check.status !== OPEN) {
    return outcome(CLOSED, check);
  }
  if (time < normalizeZero(check.deadline)) {
    return outcome(WAITING, check);
  }
  return finish(EXPIRED, expire(check, time));
}

function readPlayers(options) {
  if (!Object.hasOwn(options, "players")) {
    throw new TypeError("players must be a non-empty array");
  }
  assertPlayers(options.players);
  return options.players.slice();
}

function readResponse(response) {
  if (!isObject(response)) {
    throw new TypeError("response must be an object");
  }
  if (
    !Object.hasOwn(response, "playerId") ||
    typeof response.playerId !== "string" ||
    response.playerId.length === 0
  ) {
    throw new TypeError("player id must be a non-empty string");
  }
  if (
    !Object.hasOwn(response, "decision") ||
    (response.decision !== ACCEPT && response.decision !== DECLINE)
  ) {
    throw new TypeError("decision must be accept or decline");
  }
  return {
    playerId: response.playerId,
    decision: response.decision,
    now: readFinite(Object.hasOwn(response, "now") ? response.now : undefined, NOW_MESSAGE)
  };
}

function expire(check, now) {
  const lists = orderLists(check.players, check.accepted, check.declined, check.pending);
  return assemble(check, FAILED, DEADLINE, lists, now);
}

function assemble(check, status, reason, lists, resolvedAt) {
  return freezeCheck({
    status,
    reason,
    deadline: normalizeZero(check.deadline),
    required: check.required,
    rule: copyRule(check.rule),
    players: check.players.slice(),
    accepted: lists.accepted,
    declined: lists.declined,
    timedOut: lists.timedOut,
    pending: lists.pending,
    resolvedAt
  });
}

function orderLists(players, acceptedIds, declinedIds, timedOutIds) {
  const acceptedSet = toSet(acceptedIds);
  const declinedSet = toSet(declinedIds);
  const timedOutSet = toSet(timedOutIds);
  const accepted = [];
  const declined = [];
  const timedOut = [];
  const pending = [];
  for (const id of players) {
    if (Object.hasOwn(acceptedSet, id)) {
      accepted.push(id);
    } else if (Object.hasOwn(declinedSet, id)) {
      declined.push(id);
    } else if (Object.hasOwn(timedOutSet, id)) {
      timedOut.push(id);
    } else {
      pending.push(id);
    }
  }
  return { accepted, declined, timedOut, pending };
}

function toSet(ids) {
  const set = Object.create(null);
  for (const id of ids) {
    set[id] = true;
  }
  return set;
}

function listed(ids, id) {
  for (const candidate of ids) {
    if (candidate === id) {
      return true;
    }
  }
  return false;
}

function finish(result, check) {
  assertCheck(check);
  return outcome(result, check);
}

function outcome(result, check) {
  return Object.freeze({
    result,
    check
  });
}

function freezeCheck(check) {
  Object.freeze(check.rule);
  Object.freeze(check.players);
  Object.freeze(check.accepted);
  Object.freeze(check.declined);
  Object.freeze(check.timedOut);
  Object.freeze(check.pending);
  return Object.freeze(check);
}
