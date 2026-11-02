# Plan review replay report

Unit: first-pass-replay. Targets: 85 (blocking 24, below-threshold 60, unresolved 1).
Savings: not measured. Round budgets: counterfactual. No comparison is causal.

## Arms
| arm | trials done/intended | macro pre | macro post | micro pre | micro post | false drop | false positive |
|---|---|---|---|---|---|---|---|
| H-Focus | 5/5 | 1.619390331890332/5 = 32.4% | n/a (no completed trials with a computable denominator) | 23/85 = 27.1% | n/a (no completed trials with a computable denominator) | n/a (no discovered independently blocking targets or triage unavailable) | n/a (no independently adjudicated findings) |
| H-Replay | 14/15 | 0.6460137085137085/5 = 12.9% | 0/1 = 0.0% (triaged 1/14 trials) | 8.5/85 = 10.0% | 0/11 = 0.0% (triaged 1/14 trials) | n/a (no discovered independently blocking targets or triage unavailable) | n/a (no independently adjudicated findings) |
| S | 15/15 | 0.9477603415103414/5 = 19.0% | 0.9373436748436748/5 = 18.7% | 12.666666666666666/85 = 14.9% | 12.333333333333332/85 = 14.5% | 0/36 = 0.0% | 7/75 = 9.3% |
| T | 5/5 | 0.7386273448773448/5 = 14.8% | 0.6671987734487734/5 = 13.3% | 11/85 = 12.9% | 10/85 = 11.8% | 0/10 = 0.0% | 5/25 = 20.0% |

## Items (trial mean vs best-of-repeats union)
| arm | item | trial mean pre | trial mean post | union | union pre | union post |
|---|---|---|---|---|---|---|
| H-Focus | acp-permission-parity | 4/11 = 36.4% | n/a (triage unavailable for every completed trial) | 1-repeat best-of-repeats coverage | 4/11 = 36.4% | n/a (triage unavailable for every completed trial) |
| H-Focus | finish-modality-program-route | 6/10 = 60.0% | n/a (triage unavailable for every completed trial) | 1-repeat best-of-repeats coverage | 6/10 = 60.0% | n/a (triage unavailable for every completed trial) |
| H-Focus | review-trailer-repair | 2/18 = 11.1% | n/a (triage unavailable for every completed trial) | 1-repeat best-of-repeats coverage | 2/18 = 11.1% | n/a (triage unavailable for every completed trial) |
| H-Focus | session-move-tool | 5/14 = 35.7% | n/a (triage unavailable for every completed trial) | 1-repeat best-of-repeats coverage | 5/14 = 35.7% | n/a (triage unavailable for every completed trial) |
| H-Focus | strength-progression-targets | 6/32 = 18.8% | n/a (triage unavailable for every completed trial) | 1-repeat best-of-repeats coverage | 6/32 = 18.8% | n/a (triage unavailable for every completed trial) |
| H-Replay | acp-permission-parity | 1.3333333333333333/11 = 12.1% | 0/11 = 0.0% (triaged 1/3 trials) | 3-repeat best-of-repeats coverage | 3/11 = 27.3% | 0/11 = 0.0% (triaged 1/3 trials) |
| H-Replay | finish-modality-program-route | 2.5/10 = 25.0% | n/a (triage unavailable for every completed trial) | 2-repeat best-of-repeats coverage | 3/10 = 30.0% | n/a (triage unavailable for every completed trial) |
| H-Replay | review-trailer-repair | 2/18 = 11.1% | n/a (triage unavailable for every completed trial) | 3-repeat best-of-repeats coverage | 2/18 = 11.1% | n/a (triage unavailable for every completed trial) |
| H-Replay | session-move-tool | 2/14 = 14.3% | n/a (triage unavailable for every completed trial) | 3-repeat best-of-repeats coverage | 4/14 = 28.6% | n/a (triage unavailable for every completed trial) |
| H-Replay | strength-progression-targets | 0.6666666666666666/32 = 2.1% | n/a (triage unavailable for every completed trial) | 3-repeat best-of-repeats coverage | 1/32 = 3.1% | n/a (triage unavailable for every completed trial) |
| S | acp-permission-parity | 3/11 = 27.3% | 3/11 = 27.3% | 3-repeat best-of-repeats coverage | 5/11 = 45.5% | 5/11 = 45.5% |
| S | finish-modality-program-route | 3.6666666666666665/10 = 36.7% | 3.6666666666666665/10 = 36.7% | 3-repeat best-of-repeats coverage | 4/10 = 40.0% | 4/10 = 40.0% |
| S | review-trailer-repair | 1.6666666666666667/18 = 9.3% | 1.6666666666666667/18 = 9.3% | 3-repeat best-of-repeats coverage | 2/18 = 11.1% | 2/18 = 11.1% |
| S | session-move-tool | 2/14 = 14.3% | 2/14 = 14.3% | 3-repeat best-of-repeats coverage | 2/14 = 14.3% | 2/14 = 14.3% |
| S | strength-progression-targets | 2.3333333333333335/32 = 7.3% | 2/32 = 6.3% | 3-repeat best-of-repeats coverage | 5/32 = 15.6% | 4/32 = 12.5% |
| T | acp-permission-parity | 1/11 = 9.1% | 1/11 = 9.1% | 1-repeat best-of-repeats coverage | 1/11 = 9.1% | 1/11 = 9.1% |
| T | finish-modality-program-route | 3/10 = 30.0% | 3/10 = 30.0% | 1-repeat best-of-repeats coverage | 3/10 = 30.0% | 3/10 = 30.0% |
| T | review-trailer-repair | 2/18 = 11.1% | 2/18 = 11.1% | 1-repeat best-of-repeats coverage | 2/18 = 11.1% | 2/18 = 11.1% |
| T | session-move-tool | 2/14 = 14.3% | 1/14 = 7.1% | 1-repeat best-of-repeats coverage | 2/14 = 14.3% | 1/14 = 7.1% |
| T | strength-progression-targets | 3/32 = 9.4% | 3/32 = 9.4% | 1-repeat best-of-repeats coverage | 3/32 = 9.4% | 3/32 = 9.4% |

