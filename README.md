# @aneron/ready-check

Lobby ready-check state machine with a deadline, declines, and quorum rules.

## Purpose

`@aneron/ready-check` tracks one lobby ready check. The check starts for a fixed list of player ids and a deadline. Each player may accept or decline. The check passes when the configured rule is met: every player, a count, or a fraction of the roster. It fails when a decline leaves too few players who can still accept, or when a call observes a time at or after the deadline. The check reports who accepted, who declined, and who timed out.

The caller passes the current time in. Reading a check does not move it. `advance` and `respond` are the only calls that apply the deadline. The package does not read a clock, start a timer, draw a random number, or open a socket. It has no runtime dependencies.

## Install

The package is an ES module. It needs Node.js 20 or newer. It has no runtime dependencies. The package name is `@aneron/ready-check`. It is not published to the npm registry.

Clone this repository and run the tests:

```bash
git clone https://github.com/ANERON-GAMES/ready-check.git
cd ready-check
npm install
npm test
```

`npm test` runs `node --test`. `npm run lint` runs ESLint. `npm run format:check` runs Prettier.

Install it as a dependency from the git repository:

```bash
npm install github:ANERON-GAMES/ready-check
```

```js
import { advance, createCheck, respond } from "@aneron/ready-check";
```

Code in this repository imports the same entry point with `./src/index.js`.

## Usage

Time values below are numbers in one unit chosen by the caller. The module does not treat them as milliseconds.

A count of `2` passes on the second accept. The player who has not answered stays pending. That player did not time out.

```js
import { advance, createCheck, respond } from "@aneron/ready-check";

const check = createCheck({
  players: ["a", "b", "c"],
  deadline: 1000,
  rule: { type: "count", count: 2 }
});

const first = respond(check, { playerId: "a", decision: "accept", now: 100 });
const second = respond(first.check, { playerId: "b", decision: "accept", now: 200 });
const late = respond(second.check, { playerId: "c", decision: "accept", now: 300 });
```

`check.required` is `2`. `check.status` is `"open"`. `check.pending` is `["a", "b", "c"]`. `check.reason` is `null`. `check.resolvedAt` is `null`.

`first.result` is `"accepted"`. `first.check.accepted` is `["a"]`. `first.check.pending` is `["b", "c"]`. `first.check.status` is `"open"`.

`second.result` is `"passed"`. `second.check.status` is `"passed"`. `second.check.reason` is `"quorum"`. `second.check.accepted` is `["a", "b"]`. `second.check.pending` is `["c"]`. `second.check.declined` is `[]`. `second.check.timedOut` is `[]`. `second.check.resolvedAt` is `200`.

`late.result` is `"closed"`. `late.check` is `second.check`. The late accept is not recorded.

The default rule is `all`. One decline makes the rest of the roster unable to pass, so the check fails before the deadline. The players who have not answered stay pending. They are not timed out.

```js
const vote = createCheck({
  players: ["a", "b", "c"],
  deadline: 1000
});
const no = respond(vote, { playerId: "b", decision: "decline", now: 50 });
```

`vote.rule` is `{ type: "all" }`. `vote.required` is `3`. `no.result` is `"failed"`. `no.check.status` is `"failed"`. `no.check.reason` is `"decline"`. `no.check.declined` is `["b"]`. `no.check.pending` is `["a", "c"]`. `no.check.accepted` is `[]`. `no.check.timedOut` is `[]`. `no.check.resolvedAt` is `50`.

A fraction of `0.5` on three players requires `2` accepts, because `ceil(3 * 0.5)` is `2`. A response at the deadline does not count. The same instant through `advance` fails the same way. Unknown players and a second answer are refused while the check is still open and the time is still before the deadline.

```js
const lobby = createCheck({
  players: ["a", "b", "c"],
  deadline: 1000,
  rule: { type: "fraction", fraction: 0.5 }
});
const yes = respond(lobby, { playerId: "a", decision: "accept", now: 400 });
const stranger = respond(yes.check, { playerId: "z", decision: "decline", now: 450 });
const again = respond(yes.check, { playerId: "a", decision: "decline", now: 450 });
const early = advance(yes.check, 999);
const tooLate = respond(yes.check, { playerId: "b", decision: "accept", now: 1000 });
const timed = advance(yes.check, 1000);
```

