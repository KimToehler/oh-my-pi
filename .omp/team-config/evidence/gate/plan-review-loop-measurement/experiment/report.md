# Plan review replay report

Unit: first-pass-replay. Targets: 85 (blocking 24, below-threshold 60, unresolved 1).
Savings: not measured. Round budgets: counterfactual. No comparison is causal.

## Arms
| arm | trials done/intended | macro pre | macro post | micro pre | micro post | false drop | false positive |
|---|---|---|---|---|---|---|---|
| H-Focus | 5/5 | 1.619390331890332/5 = 32.4% | n/a (no completed trials with a computable denominator) | 23/85 = 27.1% | n/a (no completed trials with a computable denominator) | n/a (no discovered independently blocking targets or triage unavailable) | 0/24 = 0.0% |
| H-Replay | 14/15 | 0.6460137085137085/5 = 12.9% | 0/1 = 0.0% | 8.5/85 = 10.0% | 0/11 = 0.0% | n/a (no discovered independently blocking targets or triage unavailable) | 0/20 = 0.0% |
| S | 8/15 | 1.0457296176046176/5 = 20.9% | 0.8872474747474748/4 = 22.2% | 14/85 = 16.5% | 11.5/71 = 16.2% | 0/17 = 0.0% | 4/41 = 9.8% |
| T | 2/5 | 0.23660714285714285/2 = 11.8% | 0.16517857142857142/2 = 8.3% | 5/46 = 10.9% | 4/46 = 8.7% | 0/4 = 0.0% | 2/14 = 14.3% |

## Items (trial mean vs best-of-repeats union)
| arm | item | trial mean pre | trial mean post | union | union pre | union post |
|---|---|---|---|---|---|---|
| H-Focus | acp-permission-parity | 4/11 = 36.4% | n/a (triage unavailable for every completed trial) | 1-repeat best-of-repeats coverage | 4/11 = 36.4% | n/a (triage unavailable for every completed trial) |
| H-Focus | finish-modality-program-route | 6/10 = 60.0% | n/a (triage unavailable for every completed trial) | 1-repeat best-of-repeats coverage | 6/10 = 60.0% | n/a (triage unavailable for every completed trial) |
| H-Focus | review-trailer-repair | 2/18 = 11.1% | n/a (triage unavailable for every completed trial) | 1-repeat best-of-repeats coverage | 2/18 = 11.1% | n/a (triage unavailable for every completed trial) |
| H-Focus | session-move-tool | 5/14 = 35.7% | n/a (triage unavailable for every completed trial) | 1-repeat best-of-repeats coverage | 5/14 = 35.7% | n/a (triage unavailable for every completed trial) |
| H-Focus | strength-progression-targets | 6/32 = 18.8% | n/a (triage unavailable for every completed trial) | 1-repeat best-of-repeats coverage | 6/32 = 18.8% | n/a (triage unavailable for every completed trial) |
| H-Replay | acp-permission-parity | 1.3333333333333333/11 = 12.1% | 0/11 = 0.0% | 3-repeat best-of-repeats coverage | 3/11 = 27.3% | 0/11 = 0.0% |
| H-Replay | finish-modality-program-route | 2.5/10 = 25.0% | n/a (triage unavailable for every completed trial) | 2-repeat best-of-repeats coverage | 3/10 = 30.0% | n/a (triage unavailable for every completed trial) |
| H-Replay | review-trailer-repair | 2/18 = 11.1% | n/a (triage unavailable for every completed trial) | 3-repeat best-of-repeats coverage | 2/18 = 11.1% | n/a (triage unavailable for every completed trial) |
| H-Replay | session-move-tool | 2/14 = 14.3% | n/a (triage unavailable for every completed trial) | 3-repeat best-of-repeats coverage | 4/14 = 28.6% | n/a (triage unavailable for every completed trial) |
| H-Replay | strength-progression-targets | 0.6666666666666666/32 = 2.1% | n/a (triage unavailable for every completed trial) | 3-repeat best-of-repeats coverage | 1/32 = 3.1% | n/a (triage unavailable for every completed trial) |
| S | acp-permission-parity | 4/11 = 36.4% | 4/11 = 36.4% | 1-repeat best-of-repeats coverage | 4/11 = 36.4% | 4/11 = 36.4% |
| S | finish-modality-program-route | 3.5/10 = 35.0% | 3.5/10 = 35.0% | 2-repeat best-of-repeats coverage | 4/10 = 40.0% | 4/10 = 40.0% |
| S | review-trailer-repair | 2/18 = 11.1% | 2/18 = 11.1% | 2-repeat best-of-repeats coverage | 2/18 = 11.1% | 2/18 = 11.1% |
| S | session-move-tool | 2/14 = 14.3% | n/a (triage unavailable for every completed trial) | 1-repeat best-of-repeats coverage | 2/14 = 14.3% | n/a (triage unavailable for every completed trial) |
| S | strength-progression-targets | 2.5/32 = 7.8% | 2/32 = 6.3% | 2-repeat best-of-repeats coverage | 4/32 = 12.5% | 3/32 = 9.4% |
| T | session-move-tool | 2/14 = 14.3% | 1/14 = 7.1% | 1-repeat best-of-repeats coverage | 2/14 = 14.3% | 1/14 = 7.1% |
| T | strength-progression-targets | 3/32 = 9.4% | 3/32 = 9.4% | 1-repeat best-of-repeats coverage | 3/32 = 9.4% | 3/32 = 9.4% |