## Trials
| trial | pre | post | false drop | protected | undecided | pending | invalid | annotated | pending findings |
|---|---|---|---|---|---|---|---|---|---|
| H-Focus-App-1 | 4/11 = 36.4% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 3 | 6 |
| H-Focus-Fmp-1 | 6/10 = 60.0% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 7 | 6 |
| H-Focus-Rtr-1 | 2/18 = 11.1% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 2 | 4 |
| H-Focus-Smt-1 | 5/14 = 35.7% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 6 | 4 |
| H-Focus-Spt-1 | 6/32 = 18.8% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 6 | 9 |
| H-Replay-App-1 | 2/11 = 18.2% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 2 | 2 |
| H-Replay-App-2 | 2/11 = 18.2% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 2 | 2 |
| H-Replay-App-3 | 0/11 = 0.0% | 0/11 = 0.0% | n/a (no discovered independently blocking targets) | 0 | 0 | 0 | 0 | 0 | 0 |
| H-Replay-Fmp-1 | 2/10 = 20.0% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 2 | 0 |
| H-Replay-Fmp-2 | 3/10 = 30.0% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 3 | 2 |
| H-Replay-Rtr-1 | 2/18 = 11.1% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 1 | 2 |
| H-Replay-Rtr-2 | 2/18 = 11.1% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 1 | 2 |
| H-Replay-Rtr-3 | 2/18 = 11.1% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 1 | 3 |
| H-Replay-Smt-1 | 0/14 = 0.0% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 0 | 4 |
| H-Replay-Smt-2 | 2/14 = 14.3% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 2 | 3 |
| H-Replay-Smt-3 | 4/14 = 28.6% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 4 | 2 |
| H-Replay-Spt-1 | 1/32 = 3.1% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 1 | 4 |
| H-Replay-Spt-2 | 1/32 = 3.1% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 1 | 5 |
| H-Replay-Spt-3 | 0/32 = 0.0% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 0 | 6 |
| S-App-1 | 3/11 = 27.3% | 3/11 = 27.3% | 0/2 = 0.0% | 0 | 0 | 0 | 0 | 0 | 0 |
| S-App-2 | 2/11 = 18.2% | 2/11 = 18.2% | 0/2 = 0.0% | 0 | 0 | 0 | 1 | 0 | 0 |
| S-App-3 | 4/11 = 36.4% | 4/11 = 36.4% | 0/4 = 0.0% | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Fmp-1 | 3/10 = 30.0% | 3/10 = 30.0% | 0/3 = 0.0% | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Fmp-2 | 4/10 = 40.0% | 4/10 = 40.0% | 0/4 = 0.0% | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Fmp-3 | 4/10 = 40.0% | 4/10 = 40.0% | 0/4 = 0.0% | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Rtr-1 | 2/18 = 11.1% | 2/18 = 11.1% | 0/2 = 0.0% | 0 | 0 | 0 | 1 | 0 | 0 |
| S-Rtr-2 | 1/18 = 5.6% | 1/18 = 5.6% | 0/1 = 0.0% | 0 | 0 | 0 | 1 | 0 | 0 |
| S-Rtr-3 | 2/18 = 11.1% | 2/18 = 11.1% | 0/2 = 0.0% | 0 | 0 | 0 | 1 | 0 | 0 |
| S-Smt-1 | 2/14 = 14.3% | 2/14 = 14.3% | 0/2 = 0.0% | 0 | 0 | 0 | 1 | 0 | 0 |
| S-Smt-2 | 2/14 = 14.3% | 2/14 = 14.3% | 0/2 = 0.0% | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Smt-3 | 2/14 = 14.3% | 2/14 = 14.3% | 0/2 = 0.0% | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Spt-1 | 2/32 = 6.3% | 2/32 = 6.3% | 0/2 = 0.0% | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Spt-2 | 1/32 = 3.1% | 1/32 = 3.1% | 0/1 = 0.0% | 0 | 0 | 0 | 1 | 0 | 0 |
| S-Spt-3 | 4/32 = 12.5% | 3/32 = 9.4% | 0/3 = 0.0% | 0 | 0 | 0 | 1 | 0 | 0 |
| T-App-1 | 1/11 = 9.1% | 1/11 = 9.1% | 0/1 = 0.0% | 0 | 0 | 0 | 2 | 0 | 0 |
| T-Fmp-1 | 3/10 = 30.0% | 3/10 = 30.0% | 0/3 = 0.0% | 0 | 0 | 0 | 0 | 0 | 0 |
| T-Rtr-1 | 2/18 = 11.1% | 2/18 = 11.1% | 0/2 = 0.0% | 0 | 0 | 0 | 1 | 0 | 0 |
| T-Smt-1 | 2/14 = 14.3% | 1/14 = 7.1% | 0/1 = 0.0% | 0 | 0 | 0 | 0 | 0 | 0 |
| T-Spt-1 | 3/32 = 9.4% | 3/32 = 9.4% | 0/3 = 0.0% | 0 | 0 | 0 | 2 | 0 | 0 |

