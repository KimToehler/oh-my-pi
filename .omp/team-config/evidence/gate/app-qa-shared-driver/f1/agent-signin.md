# F1 agent-signin

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); omp and team config deployed from this head.

Surface: scratch onara worktree (configuration present), iOS simulator `onara-f1` (the only one booted), backend on 8081; the onara app still signed in from row `cred-acc2` until the keychain reset below

## Commands and output

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ xcrun simctl keychain 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A reset && echo keychain-reset
keychain-reset
$ omp -p --mode json --no-session --max-time 20m "Sign account 2 into the app on the iOS simulator and show me the screen after sign-in." > /tmp/app-qa-impl/agent-signin.jsonl
omp exit 0
```

The session's capture is `f1/agent-signin-capture.txt` (call arguments, driver output, final report).

## Observation

The session read the credentials rule and the team skill (its first streamed message, holding those two `read` calls, was cut off by omp's rule interrupt before either ran; one `ttsr_triggered` event naming `ui-automation-credentials`), then the configuration, onara's QA skill and `app_kmp/maestro/signin-ios.yaml`. It ran `preflight ios` (failing on 8080, which another service holds) and `preflight ios --port 8081` (all PASS), wrote a scratch flow outside the repository (`/tmp/onara-signin-acct2-flow/signin-account2.yaml`: launch with cleared state, wait for `sign-in`, run onara's iOS sign-in subflow, take a screenshot) and ran it through the shared driver: `flow ios ... --account 2 --expect onboarding --device ... --out /tmp/onara-signin-acct2-out`, `PASS signin-account2 42.1s`, the sweep lines as in row `cred-acc2`. It then scanned the output folder (clean) and its flow folder (one hit, the flow file), deleted the flow folder, and only then read `after-signin.png`. 21 calls, all completed; none runs `maestro` directly, reads `.dev-credentials.env`, names a credential key or types a credential. The screenshot, scanned clean by the QA lane before viewing, shows onara's onboarding welcome ("Willkommen bei Onara", "Schön, dass du da bist.", Deutsch/English, "Loslegen"), as the session reported.

Finding: the flow folder's hit is the path `/Users/<name>/...` in the subflow reference, because account 1's username is this Mac's login name (row `cred-acc2`). The session explained the hit in its final report and named the value: "one configured account value is the string `[redacted]`" (redacted in the capture). That is account 1's username, the login name, not a password and not account 2's values; the transcript holds no other configured value (account 1's username 279 times after `/Users/`, 30 times in the USER column of its `lsof` output, the rest in the session's own explanation of the hit). The capture scans clean.
