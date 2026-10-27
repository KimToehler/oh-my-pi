# Tasks

`W` = `/Users/tim/git/oh-my-pi/.worktrees/acp-ask-free-text` (branch `fix/acp-ask-free-text`, created from `main` at `a00f09319b`). Every edit, test and commit happens in `W`, using absolute paths.

## 1. Setup

- [x] 1.1 Make `W` runnable and commit this change folder in `W` (steps below). Verify: `cd /Users/tim/git/oh-my-pi/.worktrees/acp-ask-free-text && test -d node_modules && test -f packages/coding-agent/src/export/html/tool-views.generated.js && cd packages/coding-agent && bun test test/acp-agent.test.ts -t "ACP elicitation bridge" && bun test test/acp-v2.test.ts -t "sends a v2 elicitation/create for a tool question" && git -C /Users/tim/git/oh-my-pi/.worktrees/acp-ask-free-text ls-files --error-unmatch openspec/changes/acp-ask-free-text-answers/proposal.md`
  - Run `bun install --frozen-lockfile` in `W`. `W` has no `node_modules` of its own, so module resolution walks up to the main checkout's `node_modules`, and that is not a baseline for `W`. The install also runs the root `prepare` script (`gen:tool-views`), which generates the git-ignored `packages/coding-agent/src/export/html/tool-views.generated.js`. Without it, `acp-v2.test.ts` fails to load (seen 2026-10-27: `Cannot find module './tool-views.generated.js'`).
  - Copy the main checkout's `packages/natives/native/pi_natives.darwin-arm64.node` into `W` at the same path. It was built 2026-10-27 10:01, after the last `crates/pi-natives` commit `011ab732fa`. If bash-based tests then fail with `PipeStreams`, rebuild it instead with `PATH="$HOME/.cargo/bin:$PATH" bun run build:native`.
  - Baseline: the elicitation bridge tests and the existing v2 elicitation test pass before any source edit.

## 2. Answer decoding (spec `acp-ask-dialog`, design D1, D4)

