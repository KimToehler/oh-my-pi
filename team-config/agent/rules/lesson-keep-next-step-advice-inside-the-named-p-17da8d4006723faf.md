---
description: Keep next-step advice inside the named plan; other plans have their own sessions
globs:
  - "**/.omp/plans/*.md"
---

# Lesson: Keep next-step advice inside the named plan; other plans have their own sessions

Recorded: 2026-10-10
Lesson id: keep-next-step-advice-inside-the-named-p-17da8d4006723faf
Lesson hash: 17da8d4006723faf

## What went wrong
Asked for the next steps of the modality finalization roadmap, I put F-43 (Valkey auth from the plan `r2-followups.md`) at the top as release priority 1. That item belongs to a different plan that a parallel session was already turning into a spec and plan.

## Rule for next time
When the user names one plan or roadmap, derive next steps only from that document. Items from other `.omp/plans/*.md` files (e.g. r2-followups F-xx) may be owned by a parallel session: mention them at most as an external dependency or seam, in one line, and never prioritise or plan them. Check `git log -- <other plan>` before claiming any cross-plan item.
