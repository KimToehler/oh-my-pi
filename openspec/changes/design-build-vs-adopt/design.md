# Design

## Context

See proposal.md - Why. Current state, read in this worktree (`S` is `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml`):

- The design instruction (`S:175-207`, `requires` at `S:209`) lists when to create `design.md` (`S:178-182`) and asks for "alternatives considered" per decision (`S:187`). It says nothing about what already exists. It ends with the scope check (`S:197-201`) and "Focus on architecture and approach" (`S:203`). `templates/design.md:17` holds the Decisions comment.
- The review instruction dispatches three lenses with fixed paragraphs that "carry nothing about this one" change (`S:339-340`). The correctness lens is `S:355-363`.
- `plan-reviewer` has `read`, `grep` and `glob` (`packages/coding-agent/src/prompts/agents/plan-reviewer.md:4`) and no `web_search`. Its `read` can fetch a URL it is given. The lens checks that a decision exists, is complete and names its gaps, from the plan alone; it is not asked to verify cited libraries or releases against the web.
- Projects receive a copy of the schema at `openspec/schemas/omp-gated/` through `install-openspec-workflow.mjs` (`team-config/agent/skills/review-work/scripts/install-openspec-workflow.mjs:27`). In this repository that path is a symlink to `team-config/agent/skills/review-work/openspec/schemas/omp-gated`; onara and weaver hold copies.
- The research tools were exercised while planning, without a key: `web_search` "Kotlin Multiplatform OIDC client library PKCE" returned `kalinjul/kotlin-multiplatform-oidc` first, and `read` on `https://api.deps.dev/v3/systems/maven/packages/io.github.kalinjul.kotlin.multiplatform%3Aoidc-appsupport` returned all 52 versions with `publishedAt`, the newest 0.18.4 of 2026-09-29. The list is not sorted by date, so the newest release is the one with the latest `publishedAt`.

## Goals / Non-Goals

**Goals:**
- Covered mechanisms are looked up before they are designed, in a fixed order that stops at the first stage that covers the mechanism.
- The decision is short enough to write in every covered case and complete enough for the correctness lens to check from the plan alone.

**Non-Goals:**
- The reviewer verifying external facts (versions, licences) or searching for candidates the planner missed: out of scope (proposal.md).
- Plan-mode plans, the implementation phase and any script or validator enforcement.

## Decisions

### D1. The rule lives in the design instruction; the correctness lens reads it from there

The design instruction is where an `omp-gated` change decides how to build. A rule there runs at the moment the approach is chosen, so the search can still change the design. The correctness lens names the schema path instead of restating the rule. Its paragraph is fixed for every change, so a second copy of the rule would drift.

Alternatives: a team rule file with plan-path globs (rejected: it would be injected only when a plan file is touched, which is often after the approach is set, and it would be a second copy next to the schema); giving `plan-reviewer` web search so it finds missed candidates itself (rejected: cost and untrusted web content in the reviewer; the planner records the search and the reviewer checks the record); a Context7 MCP server or its REST API (rejected in `plan-adopt-and-cap`: its tool descriptors load into every session, and the keyless REST quota ran out while planning).

### D2. Search order and decision form

The order (repository and installed dependencies, platform or standard library, maintained libraries) is the ladder Ponytail uses (`https://github.com/dietrichgebert/ponytail`, "How it works": "stop at the first rung that holds"). It stops at the cheapest stage that covers the mechanism: a platform API that covers it needs no library search, and a mechanism the repository already has costs one line. The requirement states the same stop rule.

The form has four labelled lines. Each fact carries what a reader needs to check it: a `PATH:LINE` for the repository, a documentation URL for the platform, and per candidate its URL, newest release and date, licence and maintenance state. Every build or reject verdict names its gap, because a rejection without a gap is exactly the failure from the proposal. Auth, crypto and protocol mechanisms are never built when any stage covers them: hand-building them is where the proof surface and the review rounds came from. A covering repository, dependency or platform implementation counts as adoption, so a standard-library crypto primitive that meets the need is used without a library search.

`plan-adopt-and-cap` also required a verbatim source quote per fact. That is dropped: the lens is not asked to check facts against web sources, and the quotes made every decision several times longer.

### D3. `design.md` trigger

`design.md` is optional (`S:178-182`), and `/opsx-propose` skips it when no reason applies. Without a trigger, a single-module parser or retry policy would never meet the rule.

### D4. Delivered text

The edits are insertions only; no existing line changes. Task 1.1 compares the inserted lines with the blocks below.

#### E1: after `S:182`

~~~~text
      - The change builds a mechanism the `Build vs. adopt` paragraph below covers, even inside one module
~~~~

#### E2: after `S:202`, before "Focus on architecture and approach"

