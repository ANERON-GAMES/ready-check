import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  ACCEPT,
  ACCEPTED,
  ALL,
  CLOSED,
  COUNT,
  DEADLINE,
  DECISIONS,
  DECLINE,
  DECLINED,
  DUPLICATE,
  EXPIRED,
  FAILED,
  FRACTION,
  OPEN,
  PASSED,
  QUORUM,
  REASONS,
  RESULTS,
  RULES,
  STATUSES,
  UNKNOWN,
  WAITING
} from "../src/index.js";
import * as api from "../src/index.js";

const root = new URL("..", import.meta.url);

test("public exports stay limited to the documented surface", () => {
  assert.deepEqual(Object.keys(api).sort(), [
    "ACCEPT",
    "ACCEPTED",
    "ALL",
    "CLOSED",
    "COUNT",
    "DEADLINE",
    "DECISIONS",
    "DECLINE",
    "DECLINED",
    "DUPLICATE",
    "EXPIRED",
    "FAILED",
    "FRACTION",
    "OPEN",
    "PASSED",
    "QUORUM",
    "REASONS",
    "RESULTS",
    "RULES",
    "STATUSES",
    "UNKNOWN",
    "WAITING",
    "advance",
    "createCheck",
    "respond"
  ]);
  assert.equal(OPEN, "open");
  assert.equal(PASSED, "passed");
  assert.equal(FAILED, "failed");
  assert.deepEqual(STATUSES, ["open", "passed", "failed"]);
  assert.equal(ACCEPT, "accept");
  assert.equal(DECLINE, "decline");
  assert.deepEqual(DECISIONS, ["accept", "decline"]);
  assert.equal(ALL, "all");
  assert.equal(COUNT, "count");
  assert.equal(FRACTION, "fraction");
  assert.deepEqual(RULES, ["all", "count", "fraction"]);
  assert.equal(QUORUM, "quorum");
  assert.equal(DEADLINE, "deadline");
  assert.deepEqual(REASONS, ["quorum", "decline", "deadline"]);
  assert.equal(WAITING, "waiting");
  assert.equal(ACCEPTED, "accepted");
  assert.equal(DECLINED, "declined");
  assert.equal(EXPIRED, "expired");
  assert.equal(DUPLICATE, "duplicate");
  assert.equal(UNKNOWN, "unknown");
  assert.equal(CLOSED, "closed");
  assert.deepEqual(RESULTS, [
    "waiting",
    "accepted",
    "declined",
    "passed",
    "failed",
    "expired",
    "duplicate",
    "unknown",
    "closed"
  ]);
  for (const list of [STATUSES, DECISIONS, RULES, REASONS, RESULTS]) {
    assert.equal(Object.isFrozen(list), true);
  }
});

test("package metadata names the module and the author", () => {
  const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  assert.equal(pkg.name, "@aneron/ready-check");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.author, "Vadim Gubin");
  assert.equal(pkg.type, "module");
  assert.equal(pkg.sideEffects, false);
  assert.equal(pkg.engines.node, ">=20");
  assert.equal(pkg.private, undefined);
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.main, "./src/index.js");
  assert.equal(pkg.exports, "./src/index.js");
  assert.equal(pkg.repository.type, "git");
  assert.equal(pkg.repository.url, "git+https://github.com/ANERON-GAMES/ready-check.git");
  assert.deepEqual(pkg.files, ["src", "LICENSE", "README.md"]);
  const license = readFileSync(new URL("LICENSE", root), "utf8");
  assert.equal(license.includes("Copyright (c) 2026 Vadim Gubin"), true);
  assert.equal(license.includes("anerongames"), false);
  const readme = readFileSync(new URL("README.md", root), "utf8");
  for (const heading of [
    "## Purpose",
    "## Install",
    "## Usage",
    "## API",
    "## Design",
    "## License"
  ]) {
    assert.equal(readme.includes(heading), true, heading);
  }
  assert.equal(readme.includes("## Design notes"), false);
  assert.equal(readme.includes("## API reference"), false);
  assert.equal(readme.includes('`first.result` is `"accepted"`'), true);
  assert.equal(readme.includes('`second.result` is `"passed"`'), true);
  assert.equal(readme.includes('`late.result` is `"closed"`'), true);
  assert.equal(readme.includes('`no.result` is `"failed"`'), true);
  assert.equal(readme.includes('`stranger.result` is `"unknown"`'), true);
  assert.equal(readme.includes('`again.result` is `"duplicate"`'), true);
  assert.equal(readme.includes('`early.result` is `"waiting"`'), true);
  assert.equal(readme.includes('`tooLate.result` is `"expired"`'), true);
  assert.equal(readme.includes('`timed.check.timedOut` is `["b", "c"]`'), true);
  assert.equal(readme.includes("`lobby.required` is `2`"), true);
  assert.equal(readme.includes('`aSecond.check.accepted` is `["a", "b"]`'), true);
  assert.equal(readme.includes('`two.check.declined` is `["b", "d"]`'), true);
  assert.equal(readme.includes('`ended.check.timedOut` is `["b", "d"]`'), true);
});

test("source files do not contain comments, clocks, timers, or network calls", () => {
  const files = readdirSync(new URL("src/", root)).sort();
  assert.deepEqual(files, [
    "check.js",
    "constants.js",
    "index.js",
    "rule.js",
    "shape.js",
    "validate.js"
  ]);
  for (const name of files) {
    const source = readFileSync(new URL("src/" + name, root), "utf8");
    const specifiers = source.match(/from "[^"]+"/g) ?? [];
    assert.equal(specifiers.length > 0 || !source.includes("import "), true, name);
    for (const specifier of specifiers) {
      assert.match(specifier, /^from "\.\/[a-z]+\.js"$/);
    }
    assert.equal(source.includes("node:"), false, name);
    assert.equal(source.includes("require("), false, name);
    assert.equal(source.includes("/*"), false, name);
    assert.equal(source.includes("//"), false, name);
    for (const token of [
      "Date",
      "setTimeout",
      "setInterval",
      "Math.random",
      "process",
      "fetch(",
      "globalThis",
      "queueMicrotask",
      "setImmediate",
      "performance"
    ]) {
      assert.equal(source.includes(token), false, name + " " + token);
    }
  }
});

test("the lockfile resolves only from the npm registry", () => {
  const lockPath = new URL("package-lock.json", root);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  assert.equal(lock.lockfileVersion >= 2, true);
  const text = readFileSync(lockPath, "utf8");
  assert.equal(text.includes("git+"), false);
  assert.equal(text.includes("github:"), false);
  assert.equal(text.includes("registry.yarnpkg.com"), false);
  let resolved = 0;
  const walk = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
      return;
    }
    if (value !== null && typeof value === "object") {
      if (typeof value.resolved === "string") {
        resolved += 1;
        assert.equal(
          value.resolved.startsWith("https://registry.npmjs.org/"),
          true,
          value.resolved
        );
      }
      for (const key of Object.keys(value)) {
        walk(value[key]);
      }
    }
  };
  walk(lock);
  assert.equal(resolved > 0, true);
});