`lobby.required` is `2`. `yes.result` is `"accepted"`. `stranger.result` is `"unknown"`. `stranger.check` is `yes.check`. `again.result` is `"duplicate"`. `again.check` is `yes.check`. `early.result` is `"waiting"`. `early.check` is `yes.check`.

`tooLate.result` is `"expired"`. `tooLate.check.status` is `"failed"`. `tooLate.check.reason` is `"deadline"`. `tooLate.check.accepted` is `["a"]`. `tooLate.check.timedOut` is `["b", "c"]`. `tooLate.check.pending` is `[]`. `tooLate.check.resolvedAt` is `1000`. `"b"` is not in `accepted`. The accept at time `1000` was not recorded.

`timed.result` is `"expired"`. `timed.check.timedOut` is `["b", "c"]`. `timed.check.resolvedAt` is `1000`. `timed.check` and `tooLate.check` are deep-equal and are not the same reference. `yes.check.status` is still `"open"`.

Lists follow the roster passed to `createCheck`, not the order of answers.

```js
const ordered = createCheck({
  players: ["c", "a", "b"],
  deadline: 10,
  rule: { type: "count", count: 2 }
});
const bFirst = respond(ordered, { playerId: "b", decision: "accept", now: 1 });
const aSecond = respond(bFirst.check, { playerId: "a", decision: "accept", now: 2 });
```

`bFirst.check.accepted` is `["b"]`. `aSecond.result` is `"passed"`. `aSecond.check.accepted` is `["a", "b"]`. `aSecond.check.pending` is `["c"]`.

A count of `3` on four players survives one decline and fails on the second. The declined list is roster order.

```js
const group = createCheck({
  players: ["a", "b", "c", "d"],
  deadline: 50,
  rule: { type: "count", count: 3 }
});
const one = respond(group, { playerId: "d", decision: "decline", now: 1 });
const two = respond(one.check, { playerId: "b", decision: "decline", now: 2 });
```

`one.result` is `"declined"`. `one.check.pending` is `["a", "b", "c"]`. `two.result` is `"failed"`. `two.check.reason` is `"decline"`. `two.check.declined` is `["b", "d"]`. `two.check.pending` is `["a", "c"]`. `two.check.resolvedAt` is `2`.

Players who already answered stay in `accepted` or `declined` when the deadline passes. Only the pending ids move to `timedOut`.

```js
const room = createCheck({
  players: ["a", "b", "c", "d"],
  deadline: 80,
  rule: { type: "count", count: 3 }
});
const accepted = respond(room, { playerId: "c", decision: "accept", now: 10 });
const declined = respond(accepted.check, { playerId: "a", decision: "decline", now: 20 });
const ended = advance(declined.check, 90);
```

`declined.result` is `"declined"`. `ended.result` is `"expired"`. `ended.check.accepted` is `["c"]`. `ended.check.declined` is `["a"]`. `ended.check.timedOut` is `["b", "d"]`. `ended.check.pending` is `[]`. `ended.check.resolvedAt` is `90`.

## API

`createCheck`, `respond`, and `advance` are deterministic. They do not read the clock, the network, or the filesystem. They do not mutate their arguments. A call that records a decision or applies the deadline returns a new check. A call that refuses the event returns the same check reference.

`deadline`, `now`, and `resolvedAt` share one unit. The module does not convert milliseconds, ticks, or seconds. Comparison is ordinary IEEE-754 with no epsilon. `now >= deadline` means the deadline has passed. `now === deadline` has passed. A negative time is allowed. `-0` is stored as `0` on values this module writes, and `-0` compares equal to `0`.

The module does not require `now` to increase from one call to the next. A later call may pass an earlier finite time. The call is late only when that time is greater than or equal to the deadline.

### Constants

