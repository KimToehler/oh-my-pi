#!/bin/bash
# Usage: score.sh <attempt>   Prints one row per fixture result of that attempt.
set -uo pipefail
A="$1"
cd /tmp/evo2-qa/results
for f in *.a$A.json; do
	n=${f%.a$A.json}
	case $n in
		F-A1) lab="CHECK 5"; want=pos ;;
		F-A1-fixed) lab="CHECK 5"; want=neg ;;
		F-A2) lab="CHECK 6"; want=pos ;;
		F-A3) lab="CHECK|DOMAIN"; want=okay ;;
		F-D1) lab="DOMAIN 6"; want=d1 ;;
		*) lab=$(echo "$n" | sed -E 's/^(CHECK|DOMAIN)-([0-9])-(pos|neg)$/\1 \2/'); want=${n##*-} ;;
	esac
	st=$(jq -r .status "$f"); v=$(jq -r '.verdict // "-"' "$f")
	hit=$(jq --arg l "$lab" '[.areas[]? | select(test("(^|[^A-Za-z])(" + $l + ")([^0-9]|$)"; "i"))] | length' "$f")
	case $want in
		pos) [ "$st" = ok ] && [ "$v" = REJECT ] && [ "$hit" -gt 0 ] && ok=match || ok=MISMATCH ;;
		neg) [ "$st" = ok ] && [ "$hit" -eq 0 ] && ok=match || ok=MISMATCH ;;
		okay) [ "$st" = ok ] && [ "$v" = OKAY ] && ok=match || ok=MISMATCH ;;
		d1) inh=$(jq '[.defects[]? | select(test("(inherit|old|previous|stale|existing).*(trial|reward|result)|(trial|reward|result).*(inherit|old|previous|stale|remain|survive)"; "i"))] | length' "$f")
			[ "$st" = ok ] && [ "$v" = REJECT ] && [ "$inh" -gt 0 ] && ok=match || ok=MISMATCH ;;
	esac
	printf '%-14s %-5s %-7s %-6s hits=%s %s\n' "$n" "$want" "$st" "$v" "$hit" "$ok"
done