~~~~text
      Build vs. adopt: a mechanism that implements a published protocol, format or algorithm
      (OAuth/OIDC, JWT, a crypto primitive, a wire or file format) or general-purpose
      infrastructure not specific to the project's domain (token storage, retry and backoff,
      scheduling, caching, a UI widget) is covered. Project-specific logic and glue between
      existing components are not. Before designing a covered mechanism, search for what already
      provides it, in this order, and stop at the first stage that covers it: this repository and
      its installed dependencies, the platform or standard library, then maintained open-source
      libraries. Record one subsection per covered mechanism under Decisions:

        ### Build vs. adopt: <mechanism>
        - Repository: <PATH:LINE of what this repository or an installed dependency offers, or none and the paths searched>
        - Platform: <documentation URL of what the platform or standard library offers, or none and what was searched> | not searched, covered above
        - Candidates: <per library: URL; newest release and its date; licence; maintained or archived; adopt, or reject with its gap> | none and the searches run | not searched, covered above
        - Decision: adopt <what> | build, gap: <what nothing above covers> | partial, adopted: <part>; built: <part>; gap: <gap>

      A build or reject verdict names its gap. Auth, crypto and protocol mechanisms are never
      built when a stage above covers them: building one names a gap that none covers. Research with
      tools every session has, without an API key, quota or MCP server: `web_search` to find
      candidates; `read` on repository, registry and documentation URLs; `read` on
      https://api.deps.dev/v3/systems/<system>/packages/<name> for every release and its date
      (system maven, npm, pypi, cargo, go or nuget; a Maven name is <group>%3A<artifact>; the
      list is not in date order, so the newest release has the latest publishedAt).

~~~~

#### E3: after `S:363`, the last line of the correctness lens paragraph

~~~~text
         Read the `Build vs. adopt` paragraph of the design instruction in
         openspec/schemas/omp-gated/schema.yaml under the repository root: a mechanism it covers
         that the plan builds without its subsection in design.md, a subsection missing a line or
         a candidate fact the paragraph's form asks for, or a build or reject verdict without a
         gap is a blocker.
~~~~

#### E4: `team-config/agent/skills/review-work/openspec/schemas/omp-gated/templates/design.md`, after line 17

~~~~text

<!-- Build vs. adopt: one subsection per mechanism the design instruction's paragraph covers
### Build vs. adopt: <mechanism>
- Repository: <PATH:LINE of what this repository or an installed dependency offers, or none and the paths searched>
- Platform: <documentation URL of what the platform or standard library offers, or none and what was searched> | not searched, covered above
- Candidates: <per library: URL; newest release and its date; licence; maintained or archived; adopt, or reject with its gap> | none and the searches run | not searched, covered above
- Decision: adopt <what> | build, gap: <what nothing above covers> | partial, adopted: <part>; built: <part>; gap: <gap>
-->
~~~~

#### E5: `team-config/README.md`, before the paragraph "The last artifact `/opsx-propose` creates is `review.md`."

~~~~text
Before a design builds a mechanism that implements a published protocol, format or algorithm, or general-purpose
infrastructure, the design instruction asks the planner to search this repository and its dependencies, then the
platform, then maintained libraries, stopping at the first that covers it, with `web_search`, `read` and the deps.dev
API (no key or MCP server). Each such mechanism gets a `Build vs. adopt` decision in `design.md`; auth, crypto and
protocol mechanisms are never built when one of those covers them. The correctness lens of the plan review blocks on
a missing or incomplete decision and on a verdict without a gap.

~~~~

### D5. Build vs. adopt for this change

The change adds instruction text, a template comment and a README paragraph. None of it implements a protocol, format, algorithm or general-purpose infrastructure, so it needs no `Build vs. adopt` decision.

### D6. Verification

The delivered text is proved deterministically (tasks 1.1-1.3). The behaviour is observed in fresh ordinary `omp -p` sessions with the existing model configuration and no copied credential, as the `Change verification` section of `skill://review-work` describes. No checker scores model output; the QA lane judges the retained outputs.

