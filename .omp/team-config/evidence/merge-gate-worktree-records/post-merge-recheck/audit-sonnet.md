1. Goal and behavioural contract

The code implements the contract as stated:
- The Gate proof must carry exactly one 40-hex `reviewed_sha` and exactly one `record <path>.json · validate-gate-record.mjs exit 0 at <sha>` line. Zero or multiple distinct values fail closed (`gate-record.ts` `gateBinding`).
- Absolute paths and `..` escapes are rejected.
- Every `git worktree list --porcelain` root is searched. A non-zero exit from that command blocks the claim.
- A record counts only if `schema`, `plan` and the full `reviewed_sha` all match. Different bytes at the same path and SHA block as ambiguous. No mtime fallback remains.
- `plan` is passed unchanged to `--plan`. The validator runs with `--repo` and `cwd` set to the owning checkout.
- Settlement uses only `origin/HEAD` and its local `refs/heads/<name>` counterpart. Each ref is pinned to a commit with `rev-parse --verify <ref>^{commit}`, then ancestry is checked, then `git show <commit>:<record>` is compared byte-for-byte with the checkout content.
- Prose in `SKILL.md`, `merge-gate-proof.md` and the extension header matches the code.

2. Correctness, regressions, architecture, wire contracts

No blocking defects found. Notes, none of which block:
- **Settlement skips validation (design, per plan).** A record that meets only the shape check (`schema`, `plan`, `reviewed_sha`) and sits on the default ref with its SHA as an ancestor is settled. The check does not look at verdicts or whether the record ever passed the validator. This is the intended trade-off, and the fabricated-proof residual is accepted in the plan.
- **Stricter than before.** Every completion claim in a later turn, such as a post-merge "done, merged", must re-quote the Gate proof with both the `reviewed_sha` and `record` lines. Previously a bare reply could pass once records were shipped-skipped. Replies without a proof are blocked with an actionable message.
- **Squash or rebase merges.** The reviewed SHA is not an ancestor of the default ref, so the record is not settled. It is revalidated at the current HEAD, the same behaviour as before. The plan puts this redesign out of scope.
- **Unhandled throws.** `recordAt` rethrows non-ENOENT errors such as EACCES or EISDIR, and `pi.exec` failures in `worktreeRoots` and `recordIsSettled` are not caught. A throwing stop handler may fail open depending on the host. This is reachable only through locally constructed states.
- **Symlinks.** `recordAt` checks containment lexically, not by `realpath`. A symlinked record under the repo could point outside it. This needs a deliberately built local file and reaches no protected asset.
- **UTF-8 comparison.** The check compares a utf8-decoded file with decoded `git show` output. Malformed bytes and autocrlf variants are edge cases. The plan lists the malformed-UTF-8 case as an accepted residual risk.
- **Worktree list parsing.** The porcelain parse of `worktree ` lines misreads paths that contain newlines. This is harmless in practice.
- **Prunable worktrees.** They surface as ENOENT and are skipped.

3. Security and privacy delta

`security_delta: no`.
- Record paths are confined under the repo root (`..` and absolute paths rejected).
- Subprocesses use argv arrays with no shell. A `--`-prefixed record path stays a value for `--record`.
- Settlement skips the validator by design. Fabricating a proof that names another valid record is an accepted residual risk. The extension is documented as a cooperative guard, not a security boundary.
- No protected asset is reachable.

4. Verification adequacy

The tests use real Git worktrees and fake only the `node` validator result. Coverage:
- worktree-only record, with argv asserted
- an unrelated record in main not substituted
- same-path, same-SHA divergent bytes
- worktree discovery failure
- missing SHA in the proof
- settlement via local main
- reviewed code merged without its record, not settled
- a non-default `master` branch, not settled
- the default ref moving mid-check
- a claimed SHA with no record

Gaps, all notes:
- No test for two distinct SHAs in one reply. The code path exists in `gateBinding`.
- No test for the record path escaping via `..` or an absolute path.
- No test for the `FAIL`/non-matching schema fallthrough.
- No test for a worktree that cannot be read.

I did not run the tests. The brief's QA matrix reports 317 pass and 0 fail, and I take that as given.

5. Verdict

PASS

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1, 2, 3, 4, 5
model_id: claude-sonnet-5-5
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: a reply that quotes two distinct full reviewed_sha values (for example a prior and a current Gate proof) never selects either record and never reaches the validator
  positive_witness: a reply with one reviewed_sha and one record line resolves to that record and runs or settles it
  negative_control: a reply with two different reviewed_sha lines is treated as bound to the first or newest sha and the validator runs against that record
  observable: stop decision is block with the no-single-binding message and zero node --record invocations
  boundary: gateBinding in team-config/agent/extensions/lib/gate-record.ts via the session_stop handler
END-REVIEW-TRAILER