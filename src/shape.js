export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeZero(value) {
  if (value === 0) {
    return 0;
  }
  return value;
}

export function readFinite(value, message) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(message);
  }
  return normalizeZero(value);
}

export function assertExactKeys(value, keys, message) {
  const own = Object.keys(value).sort();
  if (own.length !== keys.length) {
    throw new TypeError(message);
  }
  for (let index = 0; index < keys.length; index += 1) {
    if (own[index] !== keys[index]) {
      throw new TypeError(message);
    }
  }
}

export function assertPlayers(players) {
  if (!Array.isArray(players) || players.length === 0) {
    throw new TypeError("players must be a non-empty array");
  }
  const seen = Object.create(null);
  for (const id of players) {
    if (typeof id !== "string" || id.length === 0) {
      throw new TypeError("player id must be a non-empty string");
    }
    if (Object.hasOwn(seen, id)) {
      throw new TypeError("player ids must be unique");
    }
    seen[id] = true;
  }
}

export function assertIdList(list, label) {
  if (!Array.isArray(list)) {
    throw new TypeError(label + " must be an array");
  }
  for (const id of list) {
    if (typeof id !== "string" || id.length === 0) {
      throw new TypeError(label + " must contain player ids");
    }
  }
}

export function assertPartition(players, accepted, declined, timedOut, pending) {
  const position = Object.create(null);
  for (let index = 0; index < players.length; index += 1) {
    position[players[index]] = index;
  }
  const seen = Object.create(null);
  const lists = [accepted, declined, timedOut, pending];
  let count = 0;
  for (const list of lists) {
    let previous = -1;
    for (const id of list) {
      if (!Object.hasOwn(position, id) || Object.hasOwn(seen, id) || position[id] <= previous) {
        throw new TypeError("player lists must partition the roster in roster order");
      }
      previous = position[id];
      seen[id] = true;
      count += 1;
    }
  }
  if (count !== players.length) {
    throw new TypeError("player lists must partition the roster in roster order");
  }
}
