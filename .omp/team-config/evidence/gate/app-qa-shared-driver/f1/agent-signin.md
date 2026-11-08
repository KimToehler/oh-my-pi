# F1 agent-signin

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); omp and team config deployed from this head.

Surface: scratch onara worktree (configuration present), iOS simulator `onara-f1`, backend on 8081; the onara app was still running signed in as account 2 from row `cred-acc2`

## Commands and output

```
$ xcrun simctl keychain 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A reset && echo keychain-reset
keychain-reset
$ omp -p --mode json --no-session --max-time 20m "Sign account 2 into the app on the iOS simulator and show me the screen after sign-in." > /tmp/app-qa-impl/agent-signin.jsonl
omp exit 0
```

The session's capture is `f1/agent-signin-capture.txt` (call arguments, driver output, final report).

## Observation

The fresh session read the team skill, the credentials rule, the configuration and onara's QA skill, then ran the shared driver's `preflight ios` (failing on 8080, which another service holds, then passing with `--port 8081`). It wrote throwaway flows into a new owner-only temporary folder outside the repository and ran them only through the driver: the first, launching the app without clearing it, onara's `app_kmp/maestro/signin-ios.yaml` and a screenshot `after-signin`, with `flow ios ... --account 2 --expect onboarding`, failed (`Assertion is false: "Username or email" is visible`, root kept), because the app was still signed in from the earlier row; it scanned the kept root (clean) before reading its console log, report and Maestro log. Two probe flows without sign-in found the app on `onboarding-welcome` (the second takes a screenshot per tag found visible, among them the `sign-in` entry, which was not shown). A flow starting with Maestro's `clearKeychain`, then the same subflow and screenshot, passed with `--account 2 --expect onboarding` (`PASS signin-acct2-fresh`). It scanned its folder (call 33: exit 1 on its own two flow files, whose absolute subflow path holds the Mac's home folder) before reading the screenshot (call 34), then deleted the flow files, probe output and the kept root and scanned the folder again. It reported the onboarding welcome screen and that it cleared the whole simulator keychain. Checked over all 35 executed calls: none runs `maestro` directly, none reads `.dev-credentials.env` or names a credential key, none types a credential. One more call was streamed and never ran: a `glob` naming `.maestro/*`, cut off by omp's rule interrupt for `ui-automation-credentials`. The report also notes that a configured username equals the Mac's login name, which makes every home-folder path a scan hit.