| Export      | Value                               | Meaning                                                                                                                 |
| ----------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `OPEN`      | `"open"`                            | Status. Players may still answer, and the deadline has not been applied.                                                |
| `PASSED`    | `"passed"`                          | Status and result. The required number of accepts was recorded before the deadline.                                     |
| `FAILED`    | `"failed"`                          | Status and result. A decline made passing impossible. As a status, a deadline failure is also `"failed"`.               |
| `STATUSES`  | `["open", "passed", "failed"]`      | Frozen status list, in that order.                                                                                      |
| `ACCEPT`    | `"accept"`                          | Decision.                                                                                                               |
| `DECLINE`   | `"decline"`                         | Decision. Also the failure reason `"decline"`.                                                                          |
| `DECISIONS` | `["accept", "decline"]`             | Frozen decision list, in that order.                                                                                    |
| `ALL`       | `"all"`                             | Rule type. `required` is the roster length.                                                                             |
| `COUNT`     | `"count"`                           | Rule type. `required` is the given count.                                                                               |
| `FRACTION`  | `"fraction"`                        | Rule type. `required` is `Math.ceil(playerCount * fraction)`.                                                           |
| `RULES`     | `["all", "count", "fraction"]`      | Frozen rule-type list, in that order.                                                                                   |
| `QUORUM`    | `"quorum"`                          | Reason on a passed check.                                                                                               |
| `DEADLINE`  | `"deadline"`                        | Reason on a deadline failure.                                                                                           |
| `REASONS`   | `["quorum", "decline", "deadline"]` | Frozen reason list, in that order.                                                                                      |
| `WAITING`   | `"waiting"`                         | `advance` result. The check is open and `now` is before the deadline.                                                   |
| `ACCEPTED`  | `"accepted"`                        | `respond` result. The accept was recorded and the check stays open.                                                     |
| `DECLINED`  | `"declined"`                        | `respond` result. The decline was recorded and the check stays open.                                                    |
| `EXPIRED`   | `"expired"`                         | Result when this call applies the deadline. The status of that check is `"failed"`.                                     |
| `DUPLICATE` | `"duplicate"`                       | The player already accepted or declined.                                                                                |
| `UNKNOWN`   | `"unknown"`                         | The player id is not in the roster.                                                                                     |
| `CLOSED`    | `"closed"`                          | The check was already resolved before this call.                                                                        |
| `RESULTS`   | nine strings                        | Frozen result list: `waiting`, `accepted`, `declined`, `passed`, `failed`, `expired`, `duplicate`, `unknown`, `closed`. |

`PASSED` is both a status and a result. `FAILED` is both a status and the result of a decline that makes passing impossible. A deadline failure uses status `FAILED` and result `EXPIRED`. `DECLINE` is both the decision and the decline-failure reason. The recorded-decline result is `DECLINED`, with a final `d`.

### Check

The object returned by `createCheck`, and the `check` field of a `respond` or `advance` outcome.

| Field        | Type             | Meaning                                                                                              |
| ------------ | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `status`     | string           | `OPEN`, `PASSED`, or `FAILED`.                                                                       |
| `reason`     | string or `null` | `null` while open. `QUORUM`, `DECLINE`, or `DEADLINE` after resolution.                              |
| `deadline`   | number           | Finite deadline. A written check stores `-0` as `0`.                                                 |
| `required`   | number           | Accepts needed to pass. An integer from `1` to the roster length.                                    |
| `rule`       | object           | Normalized rule. `{ type: "all" }`, `{ type: "count", count }`, or `{ type: "fraction", fraction }`. |
| `players`    | array            | Roster, in the order passed to `createCheck`. Non-empty unique strings.                              |
| `accepted`   | array            | Ids that accepted, as a subsequence of `players`.                                                    |
| `declined`   | array            | Ids that declined, as a subsequence of `players`.                                                    |
| `timedOut`   | array            | Ids moved out of `pending` when the deadline was applied. Empty unless `reason` is `DEADLINE`.       |
| `pending`    | array            | Ids that have not accepted, declined, or timed out.                                                  |
| `resolvedAt` | number or `null` | `null` while open. Otherwise the `now` of the call that resolved the check.                          |

