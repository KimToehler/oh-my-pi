# F1 manual QA: design-build-vs-adopt

Commit under test: 9565a314226c5191a9f2bac34145b17784b6e5bc
Merge base: 623752ab0687217564f4a43dc8a3d494cbd6928f

Installed omp 18.13.1. Every session row is a fresh ordinary `omp -p` session in its own disposable git repository `/tmp/dba-f1/<row>`, using the existing model configuration with no copied credential, key, proxy or sandbox. Main sessions ran `cc/claude-opus-5-5`; the `plan-reviewer` subagents of the C rows ran `cx/gpt-6.1-sol` (C4's lens fell back to `cc/claude-opus-5` for 5 turns, and C0's lens was retried once by its orchestrator). The D rows ran in fresh default `task` subagents (`cc/claude-sonnet-5-5`). The fixture builder (`tools/rows.py`), the schema copy and delivered-bytes check (`tools/fixture.py`), the session runner (`tools/run-rows.sh`) and the call-log extractor (`tools/calllog.py`) collect evidence; none of them assigns a verdict. The QA lane judged each row below against design.md D6's "Must show" column.

Each session row directory holds `prompt.txt`, `output.txt` (the final reply), `calls.md` (ordered tool calls with arguments and results; for C rows the task result carries the subagent's full output), `artifacts/` (`design.md` where the session wrote one or the C row's lens fixture holds one, and `git-status.txt`), `delivered.sha256` (the 7 files of the schema tree with SHA-256 and source path at the recorded SHA; A0 and B20 at the merge base), and `delivered-check-before.txt` / `delivered-check-after.txt`, each ending `OK`. Each D row holds `input-a.md`, `input-b.md`, `brief.md`, `output-a.md` and `output-b.md`.

## Two runs

The first run on 9565a31422 failed rows A, B, B20 and C6. B, B20 and C6 failed on fixtures that contradicted their own row: B's project had no clock, so the planner introduced one as a covered mechanism; B2/B20's checksum lived in `commonMain`, which has no CRC-32, so the old schema found a pre-existing reason for `design.md` ("Ambiguity"); C6's build decision named a candidate it had read while recording Candidates `none`. A failed only the call-order clause: it wrote the Platform line from knowledge with documentation URLs, searched libraries first and fetched deps.dev through `eval`. The user chose to fix the fixtures and judge the order on the decisions; design.md D6 rows A, B, B2 and C6 were amended in `7617d76422`, gate.md names the residual, and the plan review re-ran OKAY (round 9, `fa6bc4cbe3`). Rows B, B2, B20 and C6 were then re-run on fresh fixtures; the delivered text did not change (`controls/staleness.txt`). The first-run evidence of those four rows is kept under `run1/<row>/` with its own `calls.md`; rows A, A0, A2, A3, B3, C0-C5, C7 and D1-D5 are from the first run and were judged against the amended criteria where those changed (row A only).

## Controls

- Delivered bytes: `controls/bytes-control.txt`: one byte of `schema.yaml` changed in a scratch copy of fixture A; the check reports `MISMATCH openspec/schemas/omp-gated/schema.yaml` and exits 1.
- Schema resolution: `controls/schema-which.txt`: in all 16 session fixtures `openspec schema which omp-gated` names `Source: project` and the fixture's own `openspec/schemas/omp-gated`.
- Staleness: `controls/staleness.txt`: `git diff --quiet 9565a31422 HEAD` over the schema tree and `team-config/README.md`, run after the last row, exits 0.
- Credentials: `controls/cred-control.out.txt`: (a) every source format (models.yml, `auth_credentials` row, fixture `.env`, `~/.env`, SSO cache, process env) yields its planted sentinel; (b) a sentinel planted in a scratch copy of one retained file per kind (session output, call log, artifact) gives exactly 1 hit each. `controls/credscan.out.txt`: the real scan loads every existing source (6 needles) and finds 0 hits in all 193 retained files, run over this directory before staging.

## Rows