Each row runs in its own disposable git repository under `/tmp/dba-f1/<row>`. Unless the row says otherwise, the fixture holds a small Compose Multiplatform skeleton (`settings.gradle.kts` with `:shared`; `shared/build.gradle.kts` with the targets the row's proposal names and a Ktor client; one `shared/src/commonMain/kotlin/http/Client.kt`), `openspec/config.yaml` with `schema: omp-gated`, and the delivered `schema.yaml` and `templates/design.md` at `openspec/schemas/omp-gated/` (`openspec schema which omp-gated` gives `Source: project`). Design rows use the prompt "Create design.md for the OpenSpec change <name>: get the instruction with `openspec instructions design --change <name> --json` and follow it. Write only design.md." unless the row names another.

| Row | Covers | Fixture and prompt | Must show |
|---|---|---|---|
| A | rule fires, order, tools, adoption, decision content | Change `keycloak-sign-in` with `.openspec.yaml` and a proposal for Keycloak sign-in through OIDC authorization code with PKCE, token storage and token refresh on Android and iOS. | `design.md` holds a `### Build vs. adopt:` subsection for the sign-in flow with Repository, Platform, Candidates and Decision lines. The call log shows a repository search (`grep`, `glob` or `read` in the fixture) before any web call, then a platform lookup reflected on the Platform line, then library discovery by `web_search` or `read`, and a `read` of the deps.dev package endpoint whose result lists versions with publish dates; the newest release and date on the Candidates line match that result. Each listed candidate has a URL, newest release with date, licence and maintenance state. The Decision adopts a maintained library for the sign-in flow (a library stable on Android and iOS exists: `kotlin-multiplatform-oidc`). No MCP or keyed tool is called. |
| A0 | negative control | Row A with `schema.yaml` and `templates/design.md` from the merge base. | `design.md` has no `Build vs. adopt` subsection. |
| A2 | partial coverage | As A, but the proposal targets Android, iOS and desktop (JVM) and states that every release target may use only components their maintainers mark stable. `kotlin-multiplatform-oidc` marks Desktop (JVM) "Experimental" in its README. | The Decision is partial: it adopts a library for Android and iOS, names what is built or done otherwise for desktop, and names the desktop gap with its source (the candidate's stability statement). |
| B | not covered | Change `trial-expiry`: refuse sign-in for accounts whose trial has ended, using the existing account model. Prompt: "Decide from `openspec instructions design --change trial-expiry --json` whether this change needs design.md, and create it only if it does." | No `Build vs. adopt` subsection and no library search. |
| B2 | `design.md` trigger | Change `ics-import` in `:shared` only: import iCalendar (RFC 5545) files into the app's calendar. Prompt as in B with this change name. | `design.md` is created and holds a `Build vs. adopt` subsection for the parser. |
| B3 | stop at the platform | A plain Kotlin/JVM project (`build.gradle.kts` with `kotlin("jvm")`, one `src/main/kotlin/Upload.kt`) instead of the skeleton. Change `upload-dedupe`: skip storing an uploaded file whose SHA-256 digest matches a stored one. | The `Build vs. adopt` subsection for the digest records the JDK's `java.security.MessageDigest` on the Platform line, Candidates `not searched, covered above`, and Decision adopt; the call log shows no library search for it. |
| C1 | lens, missing decision | Change `keycloak-sign-in` complete (proposal, one spec requirement with its negative control, gate.md, tasks.md); `design.md` hand-builds OIDC with PKCE, token storage and refresh without any decision. Prompt: "Run step 3 of the review instruction from `openspec instructions review --change keycloak-sign-in --json` for item 1 only: dispatch one plan-reviewer task with the brief and the correctness lens paragraph verbatim, paths filled in. Print the reviewer's full output. Edit nothing." | REJECT with a blocker naming the missing `Build vs. adopt` decision. |
| C2 | lens, incomplete decision | As C1, but `design.md` records the decisions, rejects every candidate and decides build without naming any gap, and one candidate has no newest release or date. | REJECT with blockers naming the missing gap and the missing release. |
| C0 | lens, complete decision | As C1, but `design.md` adopts `kotlin-multiplatform-oidc` through complete decisions. | No blocker about the `Build vs. adopt` decisions; other blockers about the fixture are recorded, not judged. |

Unexercised by design: the "Nothing found" branch. A fixture whose mechanism truly has no implementation anywhere cannot be built reliably; the branch shares the form and the gap rule that A2, C2 and the delivered-text check cover.

Evidence goes to `.omp/team-config/evidence/gate/design-build-vs-adopt/f1/`: per row `prompt.txt`, `output.txt` (the session's final reply), `calls.md` (ordered tool calls with arguments and results, subagent output included) and `artifacts/` (the written `design.md` where one exists, and `git status --short`); the fixture builder under `tools/`; and `README.md` with the commit under test, one table row per row above with its observation and result, unexercised branches, and a credential scan of every retained file with its hit count.

## Risks / Trade-offs

- [The planner fills the form with a token search] → The lens blocks only missing or gap-less decisions; whether the search was good stays a judgement the user sees in `design.md`. F1 shows real research on one case, not a compliance rate.
- [The coverage line is fuzzy ("general-purpose infrastructure")] → Examples in the paragraph; the cost of a false positive is one short subsection.
- [Reported versions or licences are wrong] → The URL makes each fact checkable by the user; the reviewer is not asked to check them (Non-Goals).
- [More lens text dilutes the correctness focus] → One sentence that points to the rule rather than restating it.

## Migration Plan

`scripts/deploy-local.sh`, then `install-openspec-workflow.mjs` in onara and weaver, then restart running sessions. Rollback: revert the commit and repeat the same steps.
