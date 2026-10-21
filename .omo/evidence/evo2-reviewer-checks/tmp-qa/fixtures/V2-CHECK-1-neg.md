# Keep tunnel credentials out of argv and tunnel logs

## Context
`packages/coding-agent/src/blob-broker/exposure.ts` starts URL tunnels. Three branches of `startExposure` read a credential via `credentialString` (`uploader-runtime.ts:79-82`) and put it into argv today: `pinggy` (`token` as SSH user `${token}@pro.pinggy.io`, line 411), `bore` (`--secret <secret>`, line 459) and `named-cloudflared` (`--token <tunnelToken>`, line 470). All three spawn through `spawnUrlTunnel` (236-288), which writes child stdout and stderr to `/tmp/omp-blob-tunnel-*.log` and reads it while polling. Authenticated Pinggy restarts reuse the same argv (`restartingPinggyExposure`, line 433). The credential must never appear in argv, the tunnel log, or diagnostics.

## Approach
1. `named-cloudflared`: pass the token as `TUNNEL_TOKEN` in the child env instead of `--token`.
2. `bore`: pass the secret as `BORE_SECRET` in the child env instead of `--secret`.
3. `pinggy`: the token is the SSH user name and cannot leave argv (`ssh` has no env alternative for the user); keep it in argv and redact it in every sink below.
4. `spawnUrlTunnel(argv, extract, readyPattern, secrets)`: takes the list of secrets for this spawn and an `env` override.

### Holders and sinks (CHECK 1)

Search used: `rg -n 'credentialString\(' packages/coding-agent/src/blob-broker/exposure.ts` (lines 399, 456, 467) and `rg -n 'Bun.spawn|logger\.|throw new Error' packages/coding-agent/src/blob-broker/exposure.ts`.

| Holder / sink | reached by | chokepoint | test |
|---|---|---|---|
| holder: `config.credentials.{token,secret,tunnelToken}` | caller config | n/a | n/a |
| holder: locals `token`/`secret` (399, 456, 467) | `credentialString` | n/a | n/a |
| holder: argv | pinggy only after the change | pinggy argv is never logged or interpolated; see error sinks | sentinel test |
| holder: child env | cloudflared, bore after the change | env object built per spawn, never written to `process.env` | sentinel test |
| holder: `restartingPinggyExposure` closure keeps argv | line 433 | same redaction list passed on restart | sentinel test |
| sink: tunnel log `/tmp/omp-blob-tunnel-*.log` (stdout+stderr of every holder) | `spawnUrlTunnel` fd | `spawnUrlTunnel` rewrites the log with every secret replaced by `***` after each poll read and before returning or throwing; the URL extractor runs on the redacted text | sentinel test |
| sink: thrown errors 282, 287 | `spawnUrlTunnel` | interpolate `argv[0]` only (the binary path) | sentinel test |
| sink: error 153 (`requireBinary`), 209 (health probe), 514 (ssh) | other paths | contain binary name, destination or `sshTarget`, never a credential | covered by inspection; no credential in scope |
| sink: logger 323 (Pinggy reconnect), 516 (ssh) | other paths | no argv/env/credential fields | covered by inspection |
| sink: process listing of argv | OS | cloudflared and bore: excluded by design (env); pinggy: accepted residual, ssh requires the user in argv | n/a |

Chokepoint: `spawnUrlTunnel` is the only spawn site of the three credential branches (the `ssh` branch at 495 has no credential). New credential branches must pass `secrets`; the parameter is required, so a new caller that omits it fails to compile.

Negative control: set `SENTINEL-7f3a` as `token`, `secret` and `tunnelToken`; a fake tunnel binary echoes its argv and env to stdout and stderr and then exits, once before and once after printing a URL. Scan the tunnel log, every thrown error message, and captured logger output: 0 hits for all three kinds. For pinggy also restart once through `restartingPinggyExposure` and scan again.

## Verification
- New sentinel test in `packages/coding-agent/test/blob-exposure-tunnels.test.ts` for pinggy, bore and named-cloudflared.
- `bun test packages/coding-agent/test/blob-exposure-tunnels.test.ts`

- Merge gate: not applicable (fixture)