## Trials
| trial | pre | post | false drop | protected | undecided | pending | invalid | pending findings |
|---|---|---|---|---|---|---|---|---|
| H-Focus-App-1 | 4/11 = 36.4% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 6 |
| H-Focus-Fmp-1 | 6/10 = 60.0% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 6 |
| H-Focus-Rtr-1 | 2/18 = 11.1% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 4 |
| H-Focus-Smt-1 | 5/14 = 35.7% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 4 |
| H-Focus-Spt-1 | 6/32 = 18.8% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 9 |
| H-Replay-App-1 | 2/11 = 18.2% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 2 |
| H-Replay-App-2 | 2/11 = 18.2% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 2 |
| H-Replay-App-3 | 0/11 = 0.0% | 0/11 = 0.0% | n/a (no discovered independently blocking targets) | 0 | 0 | 0 | 0 | 0 |
| H-Replay-Fmp-1 | 2/10 = 20.0% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 0 |
| H-Replay-Fmp-2 | 3/10 = 30.0% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 2 |
| H-Replay-Rtr-1 | 2/18 = 11.1% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 2 |
| H-Replay-Rtr-2 | 2/18 = 11.1% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 2 |
| H-Replay-Rtr-3 | 2/18 = 11.1% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 3 |
| H-Replay-Smt-1 | 0/14 = 0.0% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 4 |
| H-Replay-Smt-2 | 2/14 = 14.3% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 3 |
| H-Replay-Smt-3 | 4/14 = 28.6% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 2 |
| H-Replay-Spt-1 | 1/32 = 3.1% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 4 |
| H-Replay-Spt-2 | 1/32 = 3.1% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 5 |
| H-Replay-Spt-3 | 0/32 = 0.0% | n/a (historical triage unavailable; not retained by default) | n/a (historical triage unavailable; not retained by default) | n/a | n/a | n/a | 0 | 6 |
| S-App-3 | 4/11 = 36.4% | 4/11 = 36.4% | 0/4 = 0.0% | 0 | 0 | 0 | 0 | 0 |
| S-Fmp-1 | 3/10 = 30.0% | 3/10 = 30.0% | 0/3 = 0.0% | 0 | 0 | 0 | 0 | 0 |
| S-Fmp-3 | 4/10 = 40.0% | 4/10 = 40.0% | 0/4 = 0.0% | 0 | 0 | 0 | 0 | 0 |
| S-Rtr-1 | 2/18 = 11.1% | n/a (Verifier runtime fell back to claude-opus-5 (stream_disconnected); attempt VerifySRtr1 excluded and replacement budget exhausted.) | n/a (Verifier runtime fell back to claude-opus-5 (stream_disconnected); attempt VerifySRtr1 excluded and replacement budget exhausted.) | n/a | n/a | n/a | 1 | 0 |
| S-Rtr-3 | 2/18 = 11.1% | 2/18 = 11.1% | 0/2 = 0.0% | 0 | 0 | 0 | 1 | 0 |
| S-Smt-3 | 2/14 = 14.3% | n/a (Reviewer on pin; verifier not dispatched after the $30 ceiling was exceeded.) | n/a (Reviewer on pin; verifier not dispatched after the $30 ceiling was exceeded.) | n/a | n/a | n/a | 0 | 0 |
| S-Spt-2 | 1/32 = 3.1% | 1/32 = 3.1% | 0/1 = 0.0% | 0 | 0 | 0 | 1 | 0 |
| S-Spt-3 | 4/32 = 12.5% | 3/32 = 9.4% | 0/3 = 0.0% | 0 | 0 | 0 | 1 | 0 |
| T-Smt-1 | 2/14 = 14.3% | 1/14 = 7.1% | 0/1 = 0.0% | 0 | 0 | 0 | 0 | 0 |
| T-Spt-1 | 3/32 = 9.4% | 3/32 = 9.4% | 0/3 = 0.0% | 0 | 0 | 0 | 2 | 0 |

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
| S-App-3 | 4 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Fmp-1 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Fmp-3 | 4 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Rtr-1 | 1 | 2 | 0 | 0 | 0 | 1 | 0 | 0 |
| S-Rtr-3 | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| S-Smt-3 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| S-Spt-2 | 1 | 4 | 0 | 0 | 1 | 0 | 0 | 0 |
| S-Spt-3 | 4 | 4 | 0 | 0 | 1 | 0 | 0 | 0 |
| T-Smt-1 | 2 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| T-Spt-1 | 3 | 3 | 1 | 0 | 2 | 0 | 0 | 0 |

