export const OPEN = "open";
export const PASSED = "passed";
export const FAILED = "failed";
export const STATUSES = Object.freeze([OPEN, PASSED, FAILED]);

export const ACCEPT = "accept";
export const DECLINE = "decline";
export const DECISIONS = Object.freeze([ACCEPT, DECLINE]);

export const ALL = "all";
export const COUNT = "count";
export const FRACTION = "fraction";
export const RULES = Object.freeze([ALL, COUNT, FRACTION]);

export const QUORUM = "quorum";
export const DEADLINE = "deadline";
export const REASONS = Object.freeze([QUORUM, DECLINE, DEADLINE]);

export const WAITING = "waiting";
export const ACCEPTED = "accepted";
export const DECLINED = "declined";
export const EXPIRED = "expired";
export const DUPLICATE = "duplicate";
export const UNKNOWN = "unknown";
export const CLOSED = "closed";
export const RESULTS = Object.freeze([
  WAITING,
  ACCEPTED,
  DECLINED,
  PASSED,
  FAILED,
  EXPIRED,
  DUPLICATE,
  UNKNOWN,
  CLOSED
]);
