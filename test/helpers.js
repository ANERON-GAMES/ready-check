export function rawCheck(overrides = {}) {
  const players = Object.hasOwn(overrides, "players") ? overrides.players : ["a", "b", "c"];
  const check = {
    status: "open",
    reason: null,
    deadline: 1000,
    required: Array.isArray(players) ? players.length : 3,
    rule: { type: "all" },
    players,
    accepted: [],
    declined: [],
    timedOut: [],
    pending: Array.isArray(players) ? players.slice() : [],
    resolvedAt: null
  };
  for (const key of Object.keys(overrides)) {
    check[key] = overrides[key];
  }
  return check;
}

export function without(check, key) {
  const copy = {};
  for (const name of Object.keys(check)) {
    if (name !== key) {
      copy[name] = check[name];
    }
  }
  return copy;
}

export function accept(playerId, now) {
  return { playerId, decision: "accept", now };
}

export function decline(playerId, now) {
  return { playerId, decision: "decline", now };
}