## Costs
- reviewer: 40.3337 (46 attempts, 0 unknown)
- verifier: 2.3700 (10 attempts, 0 unknown)
- adjudicator: 9.9907 (5 attempts, 0 unknown)
- unsuccessful: 31.9652 (9 attempts, 0 unknown)
- total: 52.6943 (61 attempts, 0 unknown)

## Timing
- experiment wall envelope: 12015442 ms
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
- trial S-App-1 span: 2131061 ms
- trial S-App-2 span: unavailable (attempts missing from dataset)
- trial S-App-3 span: 1207112 ms
- trial S-Fmp-1 span: 934512 ms
- trial S-Fmp-2 span: 2053498 ms
- trial S-Fmp-3 span: 851852 ms
- trial S-Rtr-1 span: 466359 ms
- trial S-Rtr-2 span: unavailable (attempts missing from dataset)
- trial S-Rtr-3 span: 2373611 ms
- trial S-Smt-1 span: unavailable (attempts missing from dataset)
- trial S-Smt-2 span: 4232651 ms
- trial S-Smt-3 span: 634680 ms
- trial S-Spt-1 span: 1716991 ms
- trial S-Spt-2 span: 649782 ms
- trial S-Spt-3 span: 3496849 ms
- trial T-App-1 span: unavailable (attempts missing from dataset)
- trial T-Fmp-1 span: unavailable (attempts missing from dataset)
- trial T-Rtr-1 span: unavailable (attempts missing from dataset)
- trial T-Smt-1 span: 318976 ms
- trial T-Spt-1 span: 244042 ms
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
- attempt TrialSApp1 (reviewer): 2131061 ms
- attempt TrialSApp3 (reviewer): 767823 ms
- attempt TrialSFmp1 (reviewer): 788725 ms
- attempt TrialSFmp2 (reviewer): 2053498 ms
- attempt TrialSFmp3 (reviewer): 581561 ms
- attempt TrialSRtr1 (reviewer): 466359 ms
- attempt TrialSRtr3 (reviewer): 585616 ms
- attempt TrialSSmt2 (reviewer): 1972163 ms
- attempt TrialSSmt3 (reviewer): 634680 ms
- attempt TrialSSpt1 (reviewer): 1716991 ms
- attempt TrialSSpt2 (reviewer): 533022 ms
- attempt TrialSSpt3 (reviewer): 2033776 ms
- attempt TrialTSmt1 (reviewer): 68094 ms
- attempt TrialTSpt1 (reviewer): 117477 ms
- attempt VerifySApp3 (verifier): 144868 ms
- attempt VerifySFmp1 (verifier): 123310 ms
- attempt VerifySFmp3 (verifier): 101492 ms
- attempt VerifySRtr1 (verifier): 1002346 ms
- attempt VerifySRtr3 (verifier): 1025510 ms
- attempt VerifySSpt2 (verifier): 112529 ms
- attempt VerifySSpt3 (verifier): 144354 ms
- attempt VerifyTSmt1 (verifier): 93066 ms
- attempt VerifyTSpt1 (verifier): 122903 ms