## Finding kinds
| trial | known target | additional | useful note | evidence error | consequence | false claim | severity | pending |
|---|---|---|---|---|---|---|---|---|
| H-Focus-App-1 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 6 |
| H-Focus-Fmp-1 | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 6 |
| H-Focus-Rtr-1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| H-Focus-Smt-1 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| H-Focus-Spt-1 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 9 |
| H-Replay-App-1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| H-Replay-App-2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| H-Replay-App-3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| H-Replay-Fmp-1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| H-Replay-Fmp-2 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| H-Replay-Rtr-1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| H-Replay-Rtr-2 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| H-Replay-Rtr-3 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| H-Replay-Smt-1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| H-Replay-Smt-2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| H-Replay-Smt-3 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| H-Replay-Spt-1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| H-Replay-Spt-2 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 5 |
| H-Replay-Spt-3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6 |
| S-App-1 | 2 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| S-App-2 | 2 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| S-App-3 | 4 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Fmp-1 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Fmp-2 | 4 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Fmp-3 | 4 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Rtr-1 | 1 | 2 | 0 | 0 | 0 | 1 | 0 | 0 |
| S-Rtr-2 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| S-Rtr-3 | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| S-Smt-1 | 2 | 2 | 0 | 0 | 1 | 0 | 0 | 0 |
| S-Smt-2 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Smt-3 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Spt-1 | 2 | 5 | 0 | 0 | 1 | 0 | 0 | 0 |
| S-Spt-2 | 1 | 4 | 0 | 0 | 1 | 0 | 0 | 0 |
| S-Spt-3 | 4 | 4 | 0 | 0 | 1 | 0 | 0 | 0 |
| T-App-1 | 1 | 0 | 1 | 0 | 2 | 0 | 0 | 0 |
| T-Fmp-1 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| T-Rtr-1 | 2 | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| T-Smt-1 | 2 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| T-Spt-1 | 3 | 3 | 1 | 0 | 2 | 0 | 0 | 0 |

