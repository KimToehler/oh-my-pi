# Proposal

## Why

The team skill `app-qa-drivers` forbids every OS-level GUI call (`team-config/agent/skills/app-qa-drivers/SKILL.md:84`), and the spec requirement "The team skill routes a fresh agent to the shared driver" (`openspec/specs/app-qa-driver/spec.md:254`) makes any such call by a fresh agent a failure. The tag driver (`qa.mjs`) cannot reach a screen reader, an operating-system dialog or a simulator host menu, so a VoiceOver pass today has no sanctioned tool. omp now ships a `computer` eval prelude (setting `computer.enabled`, `packages/coding-agent/src/tools/settings.ts:635`) with window screenshots, accessibility trees and native input. A real pass on 2026-11-12 used it for VoiceOver on weaver's desktop app and found that Compose Desktop exposes containers as `AXUnknown` and the engine views are opaque to VoiceOver, findings no tag driver can produce (weaver, branch `plan/m5-app-design-workspace`, commit `2ef16890`, `.omp/team-config/evidence/gate/m5-app-design-workspace/f1/voiceover-human/README.md`). That pass cost about 40-50k tokens (a window screenshot about 1,400, an 86-node tree about 3,000, an unfiltered `observe()` about 5,000; a driver tag lookup a few dozen), so the exception has to be narrow and economical.

## What Changes

- The team skill allows omp's `computer` prelude for exactly three kinds of surface the driver cannot reach: screen readers (VoiceOver and its caption panel, TalkBack output), operating-system or system dialogs, and simulator or emulator host menus (for example Xcode 27 DeviceHub's Device > Accessibility menu). Everything a test tag reaches keeps going through the driver; computer use never replaces it.
- Only the `computer` prelude; raw `osascript`, System Events, CGEvent, `screencapture` and custom Swift helpers stay forbidden for every surface.
- Never on a login, identity-provider or password-manager surface (nor a save-password dialog). The rule `ui-automation-credentials` keeps every existing line unchanged; it gains a trigger so it loads before a `computer` call, and one bullet naming the prelude's helpers among the calls it forbids on such a surface (a pointer, not a weakening).
- Economy rules: capture the target window only, zoomed or silent captures combined into one grid; print only the accessibility lines the check needs; no whole-tree dump, no unfiltered observation, no desktop capture.
- Evidence a session keeps states that computer use was used and for which surface.
- The skill's section "Proving a QA instruction change" gains the proof for this exception: fresh sessions in both directions, with the same capture-and-scan discipline.
- **Not in this change** (assumptions, recorded): `computer.enabled` keeps its default `false` in code; enabling it stays a per-user setting (Tim's `~/.omp/agent/config.yml` already has it), so a session without the prelude reports it missing. No change to `qa.mjs`, the prelude, onara's or weaver's repository QA skills, or the DeviceHub input skill.

## Capabilities

### New Capabilities

### Modified Capabilities
- `app-qa-driver`: the requirement "The team skill routes a fresh agent to the shared driver" gains the computer-use carve-out in its scenarios and negative control; four ADDED requirements define the exception (surfaces and no-substitution, no login surface, economy, evidence naming).

## Impact

- Changed: `team-config/agent/skills/app-qa-drivers/SKILL.md` (the "No OS-level GUI scripting" bullet becomes the exception, one new section, the intro line, the failed-preflight bullet and the proof section), `team-config/agent/rules/ui-automation-credentials.md` (one condition, description, one bullet). `team-config/agent/AGENTS.md:20` and `team-config/README.md` stay unchanged.
- Deployment: `scripts/deploy-local.sh` already mirrors `team-config/agent/**`; no new install.
- Consumers: every agent session in a repository using the shared driver; effective only where `computer.enabled` is true.
- Credentials: no credential is handled by the change, but it relaxes a ban next to the credential guardrail; see gate.md.