## Comparisons
| a | b | changed axes | label | historical | asymmetric repeats |
|---|---|---|---|---|---|
| H-Focus | H-Replay | brief,sampling | confounded | true | true |
| H-Focus | S | model,effort,brief,contract,rules,triage,sampling | confounded | true | true |
| H-Focus | T | brief,contract,rules,triage | confounded | true | true |
| H-Replay | S | model,effort,brief,contract,rules,triage,sampling | confounded | true | true |
| H-Replay | T | brief,contract,rules,triage,sampling | confounded | true | true |
| S | T | model,effort,sampling | confounded | false | true |

## Rounds (recorded last rounds; savings not measured)
| item | revision | path | last round | workflow |
|---|---|---|---|---|

## Exclusions
| kind | id | status | reason |
|---|---|---|---|
| trial | H-Replay-Fmp-3 | excluded | Original wrong-pin exclusion retained. |
| trial | S-App-1 | excluded | Actual pin/tool-grant mismatch |
| trial | S-App-2 | missing | Planned cell; not yet dispatched. |
| trial | S-Fmp-2 | excluded | Actual pin/tool-grant mismatch |
| trial | S-Rtr-2 | missing | Planned cell; not yet dispatched. |
| trial | S-Smt-1 | missing | Planned cell; not yet dispatched. |
| trial | S-Smt-2 | excluded | Actual pin/tool-grant mismatch |
| trial | S-Spt-1 | excluded | Actual pin/tool-grant mismatch |
| trial | T-App-1 | missing | Planned cell; not yet dispatched. |
| trial | T-Fmp-1 | missing | Planned cell; not yet dispatched. |
| trial | T-Rtr-1 | missing | Planned cell; not yet dispatched. |
| attempt | H-ReplayFmp3bbb | excluded | Recorded wrong-model exclusion; actual child used claude-sonnet, not intended terra. |
| attempt | Replacement3SSmt2 | excluded | Actual pin/tool-grant mismatch |
| attempt | TrialSApp1 | excluded | Actual pin/tool-grant mismatch |
| attempt | TrialSFmp2 | excluded | Actual pin/tool-grant mismatch |
| attempt | TrialSSmt2 | excluded | Actual pin/tool-grant mismatch |
| attempt | TrialSSpt1 | excluded | Actual pin/tool-grant mismatch |
| attempt | TrialSSpt3 | excluded | Actual pin/tool-grant mismatch |
| attempt | VerifySRtr1 | excluded | Wrong pin or incomplete indices |
| attempt | VerifySRtr3 | excluded | Wrong pin or incomplete indices |
