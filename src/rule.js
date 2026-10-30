import { ALL, COUNT, FRACTION } from "./constants.js";
import { assertExactKeys, isObject } from "./shape.js";

const RULE_MESSAGE = "rule must match its type and the required count";
const FRACTION_MESSAGE =
  "fraction must be a finite number greater than 0 and less than or equal to 1";
const FRACTION_COUNT_MESSAGE =
  "fraction must yield a required count from 1 to the number of players";
const COUNT_MESSAGE = "count must be an integer from 1 to the number of players";
const TYPE_MESSAGE = "rule type must be all, count, or fraction";

export function readRule(options, playerCount) {
  if (!Object.hasOwn(options, "rule") || options.rule === undefined) {
    return { type: ALL };
  }
  const rule = options.rule;
  if (!isObject(rule)) {
    throw new TypeError("rule must be an object");
  }
  if (rule.type === ALL) {
    return { type: ALL };
  }
  if (rule.type === COUNT) {
    return { type: COUNT, count: readCount(rule, playerCount) };
  }
  if (rule.type === FRACTION) {
    return { type: FRACTION, fraction: readFraction(rule) };
  }
  throw new TypeError(TYPE_MESSAGE);
}

export function requiredCount(playerCount, rule) {
  if (rule.type === ALL) {
    return playerCount;
  }
  if (rule.type === COUNT) {
    return rule.count;
  }
  const required = fractionRequired(playerCount, rule.fraction);
  if (required === null) {
    throw new RangeError(FRACTION_COUNT_MESSAGE);
  }
  return required;
}

export function copyRule(rule) {
  if (rule.type === ALL) {
    return { type: ALL };
  }
  if (rule.type === COUNT) {
    return { type: COUNT, count: rule.count };
  }
  return { type: FRACTION, fraction: rule.fraction };
}

export function assertStoredRule(check) {
  const rule = check.rule;
  if (!isObject(rule)) {
    throw new TypeError("rule must be an object");
  }
  if (rule.type === ALL) {
    assertExactKeys(rule, ["type"], RULE_MESSAGE);
    if (check.required !== check.players.length) {
      throw new TypeError(RULE_MESSAGE);
    }
    return;
  }
  if (rule.type === COUNT) {
    assertExactKeys(rule, ["count", "type"], RULE_MESSAGE);
    if (rule.count !== check.required) {
      throw new TypeError(RULE_MESSAGE);
    }
    return;
  }
  if (rule.type === FRACTION) {
    assertExactKeys(rule, ["fraction", "type"], RULE_MESSAGE);
    if (
      typeof rule.fraction !== "number" ||
      !Number.isFinite(rule.fraction) ||
      rule.fraction <= 0 ||
      rule.fraction > 1 ||
      fractionRequired(check.players.length, rule.fraction) !== check.required
    ) {
      throw new TypeError(RULE_MESSAGE);
    }
    return;
  }
  throw new TypeError(RULE_MESSAGE);
}

function readCount(rule, playerCount) {
  if (!Object.hasOwn(rule, "count") || !Number.isInteger(rule.count)) {
    throw new RangeError(COUNT_MESSAGE);
  }
  if (rule.count < 1 || rule.count > playerCount) {
    throw new RangeError(COUNT_MESSAGE);
  }
  return rule.count;
}

function readFraction(rule) {
  if (!Object.hasOwn(rule, "fraction") || typeof rule.fraction !== "number") {
    throw new RangeError(FRACTION_MESSAGE);
  }
  if (!Number.isFinite(rule.fraction) || rule.fraction <= 0 || rule.fraction > 1) {
    throw new RangeError(FRACTION_MESSAGE);
  }
  return rule.fraction;
}

function fractionRequired(playerCount, fraction) {
  const product = playerCount * fraction;
  if (!Number.isFinite(product)) {
    return null;
  }
  const required = Math.ceil(product);
  if (required < 1 || required > playerCount) {
    return null;
  }
  return required;
}
