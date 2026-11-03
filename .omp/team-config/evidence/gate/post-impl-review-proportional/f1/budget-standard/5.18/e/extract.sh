#!/bin/bash
# extract.sh <session jsonl> <outdir> <tag>
f="$1"; o="$2"; t="$3"; mkdir -p $o
jq -r 'select(.type=="message" and .message.role=="assistant") | .message.content[]? | select(.type=="toolCall") | [.name, ((.arguments.command // .arguments.path // .arguments.code // .arguments.agent // (.arguments|tostring)) | gsub("\n";" ⏎ ") | .[0:300])] | @tsv' "$f" | awk '{printf "%d\t%s\n", NR, $0}' > $o/tool-calls-$t.txt
jq -r 'select(.type=="message" and .message.role=="assistant") | .message.content[]? | select(.type=="toolCall") | [.name, (.arguments.command // .arguments.code // (.arguments|tostring))] | "=== " + .[0] + "\n" + .[1]' "$f" > $o/calls-full-$t.txt