The four id lists partition `players`. Each id is in exactly one list. Each list follows roster order. A passed check has `accepted.length === required`, no timed-out ids, and `resolvedAt < deadline`. A decline failure has `players.length - declined.length < required`, no timed-out ids, and `resolvedAt < deadline`. A deadline failure has no pending ids, at least one timed-out id, `accepted.length < required`, and `resolvedAt >= deadline`.

An open check has `reason === null`, `resolvedAt === null`, no timed-out ids, fewer accepts than `required`, and enough non-declined players to still reach `required`.

Returned checks are frozen. The rule and the five arrays are frozen. Do not mutate them. A new check copies `players`, `rule`, and the four lists. It does not share those objects with the previous check.

`createCheck` does not look at a clock. A deadline that is already behind the caller's own clock stays `OPEN` until `advance` or `respond` is called with a `now` at or after that deadline. `resolvedAt` on a deadline failure is that `now`, which may be later than `deadline`.

### `createCheck(options)`

Return a new open check.

| Argument  | Type   | Role                                                                         |
| --------- | ------ | ---------------------------------------------------------------------------- |
| `options` | object | Required. `null`, an array, a missing value, and any other non-object throw. |

| Field      | Type   | Role                                                                                |
| ---------- | ------ | ----------------------------------------------------------------------------------- |
| `players`  | array  | Required. A non-empty array of unique non-empty strings. Order is the roster order. |
| `deadline` | number | Required. A finite number. `-0` is stored as `0`.                                   |
| `rule`     | object | Optional. Omitted or `undefined` means `{ type: "all" }`.                           |

`players` is copied. Later edits to the caller's array do not change the check. `"__proto__"`, `"constructor"`, and `"toString"` are valid ids. Ids are not trimmed and are not case-folded. `"a"` and `"A"` are different players. A string of one space is a valid id.

Unknown fields on `options` are ignored. Unknown fields on a `rule` are ignored. The stored rule keeps only `type` and, for `count` or `fraction`, that one value.

`rule.type` is `"all"`, `"count"`, or `"fraction"`.

| Rule                             | Stored shape                     | `required`                             |
| -------------------------------- | -------------------------------- | -------------------------------------- |
| `{ type: "all" }`                | `{ type: "all" }`                | `players.length`                       |
| `{ type: "count", count }`       | `{ type: "count", count }`       | `count`                                |
| `{ type: "fraction", fraction }` | `{ type: "fraction", fraction }` | `Math.ceil(players.length * fraction)` |

`count` must be an integer from `1` to `players.length`. `fraction` must be a finite number greater than `0` and less than or equal to `1`. The product uses IEEE-754 multiplication. Examples:

| Players | Fraction | Product        | `required` |
| ------- | -------- | -------------- | ---------- |
| `2`     | `0.1`    | `0.2`          | `1`        |
| `3`     | `0.5`    | `1.5`          | `2`        |
| `4`     | `0.5`    | `2`            | `2`        |
| `4`     | `0.75`   | `3`            | `3`        |
| `7`     | `0.3`    | `7 * 0.3`      | `3`        |
| `10`    | `1 / 3`  | `10 * (1 / 3)` | `4`        |

`ceil(7 * 0.3)` is `3`. `ceil(10 * (1 / 3))` is `4`. A fraction of `1` requires every player and still stores `type: "fraction"`. A count equal to the roster length still stores `type: "count"`.

Fields are read in this order: `players`, `deadline`, `rule`. The first failure throws.

