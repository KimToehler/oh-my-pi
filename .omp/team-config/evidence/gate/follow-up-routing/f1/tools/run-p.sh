#!/bin/bash
# Run one F1 row as a fresh `omp -p` session in its fixture. usage: run-p.sh <row> <prompt> [<session tag>]
# One-off F1 evidence helper: sessions go to /tmp/fur-f1/sessions/<row>[-tag], output to /tmp/fur-f1/<row>[-tag].out.txt.
set -uo pipefail
R=$1 P=$2 T=${3:+-$3}
cd "/tmp/fur-f1/$R"
printf '%s\n' "$P" > "/tmp/fur-f1/$R$T.prompt.txt"
omp -p --session-dir "/tmp/fur-f1/sessions/$R$T" "$P" > "/tmp/fur-f1/$R$T.out.txt" 2>&1
echo "$R$T exit=$?"
