## 1. Goal and behavioural contract

The implementation covers the intended configuration surfaces, but the data-preservation contract has one uncovered exception: the installer can replace user-modified manifest content without a backup. The supplied QA also does not establish the advertised deploy-script-to-binary path end to end.

## 2. Correctness, regressions, architecture, wire contracts

**Blocker — High: user content in the manifest can be silently discarded.**  
**Evidence:** `scripts/install-team-config.ts:189–204, 230–242, 398–419, 507–508`.

`parseManifest` accepts a valid v1 or v2 manifest but retains only its recognised fields. `writeManifest` checks that the file has not changed *since planning*, then renames a newly serialized manifest over it without backing up the original. Thus, for example, a user-added top-level `"notes"` field in an otherwise valid `.team-config-manifest.json` disappears on reinstall—even if the manifest was unchanged throughout that run. A pre-existing valid manifest not written by this installer has the same exposure.

This violates the brief’s constraint to preserve content the installer did not write. The existing manifest drift check protects changes **during** installation, not user content already present before planning.

**Fix direction:** Preserve the original manifest bytes before replacing a manifest whose ownership and unchanged status cannot be established, or abort without replacing it. Cover both a pre-existing valid manifest and a locally edited installer-created manifest with real-filesystem tests.

**class:** Unbacked replacement of installer control-file content.  
**sites:** `.team-config-manifest.json` is the single control-file instance: the three intent, partial, and final persistence paths all funnel through `writeManifest` at line 400 and the same rename at line 242. Search: `\.team-config-manifest\.json|writeManifest\(|manifestBytesOf\(|persist\("(intent|partial|final)"` across the repository. All three paths therefore need the same protection.

## 3. Security and privacy delta

**Security delta: yes.** The shipped models configuration introduces the router as a network recipient and uses `ONARA_ROUTER_KEY` for authentication. The reviewed sentinel artifact reports the key confined to the intended mode-600 `.env` sink for its tested bash and zsh scenarios. The public-tree scrub artifact reports the named mechanical checks passing, with the allowed third-party example exception.

The plan expressly accepts same-user path-substitution races and the seeded `yolo` approval mode; I did not treat those accepted risks as blockers. I found no additional substantiated security blocker in the reviewed delta.

## 4. Verification adequacy

**Blocker — Medium: the named deploy boundary was not exercised in the supplied QA.**  
**Evidence:** `scripts/deploy-local.sh:40–82`; `.omo/evidence/team-config/wave-1/f1-1-fresh-install.txt`; `f1-2-omp-run-fresh-dir.txt`; `verification-322542da67.txt`.

The fresh-install artifact invokes `bun scripts/install-team-config.ts` directly, while the runtime artifact invokes an existing `~/.bun/bin/omp`. The verification artifact records `bash -n` for the deploy script, not a deployment. These observations support the installer and binary separately, but do not show that a colleague’s `scripts/deploy-local.sh` invocation builds and installs the binary and syncs config from the same selected ref—the goal and the stated binary boundary.

**Fix direction:** Capture a real deploy invocation on the reviewed head into isolated binary and agent directories, then run the resulting binary with that installed configuration. Record the selected ref/commit and the runtime observations in the QA artifact.

**class:** Unverified deploy-to-runtime integration.  
**single instance:** `scripts/deploy-local.sh:82` is the sole shipped deploy-to-installer invocation found by searching `deploy-local\.sh|install-team-config\.ts` in the scripts and setup documentation; the supplied wave-1 artifacts contain no deployment transcript.

The supplied artifacts otherwise document fresh installation, reinstall and v1 migration transitions, key handling, validator refusal, 259 passing tests, lint, and the mechanical scrub. No checks were run during this read-only audit.

## 5. Final assessment

The manifest preservation defect and missing real-deploy witness block this gate. The copied skills’ content quality remains outside blocking scope, as specified by the plan.

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: A successful deploy installs a binary and managed team configuration from the same explicitly selected ref, rather than mixing artifacts from different refs.
  positive_witness: Deploying ref B after ref A produces a runnable binary identified with B and installs a distinguishing managed configuration file from B.
  negative_control: A deploy that installs B's binary while retaining A's distinguishing managed configuration must fail the criterion.
  observable: The deployed commit identity, distinguishing installed file bytes, deploy exit status, and output from the deployed binary.
  boundary: scripts/deploy-local.sh invoked against a real checkout with isolated binary and agent directories.
END-REVIEW-TRAILER