| Message                                                                       | Error        | Cause                                                                            |
| ----------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| `options must be an object`                                                   | `TypeError`  | Missing, `null`, an array, or any other non-object.                              |
| `players must be a non-empty array`                                           | `TypeError`  | Missing, empty, or not an array.                                                 |
| `player id must be a non-empty string`                                        | `TypeError`  | An element is empty, missing, or not a string.                                   |
| `player ids must be unique`                                                   | `TypeError`  | The same id appears twice.                                                       |
| `deadline must be a finite number`                                            | `RangeError` | Missing, `NaN`, an infinity, or not a number.                                    |
| `rule must be an object`                                                      | `TypeError`  | Present, but `null`, an array, or any other non-object.                          |
| `rule type must be all, count, or fraction`                                   | `TypeError`  | `type` is missing or not one of those three strings.                             |
| `count must be an integer from 1 to the number of players`                    | `RangeError` | `count` is missing or outside that range.                                        |
| `fraction must be a finite number greater than 0 and less than or equal to 1` | `RangeError` | `fraction` is missing or outside that range.                                     |
| `fraction must yield a required count from 1 to the number of players`        | `RangeError` | `Math.ceil(players.length * fraction)` is outside `1` through the roster length. |

A new check is `OPEN`, with `reason` `null`, `resolvedAt` `null`, empty `accepted`, `declined`, and `timedOut`, and `pending` equal to `players`.

### Outcome

`respond` and `advance` return a frozen object.

| Field    | Type   | Meaning                                                              |
| -------- | ------ | -------------------------------------------------------------------- |
| `result` | string | One of `RESULTS`.                                                    |
| `check`  | object | The next check, or the same reference when the call changes nothing. |

### `respond(check, response)`

Record one decision, or refuse it.

| Argument   | Type   | Role                                                                                                            |
| ---------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| `check`    | object | A check. A value returned by this module passes. A hand-built object passes when it meets the check invariants. |
| `response` | object | `{ playerId, decision, now }`. Unknown fields are ignored.                                                      |

`playerId` must be a non-empty string. `decision` must be `"accept"` or `"decline"`. `now` must be a finite number. `-0` is treated as `0`.

The checks run in this order. The first match wins.

1. The check is validated. A bad check throws.
2. The response is validated. A bad response throws.
3. `status` is not `OPEN`. The result is `CLOSED`. The check is the same reference. This wins over an unknown player, a duplicate, and a `now` at or after the deadline.
4. `now >= deadline`. The result is `EXPIRED`. The decision is not recorded. Pending ids become `timedOut`. `resolvedAt` is `now`. This wins over an unknown player and over a duplicate.
5. `playerId` is not in `players`. The result is `UNKNOWN`. The check is the same reference.
6. `playerId` is already in `accepted` or `declined`. The result is `DUPLICATE`. The same decision and the opposite decision are both duplicates. The check is the same reference.
7. The decision is recorded in roster order.
8. `accepted.length >= required`. The result is `PASSED`, `reason` is `QUORUM`, and `resolvedAt` is `now`. One recorded accept increases the count by one, so a check this module created reaches `accepted.length === required`.
9. `players.length - declined.length < required`. The result is `FAILED`, `reason` is `DECLINE`, and `resolvedAt` is `now`. The players who have not answered stay `pending`.
10. Otherwise the result is `ACCEPTED` or `DECLINED` and the status stays `OPEN`.

A response at `now === deadline` is step 4. It cannot be the vote that passes the check.

`advance` is not required before `respond`. A `respond` whose `now` has reached the deadline applies the deadline itself.

Response validation order is `playerId`, then `decision`, then `now`.

| Message                                | Error        | Cause                                               |
| -------------------------------------- | ------------ | --------------------------------------------------- |
| `response must be an object`           | `TypeError`  | Missing, `null`, an array, or any other non-object. |
| `player id must be a non-empty string` | `TypeError`  | Missing, empty, or not a string.                    |
| `decision must be accept or decline`   | `TypeError`  | Missing, or any other value, including `"Accept"`.  |
| `now must be a finite number`          | `RangeError` | Missing, `NaN`, an infinity, or not a number.       |

### `advance(check, now)`

Apply the deadline, or report that it has not arrived.

| Argument | Type   | Role                                     |
| -------- | ------ | ---------------------------------------- |
| `check`  | object | A check.                                 |
| `now`    | number | A finite number. `-0` is treated as `0`. |

The checks run in this order. The first match wins.