- [x] 2.1 RED. In `packages/coding-agent/test/acp-agent.test.ts`, inside `describe("ACP elicitation bridge")`, replace the test "drops ask values the client was never offered" (lines 4502-4512) with the tests below. Each uses the existing mock `createElicitConnection` and checks `result.results[i]` with `toMatchObject` on `selectedOptions` and `customInput`. Verify: `cd /Users/tim/git/oh-my-pi/.worktrees/acp-ask-free-text && bash .omp/team-config/evidence/gate/acp-ask-free-text-answers/red-check.sh`
  - `ask free text: a single-select value outside the options is the free-text answer`: options `Proof-Branch`/`Lokales Docker`, content `{ q0: "  klar läuft hier docker  ", q0__other: "" }`. Expects `[]` and `"klar läuft hier docker"`.
  - `ask free text: a blank or non-string single-select value is no answer`: content `{ q0: "   " }`, then `{ q0: 42 }`. Expects `[]` and `undefined` both times.
  - `ask free text: multi-select items outside the options become free text beside the selections`: options `A`/`B`/`C`, content `{ q0: ["A", "my own idea", "C"] }`. Expects `["A", "C"]` and `"my own idea"`.
  - `ask free text: multi-select with only typed items joins them by newline`: content `{ q0: [" first ", "second"] }`. Expects `[]` and `"first\nsecond"`.
  - `ask free text: multi-select keeps a repeated typed item once`: content `{ q0: ["x", " x ", "y"] }`. Expects `[]` and `"x\ny"`.
  - `ask free text: multi-select ignores blank and non-string items`: options `A`/`B`/`C`, content `{ q0: ["A", "   ", 7, null, "typed"] }`. Expects `["A"]` and `"typed"`: no blank line, no `"7"`, no `"null"`.
  - `ask free text: select text and companion text are both kept`: content `{ q0: "typed in the select", q0__other: "typed in the field" }` expects `"typed in the select\ntyped in the field"`. Content `{ q0: "same", q0__other: " same " }` then expects `"same"`.
  - `ask free text: the ask tool reports a folded Other answer instead of cancelling`: runs a real `AskTool` (`src/tools/ask.ts`). Its `ToolSession` has `cwd`, `hasUI: true`, `canPromptUser: true`, `settings: Settings.isolated()`, `getSessionFile` and `getSessionSpawns`, as `createSession` in `test/tools/ask.test.ts` builds it. The tool executes one single-select question with the context `{ hasUI: true, ui: createAcpExtensionUiContext(connection, …, FORM_CAPABILITIES), abort: vi.fn() }`. The mock answers `{ action: "accept", content: { q0: "klar läuft hier docker", q0__other: "" } }`. The test captures the outcome as `await tool.execute(…).catch(error => error)`, so the pre-fix `ToolAbortError` (`ask.ts:840-853`) reaches an assertion instead of escaping. It first expects `outcome` `.not.toBeInstanceOf(ToolAbortError)`, then `content[0].text === "User provided custom input: klar läuft hier docker"`, `details.customInput === "klar läuft hier docker"`, and `abort` not called.

  In `packages/coding-agent/test/acp-v2.test.ts`, next to "sends a v2 elicitation/create for a tool question…", add `ask free text: a v2 client's select value outside the options reaches the tool as free text`:
  - It uses `startReal` with client capabilities `{ elicitation: { form: {} } }` and a tool that calls `toolUi.current?.askDialog([{ id: "proof", question: "How?", options: [{ label: "A" }, { label: "B" }] }])` and records the result.
  - The client handler records the `elicitation/create` params and answers `{ action: "accept", content: { q0: "typed text" } }`.
  - Expects the recorded result's `results[0]` to match `{ selectedOptions: [], customInput: "typed text" }`, and `client.schemaIssues` to equal `[]`.
  - Expects the recorded v2 request (requirement 1 on v2, the `AcpSurfaceV2.elicitForm` / `toV2Properties` path, `acp-surface-v2.ts:453-463`): `Object.keys(requestedSchema.properties)` equals `["q0", "q0__other"]`; `requestedSchema.properties.q0__other` equals `{ type: "string", title: "Other (type your own)" }`; and `requestedSchema.required` does not contain `"q0__other"`.

  Four existing tests stay unchanged and pass. Together they own requirement 1 on v1 and the scenarios "Offered value still selects" and "Companion text with an offered option":
  - "translates a recommended single-choice ask into one form": the offered value selects, the companion has its shape, `required` is undefined.
  - "treats a single-choice custom answer as exclusive".
  - "uses only free-text fields for questions without options".
  - "packs multiple ask questions into one ordered form": property order `q0`, `q0__other`, `q1`, `q1__other`.

  Run the new tests against the unchanged source. These fail (RED): the single-select test, all four multi-select tests (the invalid-items one fails because `"typed"` is dropped), the both-kept test, the ask-tool test and the v2 test (its decoded-result assertion; its request-shape assertions already hold). The blank/non-string single-select test is a guard and passes. Commit the tests, `red-check.sh` and its outputs without any source change (`test(acp): …`).

  RED proof per test: write `.omp/team-config/evidence/gate/acp-ask-free-text-answers/red-check.sh` (`set -euo pipefail`), tracked with the evidence. It holds a table of `<file>|<exact test name>|<expected matcher>`, one row per RED test above. The expected matcher is `toMatchObject` for the bridge and v2 tests, and `not.toBeInstanceOf` for the ask-tool test (its first assertion, which the pre-fix `ToolAbortError` fails). The script refuses to run unless the source is still the pre-fix source: `git diff --quiet a00f09319b -- packages/coding-agent/src/modes/acp/acp-agent.ts`. It is therefore run, and its Verify ticked, before 2.2. For each row, it runs `bun test <file> -t "<regex-escaped exact name>$"` alone in `packages/coding-agent` and writes the full output to `red/<n>.txt` next to the script. bun's `-t` matches the describe-prefixed full name without a start anchor, and the trailing `$` excludes longer sibling names (checked 2026-10-27 with bun 1.4.4). It exits non-zero unless, for that row, the output has the summary lines ` 0 pass` and ` 1 fail`, a line that starts with `(fail) ` and contains `> <exact name> [` (bun prints `(fail) <describe> > <name> [<ms>]`), and a line `error: expect(received).<expected matcher>(`. That shows an assertion failed, not setup, compilation or discovery. It also runs the blank/non-string guard alone and requires ` 1 pass` and ` 0 fail`. The script and the `red/*.txt` outputs are committed together with the tests.
- [ ] 2.2 Implement D1 in `packages/coding-agent/src/modes/acp/acp-agent.ts`. Add one local pure function next to `createAcpExtensionUiContext` that maps `(question, key, content)` to `{ selectedOptions, customInput }` by the D1 rules. Make the `results` map in `askDialog` (lines 712-738) call it. The request-building part (lines 656-689) does not change. Commit (`fix(acp): …`). Verify: `cd /Users/tim/git/oh-my-pi/.worktrees/acp-ask-free-text/packages/coding-agent && bun test test/acp-agent.test.ts -t "ACP elicitation bridge" && bun test test/acp-v2.test.ts -t "ask free text:"`
- [ ] 2.3 Prove that the request-shape tests discriminate (negative control of requirement 1, v1 and v2) with `.omp/team-config/evidence/gate/acp-ask-free-text-answers/mutation-check.sh` (`set -euo pipefail`), tracked with the evidence. Verify: `cd /Users/tim/git/oh-my-pi/.worktrees/acp-ask-free-text && bash .omp/team-config/evidence/gate/acp-ask-free-text-answers/mutation-check.sh && git diff --quiet -- packages/coding-agent/src/modes/acp/acp-agent.ts`
  - (i) delete the line that sets the `__other` property (line 688);
  - (ii) insert the companion before `q<i>` instead of after it;
  - (iii) pass the companion keys as `required` to `elicitFormFromAcpClient`, instead of `undefined` (line 699).

  Store each mutation as a patch against the 2.2 commit: `mutations/<i|ii|iii>.patch` next to the script. For each patch, the script refuses unless `git diff --quiet -- packages/coding-agent/src/modes/acp/acp-agent.ts` holds. It then runs `git apply` with the patch and runs, each on its own, the four v1 request-shape tests (`test/acp-agent.test.ts`, exact names from 2.1) and the v2 test (`test/acp-v2.test.ts`). Then it runs `git apply -R` with the patch. It writes the outputs to `mutations/<i|ii|iii>.txt`. It exits non-zero unless, for every patch:
  - at least one v1 request-shape run reports `1 fail` with `expect(received).` in its output;
  - the v2 run reports `1 fail` with `expect(received).` in its output;
  - after `git apply -R`, `git diff --quiet` holds for `acp-agent.ts`.

  Finally it runs the four v1 tests and the v2 test on the clean source and requires `0 fail` for each. The patches and `mutations/*.txt` are committed with the script, in the 2.4 commit.
