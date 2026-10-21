## 1. Goal and behavioural contract

The implementation covers the requested setup surfaces, and the supplied real-deploy evidence closes the previous wave’s missing deploy-to-runtime witness. One data-preservation blocker remains: strict manifest parsing rejects unsupported fields, but it still accepts and replaces valid user-authored manifest bytes without preserving them.

## 2. Correctness, regressions, architecture, wire contracts

**Blocker — Medium: a valid, user-authored manifest is replaced without backup.**  
**Evidence:** `scripts/install-team-config.ts:253–292`, `:307–324`, `:479–483`, `:589–590`.

The row 19 fix rejects duplicate and extra members, but it does not establish ownership of an otherwise valid manifest. For example, a pre-existing `.team-config-manifest.json` containing the valid bytes `{"files":{},"version":2}` is accepted. Even if no managed step needs applying, the unconditional final persistence serializes a different manifest and renames it over those bytes. No backup is made. The same applies to a valid manifest whose formatting or recognized values a user changed before planning.

The comparison in `writeManifest` detects changes **after** planning; it does not establish that the bytes read at planning were written by the installer. This violates the brief’s requirement to back up user content before replacing it. It is new evidence against the previous F2 control-file class: rejecting unsupported schema does not close the valid-pre-existing-manifest case that that review also named.

**Fix direction:** Preserve the original bytes before replacing a manifest whose installer ownership and unchanged status cannot be established, or refuse the replacement. Add real-filesystem coverage for a valid pre-existing manifest and a valid locally edited manifest, including a no-managed-step run.

**class:** Unbacked replacement of installer control-file content.  
**sites:** The single control file is `.team-config-manifest.json`. Intent, partial, and final persistence all funnel through `writeManifest` and its rename; the final path is unconditional. Search run across the installer scripts and shipped team configuration: `\.team-config-manifest\.json|writeManifest\(|manifestBytesOf\(|persist\("(intent|partial|final)"`. The common write site remains open for all three persistence paths.

## 3. Security and privacy delta

**Security delta: yes.** The change ships the onara router configuration and its credential setup. The supplied sentinel artifact reports confinement to the mode-600 `.env` sink in its tested bash and zsh scenarios; the scrub artifact reports the named public-tree checks passing with the allowed third-party exception.

I found no additional substantiated security blocker in the changed code. The owner explicitly accepted same-user path-substitution races, concurrent deploy staging races, and the seeded `yolo` approval mode; those are not treated as blockers here.

## 4. Verification adequacy

The wave-2 evidence includes a real deploy into isolated binary and agent directories, an invocation of that deployed binary, and a failed-sync deployment that preserves the live binary and marker. These close the previous missing deploy-boundary witness. The supplied suite, migration, reinstall, validator-refusal, key-sentinel, and scrub artifacts provide coverage of the other named scenarios.

The strict-schema tests cover duplicate and unsupported members, but not preservation of valid user-authored control-file bytes. The accepted v1 migration witness does not resolve that ownership gap. No checks were run in this read-only audit.

## 5. Final assessment

The manifest preservation issue blocks the gate. Copied skill content quality remains outside blocking scope.

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: A deploy that cannot complete team-config synchronization does not publish the staged binary as the live executable.
  positive_witness: An invalid manifest causes deploy to exit nonzero while the previously installed executable and deployment marker retain their original bytes.
  negative_control: A deploy that swaps in the staged executable before reporting the manifest error MUST fail the criterion.
  observable: Deploy exit status and before-and-after hashes of the live executable and deployment marker.
  boundary: scripts/deploy-local.sh invoked against isolated real binary and agent directories.
END-REVIEW-TRAILER
