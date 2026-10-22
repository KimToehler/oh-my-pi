# QA fixture plan (below)

## Steps
1. Add scripts/dev-env.sh as follows:

```bash
#!/usr/bin/env bash
set -u
current=$(cat .env 2>/dev/null)
if ! grep -q '^POSTGRES_PASSWORD=' <<<"$current"; then
  [ -s .env ] && [ -n "$(tail -c1 .env 2>/dev/null)" ] && echo >> .env
  echo 'POSTGRES_PASSWORD=devpass' >> .env
fi
```

The script runs only on a developer machine; the password is a throwaway local default.

- Merge gate: not applicable (QA fixture)
