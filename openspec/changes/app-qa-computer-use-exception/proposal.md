# Proposal

## Why

The team skill `app-qa-drivers` forbids every OS-level GUI call (`team-config/agent/skills/app-qa-drivers/SKILL.md:84`), and the spec requirement "The team skill routes a fresh agent to the shared driver" (`openspec/specs/app-qa-driver/spec.md:254`) makes any such call by a fresh agent a failure. The tag driver (`qa.mjs`) cannot reach a screen reader, a dialog the app raises or a simulator host menu, so a VoiceOver pass today has no sanctioned tool. omp now ships a `computer` eval prelude (setting `computer.enabled`, `packages/coding-agent/src/tools/settings.ts:635`) with window screenshots, accessibility trees and native input. A real pass on 2026-11-12 used it for VoiceOver on weaver's desktop app and found that Compose Desktop exposes containers as `AXUnknown` and the engine views are opaque to VoiceOver, findings no tag driver can produce (weaver, branch `plan/m5-app-design-workspace`, commit `2ef16890`, `.omp/team-config/evidence/gate/m5-app-design-workspace/f1/voiceover-human/README.md`). That pass cost about 40-50k tokens (a window screenshot about 1,400, an 86-node tree about 3,000, an unfiltered `observe()` about 5,000; a driver tag lookup a few dozen), so the exception has to be narrow and economical.

## What Changes

- The team skill allows omp's `computer` prelude for exactly three kinds of surface the driver cannot reach: screen readers (VoiceOver and its caption panel, TalkBack output), dialogs the app under test raises, and simulator or emulator host menus (for example Xcode 27 DeviceHub's Device > Accessibility menu). Everything a test tag reaches keeps going through the driver; computer use never replaces it.
- Only the `computer` prelude; raw `osascript`, System Events, CGEvent, `screencapture` and custom Swift helpers stay forbidden for every surface.
- Only for an app whose `.omp/app-qa.json` configures no `credentials`: an app with a sign-in surface gets no computer use at all. Only one resolved target window is captured or read (the app under test, a dialog it raised, the screen reader's caption panel or the simulator host window); no display or desktop capture, no other app's window. The rule `ui-automation-credentials` keeps every existing line unchanged; it gains a trigger so it loads before a `computer` call and one pointer bullet. Dialogs of other processes are out of scope.
- The rule `ui-automation-credentials` also carries the folder and search clauses of the skill's section "Evidence you did not write" and loads on a `mkdir` naming an evidence path, because F1 sessions acted on evidence folders before reading the skill (design D12); rule and skill exclude `**/evidence/**` and `**/*-evidence/**` from any search over the whole worktree (design D13).
- Economy rules: capture the target window only, zoomed or silent captures combined into one grid; print only the accessibility lines the check needs; no whole-tree dump, no unfiltered observation, no desktop capture.
- Evidence a session keeps states that computer use was used and for which surface.
- The skill's section "Proving a QA instruction change" gains the proof for this exception: fresh sessions in both directions, with the same capture-and-scan discipline.
- The credential rule `ui-automation-credentials` loads before any `computer` helper call and points such a call, in a repository with `.omp/app-qa.json`, to the skill and its credentials and one-window limits; the skill's description routes any computer use there, so a request not phrased as a QA check still reaches the limits.
- The skill's section "Evidence you did not write" also covers evidence the task does not name: a search never covers an evidence folder, `.omp/` or `.omo/` as a whole, or runs with ignore rules off (F1 found a search that returned another change's gate evidence); the session creates its own output folder with `mkdir` without `-p` in its own step and never passes an `--out` below a folder it did not create.
- **Not in this change** (assumptions, recorded): `computer.enabled` keeps its default `false` in code; enabling it stays a per-user setting (Tim's `~/.omp/agent/config.yml` already has it), so a session without the prelude reports it missing. No change to `qa.mjs`, the prelude, onara's or weaver's repository QA skills, or the DeviceHub input skill.

## Capabilities

### New Capabilities

### Modified Capabilities
- `app-qa-driver`: the requirement "The team skill routes a fresh agent to the shared driver" gains the computer-use carve-out in its scenarios and negative control, and a search clause, scenario and negative-control clause for evidence the session did not write; five ADDED requirements define the exception (surfaces and no-substitution, refusal for apps with a sign-in surface, one target window, economy, evidence naming).

## Impact

- Changed: `team-config/agent/skills/app-qa-drivers/SKILL.md` (the "No OS-level GUI scripting" bullet becomes the exception, one new section, the intro line, the failed-preflight bullet, the evidence section and the proof section), `team-config/agent/rules/ui-automation-credentials.md` (two conditions, description, two bullets). `team-config/agent/AGENTS.md:20` and `team-config/README.md` stay unchanged.
- Deployment: `scripts/deploy-local.sh` already mirrors `team-config/agent/**`; no new install.
- Consumers: every agent session in a repository using the shared driver; effective only where `computer.enabled` is true.
- Credentials: no credential is handled by the change, but it relaxes a ban next to the credential guardrail; see gate.md.