1. The check is validated. A bad check throws.
2. `now` is validated. A bad `now` throws `RangeError` with `now must be a finite number`.
3. `status` is not `OPEN`. The result is `CLOSED`. The check is the same reference.
4. `now < deadline`. The result is `WAITING`. The check is the same reference.
5. `now >= deadline`. The result is `EXPIRED`. The transition is the same as step 4 of `respond`.

`advance` does not take a decision. Its result is only `WAITING`, `EXPIRED`, or `CLOSED`.

### Errors on a malformed check

`respond` and `advance` validate the check before the event. A check returned by this module passes, including one rebuilt with `JSON.parse(JSON.stringify(check))`. A mutated or hand-built object that breaks the shape throws. The first failure wins, in the order below.

| Message                                                                                                                         | Error        | Cause                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------ |
| `check must be an object`                                                                                                       | `TypeError`  | `null`, an array, or any non-object.                                                                         |
| `check fields must be status, reason, deadline, required, rule, players, accepted, declined, timedOut, pending, and resolvedAt` | `TypeError`  | A field is missing or an extra own field is present.                                                         |
| `status must be open, passed, or failed`                                                                                        | `TypeError`  | `status` is any other value.                                                                                 |
| `players must be a non-empty array`                                                                                             | `TypeError`  | `players` is empty or not an array.                                                                          |
| `player id must be a non-empty string`                                                                                          | `TypeError`  | A roster element is empty or not a string.                                                                   |
| `player ids must be unique`                                                                                                     | `TypeError`  | The roster repeats an id.                                                                                    |
| `deadline must be a finite number`                                                                                              | `RangeError` | `deadline` is not a finite number.                                                                           |
| `required must be an integer from 1 to the number of players`                                                                   | `RangeError` | `required` is outside that range.                                                                            |
| `accepted must be an array`                                                                                                     | `TypeError`  | `accepted` is not an array. `declined`, `timedOut`, and `pending` use the same sentence with their own name. |
| `accepted must contain player ids`                                                                                              | `TypeError`  | An element is empty or not a string. The other three lists use the same sentence with their own name.        |
| `player lists must partition the roster in roster order`                                                                        | `TypeError`  | An id is missing, repeated, unknown, or out of roster order.                                                 |
| `rule must be an object`                                                                                                        | `TypeError`  | `rule` is `null`, an array, or any non-object.                                                               |
| `rule must match its type and the required count`                                                                               | `TypeError`  | The rule type, its fields, or its count do not match `required`.                                             |
| `reason must be null while the check is open`                                                                                   | `TypeError`  | An open check has a reason.                                                                                  |
| `resolvedAt must be null while the check is open`                                                                               | `TypeError`  | An open check has a `resolvedAt`.                                                                            |
| `an open check must have no timed-out players`                                                                                  | `TypeError`  | An open check has a non-empty `timedOut`.                                                                    |
| `an open check must be short of the required accepts`                                                                           | `TypeError`  | An open check already has `required` accepts.                                                                |
| `an open check must still be able to pass`                                                                                      | `TypeError`  | The non-declined players are already fewer than `required`.                                                  |
| `reason must be quorum when the check passed`                                                                                   | `TypeError`  | A passed check has another reason.                                                                           |
| `reason must be decline or deadline when the check failed`                                                                      | `TypeError`  | A failed check has another reason.                                                                           |
| `resolvedAt must be a finite number`                                                                                            | `RangeError` | A resolved check has a `resolvedAt` that is not a finite number.                                             |
| `a passed check must resolve before the deadline`                                                                               | `TypeError`  | `resolvedAt >= deadline` on a passed check.                                                                  |
| `a passed check must have no timed-out players`                                                                                 | `TypeError`  | A passed check has a non-empty `timedOut`.                                                                   |
| `a passed check must have exactly the required accepts`                                                                         | `TypeError`  | `accepted.length` is not `required`.                                                                         |
| `a decline failure must resolve before the deadline`                                                                            | `TypeError`  | `resolvedAt >= deadline` on a decline failure.                                                               |
| `a decline failure must have no timed-out players`                                                                              | `TypeError`  | A decline failure has a non-empty `timedOut`.                                                                |
| `a decline failure must make passing impossible`                                                                                | `TypeError`  | The non-declined players can still reach `required`.                                                         |
| `a deadline failure must resolve at or after the deadline`                                                                      | `TypeError`  | `resolvedAt < deadline` on a deadline failure.                                                               |
| `a deadline failure must have no pending players`                                                                               | `TypeError`  | A deadline failure still has `pending` ids.                                                                  |
| `a deadline failure must have timed-out players`                                                                                | `TypeError`  | A deadline failure has an empty `timedOut`.                                                                  |
| `a deadline failure must be short of the required accepts`                                                                      | `TypeError`  | A deadline failure already has `required` accepts.                                                           |