## Blocking discoveries outside the frozen ledger (verifier outcome; not part of any target denominator)

Unit: mechanisms per trial, deduplicated within a trial and summed over trials.

| arm | discovered | retained | protected | undecided | pending | dropped | drop rate |
|---|---|---|---|---|---|---|---|
| H-Focus | 0 | 0 | 0 | 0 | 0 | 0 | n/a (no discovered independently blocking additional mechanisms or triage unavailable) |
| H-Replay | 0 | 0 | 0 | 0 | 0 | 0 | n/a (no discovered independently blocking additional mechanisms or triage unavailable) |
| S | 25 | 24 | 0 | 0 | 0 | 1 | 1/25 = 4.0% |
| T | 5 | 5 | 0 | 0 | 0 | 0 | 0/5 = 0.0% |

## Costs
- reviewer: 47.2646 (56 attempts, 0 unknown)
- verifier: 4.0845 (22 attempts, 0 unknown)
- adjudicator: 19.8990 (10 attempts, 0 unknown)
- unsuccessful (subset of the stage rows above, not an additional bucket): 31.9652 (9 attempts, 0 unknown)
- total: 71.2481 (88 attempts, 0 unknown)

## Timing
- experiment wall envelope: 19466782 ms
- trial H-Focus-App-1 span: unavailable (no trial attempt has usable timestamps)
- trial H-Focus-Fmp-1 span: unavailable (no trial attempt has usable timestamps)
- trial H-Focus-Rtr-1 span: unavailable (no trial attempt has usable timestamps)
- trial H-Focus-Smt-1 span: unavailable (no trial attempt has usable timestamps)
- trial H-Focus-Spt-1 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-App-1 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-App-2 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-App-3 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-Fmp-1 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-Fmp-2 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-Fmp-3 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-Rtr-1 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-Rtr-2 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-Rtr-3 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-Smt-1 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-Smt-2 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-Smt-3 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-Spt-1 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-Spt-2 span: unavailable (no trial attempt has usable timestamps)
- trial H-Replay-Spt-3 span: unavailable (no trial attempt has usable timestamps)
- trial S-App-1 span: 14403816 ms
- trial S-App-2 span: 1699013 ms
- trial S-App-3 span: 1207112 ms
- trial S-Fmp-1 span: 934512 ms
- trial S-Fmp-2 span: 13819999 ms
- trial S-Fmp-3 span: 851852 ms
- trial S-Rtr-1 span: 17066643 ms
- trial S-Rtr-2 span: 576181 ms
- trial S-Rtr-3 span: 2373611 ms
- trial S-Smt-1 span: 734555 ms
- trial S-Smt-2 span: 15533877 ms
- trial S-Smt-3 span: 12332990 ms
- trial S-Spt-1 span: 12251364 ms
- trial S-Spt-2 span: 649782 ms
- trial S-Spt-3 span: 3496849 ms
- trial T-App-1 span: 1158364 ms
- trial T-Fmp-1 span: 236370 ms
- trial T-Rtr-1 span: 1056215 ms
- trial T-Smt-1 span: 318976 ms
- trial T-Spt-1 span: 244042 ms
- attempt Adj2App (adjudicator): 423321 ms
- attempt Adj2Fmp (adjudicator): 295466 ms
- attempt Adj2Rtr (adjudicator): 246046 ms
- attempt Adj2Smt (adjudicator): 317559 ms
- attempt Adj2Spt (adjudicator): 594992 ms
- attempt AdjApp (adjudicator): 294299 ms
- attempt AdjFmp (adjudicator): 336383 ms
- attempt AdjRtr (adjudicator): 248549 ms
- attempt AdjSmt (adjudicator): 277974 ms
- attempt AdjSpt (adjudicator): 623403 ms
- attempt H-B61App1 (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-B61App2bb (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-B61App3 (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-B61Smt1 (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-B61Smt2 (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-B61Smt3 (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-B61Spt1 (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-B61Spt2 (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-B61Spt3 (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-F61AppChk (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-F61AppCorb (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-F61AppVer (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-F61SmtChkb (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-F61SmtCor (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-F61SmtVer (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-F61SptChk (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-F61SptCor (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-F61SptVer (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-FocusFmpChk (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-FocusFmpCor (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-FocusFmpVer (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-FocusRtrChk (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-FocusRtrCor (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-FocusRtrVer (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-ReplayFmp1 (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-ReplayFmp2 (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-ReplayFmp3bbb (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-ReplayRtr1b (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-ReplayRtr2 (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt H-ReplayRtr3 (reviewer): unavailable (dispatch or terminal timestamp unavailable)
- attempt Replacement1SSpt3 (reviewer): 1085393 ms
- attempt Replacement2SRtr3 (verifier): 62340 ms
- attempt Replacement3SSmt2 (reviewer): 2207411 ms
- attempt RerunSApp1 (reviewer): 1718178 ms
- attempt RerunSFmp2 (reviewer): 2509247 ms
- attempt RerunSSmt2 (reviewer): 2021656 ms
- attempt RerunSSpt1 (reviewer): 1762186 ms
- attempt TrialSApp1 (reviewer): 2131061 ms
- attempt TrialSApp2 (reviewer): 1564554 ms
- attempt TrialSApp3 (reviewer): 767823 ms
- attempt TrialSFmp1 (reviewer): 788725 ms
- attempt TrialSFmp2 (reviewer): 2053498 ms
- attempt TrialSFmp3 (reviewer): 581561 ms
- attempt TrialSRtr1 (reviewer): 466359 ms
- attempt TrialSRtr2 (reviewer): 502959 ms
- attempt TrialSRtr3 (reviewer): 585616 ms
- attempt TrialSSmt1 (reviewer): 626190 ms
- attempt TrialSSmt2 (reviewer): 1972163 ms
- attempt TrialSSmt3 (reviewer): 634680 ms
- attempt TrialSSpt1 (reviewer): 1716991 ms
- attempt TrialSSpt2 (reviewer): 533022 ms
- attempt TrialSSpt3 (reviewer): 2033776 ms
- attempt TrialTApp1 (reviewer): 170117 ms
- attempt TrialTFmp1 (reviewer): 157048 ms
- attempt TrialTRtr1 (reviewer): 79983 ms
- attempt TrialTSmt1 (reviewer): 68094 ms
- attempt TrialTSpt1 (reviewer): 117477 ms
- attempt VerifyRerunSRtr1 (verifier): 1874952 ms
- attempt VerifySApp1 (verifier): 105954 ms
- attempt VerifySApp2 (verifier): 121602 ms
- attempt VerifySApp3 (verifier): 144868 ms
- attempt VerifySFmp1 (verifier): 123310 ms
- attempt VerifySFmp2 (verifier): 1018853 ms
- attempt VerifySFmp3 (verifier): 101492 ms
- attempt VerifySRtr1 (verifier): 1002346 ms
- attempt VerifySRtr2 (verifier): 68563 ms
- attempt VerifySRtr3 (verifier): 1025510 ms
- attempt VerifySSmt1 (verifier): 103068 ms
- attempt VerifySSmt2 (verifier): 80732 ms
- attempt VerifySSmt3 (verifier): 82746 ms
- attempt VerifySSpt1 (verifier): 130213 ms
- attempt VerifySSpt2 (verifier): 112529 ms
- attempt VerifySSpt3 (verifier): 144354 ms
- attempt VerifyTApp1 (verifier): 982363 ms
- attempt VerifyTFmp1 (verifier): 75856 ms
- attempt VerifyTRtr1 (verifier): 972869 ms
- attempt VerifyTSmt1 (verifier): 93066 ms
- attempt VerifyTSpt1 (verifier): 122903 ms

## Comparisons
| a | b | changed axes | label | historical | asymmetric repeats |
|---|---|---|---|---|---|
| H-Focus | H-Replay | brief,sampling | confounded | true | true |
| H-Focus | S | model,effort,brief,contract,rules,triage,sampling | confounded | true | true |
| H-Focus | T | brief,contract,rules,triage | confounded | true | false |
| H-Replay | S | model,effort,brief,contract,rules,triage,sampling | confounded | true | true |
| H-Replay | T | brief,contract,rules,triage,sampling | confounded | true | true |
| S | T | model,effort,sampling | confounded | false | true |

## Rounds (recorded last rounds; savings not measured)
| item | revision | path | last round | workflow |
|---|---|---|---|---|
| acp-permission-parity | 53dfd84aaf352db18525e5158a56be7f91689dda | openspec/changes/archive/2026-10-24-acp-permission-parity/review.md | 12 | omp-gated |
| finish-modality-program-route | 763479f9bc1535729565a009a742fd4c4a9ef9d8 | openspec/changes/archive/2026-10-26-finish-modality-program-route/review.md | 16 | omp-gated |
| review-trailer-repair | 3d91cdd514c60a56729b7df55bd836046aa26238 | openspec/changes/archive/2026-10-25-review-trailer-repair/review.md | 17 | omp-gated |
| session-move-tool | 2df8ac2d9b7bb1777aca2b174fb8fe5f8b4acacd | openspec/changes/archive/2026-10-26-session-move-tool/review.md | 22 | omp-gated |
| strength-progression-targets | bffb00754158598d3c4c87b39556976c979e9cfc | openspec/changes/archive/2026-10-27-strength-progression-targets/review.md | 40 | omp-gated |

## Target severity repeats (reproducibility of the ledger, not a revision of it)
| round | assessed | agreed with ledger | disagreements | unknown targets |
|---|---|---|---|---|
| round-2 | 85 | 83/85 = 97.6% | strength-progression-targets\|R05.1: blocking -> below-threshold; strength-progression-targets\|R10.1: blocking -> below-threshold | none |

## Exclusions
| kind | id | status | reason |
|---|---|---|---|
| trial | H-Replay-Fmp-3 | excluded | Original wrong-pin exclusion retained. |
| attempt | H-ReplayFmp3bbb | excluded | Recorded wrong-model exclusion; actual child used claude-sonnet, not intended terra. |
| attempt | Replacement3SSmt2 | excluded | Actual pin/tool-grant mismatch |
| attempt | TrialSApp1 | excluded | Actual pin/tool-grant mismatch |
| attempt | TrialSFmp2 | excluded | Actual pin/tool-grant mismatch |
| attempt | TrialSSmt2 | excluded | Actual pin/tool-grant mismatch |
| attempt | TrialSSpt1 | excluded | Actual pin/tool-grant mismatch |
| attempt | TrialSSpt3 | excluded | Actual pin/tool-grant mismatch |
| attempt | VerifySRtr1 | excluded | Wrong pin or incomplete indices |
| attempt | VerifySRtr3 | excluded | Wrong pin or incomplete indices |
