# Review

- **Verdict**: REJECT
- **Reviewed digest**: fc6ba96ae861f9c211108e51cc67255206f4b91d280f108b0d6cadfeaa222edd
- **Reviewer**: plan-reviewer, DbaCorrectnessR3, DbaVerificationR3b, DbaChecksR3
- **Round**: 3
- **Override**: none

## Blockers

### Verification (DbaVerificationR3b)

[
  {
    "area": "quality (criteria coverage)",
    "defect": "Vier Szenarien aus drei Requirements werden von keiner F1-Zeile, keiner Kontrolle und keinem deterministischen Check geprüft; die Begründung im Design nennt dafür Zeilen, die diese Regeln nicht berühren.",
    "evidence": "spec.md:71-83 (`### Requirement: A failed search leaves the decision open` mit `#### Scenario: Search provider fails` und `#### Scenario: Negative control`) hat keine Zeile in der F1-Tabelle design.md:136-149 - A2/C2/C3/C4 prüfen Teilabdeckung, fehlende Lücke/Release, fehlende Platform-Zeile und eine bereits offene Decision, keine davon die Regel \"ein fehlgeschlagener Suchlauf ist nicht `none`\", den Retry, das Offenlassen oder das Rückfragen. design.md:151 behauptet dennoch \"Both branches share the form and the rules that A2, C2, C3 and the delivered-text check cover\"; der delivered-text check (tasks.md:7) pinnt nur Bytes und kann die Wirkung des Satzes nicht zeigen. Ebenso ohne jede Kontrolle: spec.md:47-50 (Negativkontrolle zu `A covered mechanism brings design.md`) und spec.md:108-111 (Negativkontrolle zu `Research uses keyless session tools`); A0 (design.md:139) deckt von spec.md:35-36 nur die erste Hälfte ab, nicht \"lets the search start with open-source libraries before the repository and platform\". Das etablierte Mittel für genau diese instruktionsseitigen Negativkontrollen existiert im Repo: die Instruction-Review-Zeilen E/D1 und E/D2 auf absichtlich verfälschten Kopien in openspec/changes/archive/2026-11-01-verification-blocker-accept/tasks.md:17.",
    "change": "Für spec.md:47-50, :80-83 und :108-111 je eine Instruction-Review-Zeile ergänzen (frischer Default-`task`-Agent, (a) delivered E1/E2-Text, (b) mutierte Kopie, die das Verbotene erlaubt; besteht nur, wenn (a) \"none found\" liefert und (b) den mutierten Satz zitiert), und für spec.md:75-78 entweder eine Zeile oder - mit Nennung in gate.md - das Requirement auf den lens-seitig belegten Teil (C4) zurücknehmen; design.md:151 entsprechend korrigieren, da die dort genannten Zeilen die Regel nicht abdecken."
  },
  {
    "area": "quality (verification)",
    "defect": "Die Verify von Task 1.1 kann nicht fehlschlagen, wenn E1 (und E2) an der falschen Stelle innerhalb derselben Instruction landen - obwohl bei E1 genau die Platzierung in der Liste \"When to include design.md\" das gesamte Requirement ist.",
    "evidence": "tasks.md:7: die einzige Positionsprüfung ist die awk-Range für E3 (`awk '/Correctness lens \\(item 1\\):/{f=1} /Verification lens \\(item 2\\):/{f=0} f' \"$S\" | grep -q 'that the plan introduces without its subsection in design.md'`). E1 und E2 werden nur über `jq -e '(.instruction | contains(\"The change introduces a mechanism the\")) and (.instruction | contains(\"Build vs. adopt: a mechanism the change introduces\"))'` geprüft - ein Substring-Test über die ganze Design-Instruction - plus den Zeilen-Diff, der nur Menge und Reihenfolge der hinzugefügten Zeilen vergleicht. E1 in die `Sections:`-Liste (schema.yaml:184-191) statt in die Liste \"When to include design.md (create only if any apply):\" (schema.yaml:178-182) eingefügt lässt deleted=0, die Reihenfolge E1,E2,E3 und alle vier Teilprüfungen intakt, verletzt aber spec.md:38-40. Realistischer Auslöser: die drei Anker S:182, S:202, S:363 sind alle gegen dieselbe Basis gezählt und verschieben sich beim Einfügen. Die einzige Verhaltenszeile dazu, B2 (design.md:143), fragt ein Modell, ob ein RFC-5545-Import design.md braucht - das bejahen schon die bestehenden Gründe schema.yaml:180 (\"New external dependency\") und schema.yaml:182 (\"Ambiguity that benefits from technical decisions before coding\"), also kann B2 mit falsch platziertem E1 bestehen.",
    "change": "In 1.1 je eine Range-Prüfung pro Einfügung ergänzen, wie sie für E3 schon existiert: E1 zwischen \"When to include design.md (create only if any apply):\" und \"Sections:\", E2 zwischen \"The reviewer rejects a change that does neither.\" und \"Focus on architecture and approach\"; zusätzlich eine Merge-Base-Basiszeile zu B2 (wie A0 zu A), damit B2 den Effekt von E1 überhaupt zuordnen kann."
  },
  {
    "area": "quality (F1 evidence check)",
    "defect": "Die Evidenzprüfung von Task 2.1 verlangt das einzige Artefakt der Negativkontrolle A0 nicht; die Verify besteht, wenn genau das Dokument fehlt, an dem A0 beurteilt wird.",
    "evidence": "tasks.md:15: `for r in A A2 A3 B2 B3; do test -s \"$E/$r/artifacts/design.md\" || m=1; done` - A0 fehlt in der Liste. design.md:139 definiert A0 (\"negative control\") ausschließlich über den Inhalt des geschriebenen Dokuments (\"`design.md` has no `Build vs. adopt` subsection\"), und A0 verwendet den Design-Zeilen-Prompt aus design.md:134 (\"Write only design.md\"), schreibt also eines; design.md:153 listet \"the written `design.md` where one exists\" als aufzubewahrendes Artefakt. Für A0 fordert die Verify nur prompt.txt/output.txt/calls.md, also Modellprosa statt des Artefakts, das die Negativkontrolle belegt.",
    "change": "A0 in die artifacts-Schleife aufnehmen (`for r in A A0 A2 A3 B2 B3`) und für B festlegen, ob ein geschriebenes design.md erwartet wird; zusätzlich prüfen, dass A0s design.md keinen `Build vs. adopt`-Abschnitt enthält, damit die Kontrolle auch maschinell fehlschlagen kann."
  }
]