## Design

The ready check is a value. `createCheck` freezes the starting value. `respond` and `advance` either return that same value or return a new frozen value. The previous value stays in the state it had. A caller can keep every step. Two calls with the same check and the same event are deep-equal. They are not the same object when the call records a change.

The deadline is not applied by reading `status`. There is no clock inside the module, so a stored check cannot know that time has passed until the caller passes `now`. `advance` is that observation when nobody is answering. `respond` uses the same comparison so a late vote cannot sneak through ahead of the deadline. The deadline test is before the roster test. At `now >= deadline` an unknown id and a second answer from a player who already voted are both `EXPIRED`, and the new decision is not written. A player who already accepted stays in `accepted`. Pending ids move to `timedOut` in roster order.

A resolved check stays on the reason it already has. `CLOSED` is tested before the deadline. A call after a pass, a decline failure, or a deadline failure does not rewrite `reason`, even when `now` is past the deadline, and even when the player id is unknown.

`timedOut` means the deadline was applied to someone who had not answered. A pass does not time those players out. A decline failure does not time them out either. They remain `pending`, which means they had not answered when the check ended. Only the deadline transition moves `pending` into `timedOut`. Players already in `accepted` or `declined` stay there.

The pass test is `accepted.length >= required`. The failure test is `players.length - declined.length < required`. The second number is everyone who has not declined, including players who already accepted and players still pending. While the check is open those two tests cannot both be true, because the non-declined count is at least the accept count. The vote that reaches `required` returns `PASSED`, not `ACCEPTED`. The decline that drops the remaining count below `required` returns `FAILED`, not `DECLINED`. A decline that leaves enough players returns `DECLINED` and stays `OPEN`.

`required` is fixed when the check is created. `all` sets it to the roster length, so the first decline fails. `count` stores the integer the caller passed. `fraction` stores that fraction and sets `required` to `Math.ceil(playerCount * fraction)` with IEEE-754 multiplication. A product of `1.5` requires `2`. A product of `0.2` requires `1`. Callers that want a strict majority choose a fraction whose ceiling is more than half the roster, or they pass `count`.

Reports use roster order so the arrays depend on the set of ids, not on which answer arrived first. `"b"` then `"a"` is stored as `["a", "b"]` when `"a"` stands before `"b"` in `players`. The same rule applies to `declined`, `timedOut`, and `pending`.

Ids are taken as exact strings and stored in arrays. They are not used as property names on the check object, so `"__proto__"`, `"constructor"`, and `"toString"` are ordinary ids.

A check passed back in is accepted by its shape, not by a private brand. It must have exactly the fields this module writes, and those fields must already satisfy the open, passed, or failed invariants. An extra field is a throw, not a silent skip. That is stricter than `createCheck`, which ignores unknown option fields. The stricter check is what keeps a typo in a stored object from looking like a valid roster.

Returned arrays and the rule object are copies. Editing the array that was passed to `createCheck`, or editing the response object after `respond` returns, does not change a check this module already returned. `JSON.parse(JSON.stringify(check))` is a valid check. The module does not keep an answer timestamp per player. `resolvedAt` is the only stored time besides `deadline`, and it is the caller time of the resolving call.

This module does not assign ids, open sockets, read the clock, schedule timers, or draw random numbers. The caller chooses the roster, the deadline, the rule, and the time of each call.

## License

Released under the MIT License. The full text is in [LICENSE](LICENSE).