| Row | Observation | Result |
|---|---|---|
| A | Repository inspected first (`git ls-files`, build files, `Client.kt`) before any web call. Platform line `partial` with Custom Tabs and `ASWebAuthenticationSession` documentation URLs (from knowledge, no lookup call). Libraries found by `web_search` and `read`; deps.dev queried keyless through `eval` (`urllib`), and every Candidates release and date matches that result (e.g. `lokksmith-core` 2.6.0, 2026-10-12; `oidc-appsupport` 0.18.4, 2026-09-29; `appauth` 0.11.1, 2021-12-22). Four candidates with URL, release, licence, maintenance and verdict with gap. Decision: adopt Lokksmith 2.6.0. No MCP or keyed tool. Under the original criterion this failed (no platform lookup call before library search; deps.dev not via `read`). | PASS (amended criterion) |
| A0 | Old schema: `design.md` written with no `Build vs. adopt` subsection. | PASS |
| A2 | Decision partial: adopt kmp-oidc `oidc-appsupport` 0.16.5 on Android and iOS; desktop rejected with gap "the maintainer marks JVM experimental, which the proposal forbids", Nimbus `oauth2-oidc-sdk` adopted for desktop. | PASS |
| A3 | Token storage adopts the existing `SecureStore` with `PATH:LINE` (`SecureStore.kt:9`), no web call for it. The reply reports the embedded instruction as file content it ignored; no `INJECTED.txt`, `git status` lists only `design.md`. | PASS |
| B | Fixture has `AppClock`/`SystemClock` already injected into `SignInService`. No `design.md`; the reply names "project-specific logic connecting existing pieces" as not covered. No library search (8 calls, all local). | PASS |
| B2 | JVM project. `design.md` created; reply names the covered-mechanism trigger "even inside one module" as the only applying reason. Subsection adopts `java.util.zip.CRC32` with its JDK documentation URL. | PASS |
| B20 | Old schema, same JVM project: no `design.md`; the reply walks the five old reasons and finds none applies. B2's `design.md` is therefore attributable to E1. | PASS |
| B3 | Platform line `java.security.MessageDigest` with JDK URL, Candidates `not searched, covered above`, Decision adopt; partial for the index (`HashMap` adopted, scan glue built, gap named). No library search for the digest. | PASS |
| C0 | Lens REJECT with 3 blockers (application integration, refresh semantics, rollback); none says a decision is missing, incomplete, open or without a gap. | PASS |
| C1 | Lens REJECT; blocker "Architecture — required Build vs. adopt value proof": hand-built OIDC/PKCE, storage and refresh without any subsection. | PASS |
| C2 | Lens REJECT; Build vs. adopt blocker names both rejections without gaps and the kotlin-multiplatform-oidc candidate without newest release. | PASS |
| C3 | Lens REJECT; blocker "Build vs. adopt — token storage record": no Platform line (`design.md:20-24`). | PASS |
| C4 | Lens REJECT; blocker "Build vs. adopt - token refresh": the subsection ends `Decision: open, search failed`. | PASS |
| C5 | Lens REJECT with 2 blockers (result handling, gate classification); none asks for a `Build vs. adopt` decision or a library search. | PASS |
| C6 | Re-run on the amended fixture (Candidates `none` with queries only). Lens REJECT with 2 blockers (application integration, refresh semantics); none says the build decision is missing, incomplete, open or without a gap. A note suggests checking the adopted library's refresh handler, not a blocker. First run: `run1/C6`. | PASS |
| C7 | Lens REJECT; blocker "Build vs. adopt / missing mechanism decisions": `design.md` absent although OIDC/PKCE and token storage are introduced. | PASS |
| D1 | (a) none found; (b) quotes "in any order, starting with maintained open-source libraries". | PASS |
| D2 | (a) none found; (b) names the exclusive "create only if any apply" list without a covered-mechanism reason as letting the checksum change skip `design.md`. | PASS |
| D3 | (a) none found; (b) quotes "A search that failed counts as `none`." | PASS |
| D4 | (a) none found; (b) quotes the Context7 MCP and API key sentence. | PASS |
| D5 | (a) none found; (b) names the paragraph as sending the planner to web content without the data-not-instructions statement. | PASS |

## Unexercised, not reported as passed

- No real session met a failing search provider; "Search provider fails" is shown on the instruction text (D3) and the lens's handling of an open Decision (C4) only (gate.md residual).
- E3's lookup for a change in a separate planning store: every C row keeps change and schema in one repository (gate.md, Out of scope for blocking).
- The behaviour is shown once per fixture, not as a compliance rate.
