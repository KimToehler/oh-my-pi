# Keep tunnel credentials out of argv and tunnel logs

## Context
`packages/coding-agent/src/blob-broker/exposure.ts` starts URL tunnels. Three branches of `startExposure` read a credential via `credentialString` (`uploader-runtime.ts:79-82`) and put it into argv today: `pinggy` (`token` as SSH user `${token}@pro.pinggy.io`, line 411), `bore` (`--secret <secret>`, line 459) and `named-cloudflared` (`--token <tunnelToken>`, line 470). All three spawn through `spawnUrlTunnel` (236-288), which writes child stdout and stderr to `/tmp/omp-blob-tunnel-*.log` and reads it while polling. Authenticated Pinggy restarts reuse the same argv (`restartingPinggyExposure`, line 433). The credential must never appear in argv, the tunnel log, or diagnostics.

## Approach
1. `named-cloudflared`: pass the token as `TUNNEL_TOKEN` in the child env instead of `--token`.
2. `bore`: pass the secret as `BORE_SECRET` in the child env instead of `--secret`.
3. `pinggy`: the token is the SSH user name and cannot leave argv (`ssh` has no env alternative for the user); keep it in argv and redact it in every sink below.
4. `spawnUrlTunnel(argv, extract, readyPattern, secrets)`: takes the list of secrets for this spawn and an `env` override.

## Verification
- New sentinel test in `packages/coding-agent/test/blob-exposure-tunnels.test.ts` for pinggy, bore and named-cloudflared.
- `bun test packages/coding-agent/test/blob-exposure-tunnels.test.ts`

- Merge gate: not applicable (fixture)