- [ ] 2.4 Changelog. Add exactly this line under `## [Unreleased]` → `### Fixed` in `packages/coding-agent/CHANGELOG.md`: `- Fixed typed "Other" answers to the ask tool being lost over ACP: clients such as JetBrains Air that return the typed text in the select field no longer end the turn as cancelled or drop the answer`. Commit (`docs(coding-agent): …`). Verify: `cd /Users/tim/git/oh-my-pi/.worktrees/acp-ask-free-text && awk '/^## \[Unreleased\]/{u=1;next} /^## \[/{u=0} u' packages/coding-agent/CHANGELOG.md | grep -qF 'Fixed typed "Other" answers to the ask tool being lost over ACP'`

## 3. Final verification

- [ ] 3.1 Integration check over the touched suites and their neighbours. Verify: `cd /Users/tim/git/oh-my-pi/.worktrees/acp-ask-free-text && bun check && cd packages/coding-agent && bun test test/acp-agent.test.ts test/acp-v2.test.ts test/acp-v1-golden.test.ts test/tools/ask.test.ts`
- [ ] 3.2 F1. Manual QA on the real surface (JetBrains Air in IntelliJ, ACP v1), on the final head. Verify: `cd /Users/tim/git/oh-my-pi/.worktrees/acp-ask-free-text/.omp/team-config/evidence/gate/acp-ask-free-text-answers/f1 && test "$(grep -lx 'RESULT PASS' a.md b.md c.md | wc -l | tr -d ' ')" = 3 && cmp ~/.jetbrains/acp.json ~/.jetbrains/acp.json.bak-acp-ask-free-text`
  - Setup: back up `~/.jetbrains/acp.json` to `~/.jetbrains/acp.json.bak-acp-ask-free-text`. Add the agent entry `"omp (worktree acp-ask-free-text)"` with command `bun`, args `["/Users/tim/git/oh-my-pi/.worktrees/acp-ask-free-text/packages/coding-agent/src/cli.ts", "acp"]`, and the existing omp entry's `PATH` env. It uses the real agent directory.
  - Run: in a new Air chat with that agent in `/Users/tim/git/oh-my-pi`, prompt the agent to call `ask` once per scenario. The user answers in Air:
    - (a) one single-select question, answered with typed text via "Other";
    - (b) one multi-select question, answered with one option plus typed text;
    - (c) two single-select questions in one dialog: the first answered with an option, the second with typed text.
  - Evidence: one file per scenario, `.omp/team-config/evidence/gate/acp-ask-free-text-answers/f1/<a|b|c>.md`, holding:
    - the prompt;
    - the Air journal's `ElicitationRequested` and `ElicitationResolved` lines for that request (`jq` over `~/Library/Caches/JetBrains/IntelliJIdea2026.2/acp/projects/*/threads/*/events.jsonl`, matched by `requestId`);
    - the omp session's `toolResult` text for the `ask` call;
    - one line `RESULT PASS` or `RESULT FAIL`, written from that output.
  - PASS means:
    - (a) the result reads `User provided custom input: <typed text>` and the turn continues;
    - (b) the result carries the chosen option and the typed text;
    - (c) the second question's line carries the typed text in quotes, and no line reads `(cancelled)`.
  - Afterwards, restore `acp.json` from the backup.

## Workflow follow-up

- F2 merge gate (`review-work`) comes after 3.2 and is never a checkbox. The record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder must be final before the F2 snapshot.
- Merge only after the F2 record validates; then archive the change.
- Upstream PR to `can1357/oh-my-pi`, on top of `upstream/main`, with the fix only (decoding, tests, changelog): held locally until the user decides to open more upstream PRs. Do not propose posting it before then.
