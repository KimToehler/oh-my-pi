# F2 wave 1 Q7 malformed lines among valid ones

Head: ecd418fce4a870f089788aa2102397d42c8ea37c

Input (`$TMP/r7.csv`; line 2 blank):
```
widget,19.99

gadget,abc
thing,
ok,1.00
```

Command: `bun src/cli.ts total $TMP/r7.csv`

Expected: no total; stderr names lines 3 and 4 (file line numbers, blank line counted); exit 2

stdout: ``

stderr: `error: lines 3, 4: malformed price`

exit: 2

Verdict: PASS
