#!/bin/bash
# usage: run.sh <fixture> <prompt file> <tag> [resume session file]
cd "$1"; date +%s > $TMPDIR/pirp-fix/r518run/$3.start
if [ -n "$4" ]; then
env -u PI_PROFILE -u OMP_PROFILE -u PI_CODING_AGENT_DIR -u PI_SESSION_FILE -u PI_SESSION_ID -u PI_NO_TITLE omp --profile pirp -p --resume "$4" "$(cat $2)" > $TMPDIR/pirp-fix/r518run/$3.out 2>&1
else
env -u PI_PROFILE -u OMP_PROFILE -u PI_CODING_AGENT_DIR -u PI_SESSION_FILE -u PI_SESSION_ID -u PI_NO_TITLE omp --profile pirp -p "$(cat $2)" > $TMPDIR/pirp-fix/r518run/$3.out 2>&1
fi
date +%s > $TMPDIR/pirp-fix/r518run/$3.end
