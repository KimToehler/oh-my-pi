# bump: task 3.1 Verify on W

Requirement: The bump procedure names every team addition (review-follow-ups). Command: the task 3.1 Verify command, run from `W` at `e277d89e795132207bc385152fc7a2c0fded774f`.

```
S=$(awk '/^### Bumping OpenSpec/,/^## Changing the team config/' team-config/README.md); for s in 'with four team additions' 'Goal-mode continuation' 'only the four team additions' 're-apply the four team additions'; do printf '%s' "$S" | grep -q -- "$s" || { echo "missing: $s"; exit 1; }; done; ! printf '%s' "$S" | grep -q 'three team additions'
```

Output (empty means every phrase found and no 'three team additions'):

```

```

exit 0
