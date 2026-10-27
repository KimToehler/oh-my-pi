# acp-ask-dialog Specification

## Purpose
Defines how omp's `ask` questions are sent to an ACP client as one form elicitation, and how the client's accepted answer becomes the selections and free text the model reads.

## Requirements

### Requirement: Each question with options offers a companion free-text field

For each ask question with at least one option, the form SHALL carry a select field `q<i>` followed directly by a string field `q<i>__other` titled "Other (type your own)". The companion field SHALL have no default, no length or format constraint, and SHALL NOT be required. A question without options SHALL carry only `q<i>__other`. This holds on ACP v1 and v2.

#### Scenario: Single question with options
- **WHEN** the agent asks one single-select question with options "A" and "B" over ACP
- **THEN** the requested schema's property keys are exactly `q0`, `q0__other` in that order, and `q0__other` is `{ "type": "string", "title": "Other (type your own)" }`

#### Scenario: Question without options
- **WHEN** the agent asks a question with no options
- **THEN** the requested schema carries only `q0__other` for it

#### Scenario: Negative control
- **WHEN** the form for a question with options lacks `q0__other`, puts another property between `q0` and `q0__other`, or marks `q0__other` required
- **THEN** the request-schema assertion MUST fail

### Requirement: A single-select value outside the options is the free-text answer

When an accepted form gives a single-select question a string value that is not one of its option labels, the bridge SHALL report that value, trimmed, as the question's free-text answer with no option selected. It SHALL NOT drop the value. A value that is blank after trimming SHALL count as no answer. Non-string values SHALL be ignored. This holds on ACP v1 and v2.

#### Scenario: Air folds Other into the select
- **WHEN** a client accepts a one-question single-select ask with content `{ "q0": "  klar läuft hier docker  ", "q0__other": "" }` and "klar läuft hier docker" is not an option
- **THEN** the question's answer has no selected option and free text "klar läuft hier docker", and the `ask` tool result reads `User provided custom input: klar läuft hier docker` instead of reporting a cancellation

#### Scenario: Offered value still selects
- **WHEN** the accepted content is `{ "q0": "B" }` and "B" is an option
- **THEN** the answer selects "B" and carries no free text

#### Scenario: Blank value
- **WHEN** the accepted content of a one-question single-select ask is `{ "q0": "   " }`
- **THEN** the question has no answer and the `ask` tool reports the cancellation it reports for an empty answer today

#### Scenario: Same answer over ACP v2
- **WHEN** a v2 client answers `elicitation/create` for a single-select ask with `{ "action": "accept", "content": { "q0": "typed text" } }` and "typed text" is not an option
- **THEN** the tool receives free text "typed text" and no selected option

#### Scenario: Negative control
- **WHEN** the bridge drops a string `q0` value that is not an option label, as it did before this change
- **THEN** the single-question ask returns `Ask tool was cancelled by the user`, and the "Air folds Other into the select" assertion MUST fail

### Requirement: Multi-select items outside the options are free text beside the selections

When an accepted form gives a multi-select question an array, the items that are option labels SHALL become the selected options in array order. The other non-blank string items, trimmed, SHALL become the question's free-text answer, joined by a newline in array order, with each exact text kept once at its first position. Blank and non-string items SHALL be ignored.

#### Scenario: Selections plus a typed item
- **WHEN** a multi-select question offers "A", "B", "C" and the accepted content is `{ "q0": ["A", "my own idea", "C"] }`
- **THEN** the answer selects "A" and "C" and carries free text "my own idea"

#### Scenario: Only typed items
- **WHEN** the accepted content is `{ "q0": [" first ", "second"] }` and neither item is an option
- **THEN** the answer selects nothing and carries free text "first\nsecond"

#### Scenario: Repeated typed item
- **WHEN** the accepted content is `{ "q0": ["x", " x ", "y"] }` and no item is an option
- **THEN** the answer selects nothing and carries free text "x\ny"

#### Scenario: Negative control
- **WHEN** the bridge filters the array down to option labels and drops "my own idea"
- **THEN** the "Selections plus a typed item" assertion on the free text MUST fail

### Requirement: Text from the companion field and the select are both kept

The free-text answer SHALL combine, in this order, the text taken from the select field and the trimmed non-blank `q<i>__other` value, joined by a newline. Each exact text SHALL be kept once, at its first position, across the whole combined list: within a multi-select array and between the select and the companion. For a single-select question, any free text SHALL leave no option selected, as a companion answer does today. Companion-only answers SHALL keep their current result.

#### Scenario: Companion text with an offered option
- **WHEN** a single-select question offers "Standard" and the accepted content is `{ "q0": "Standard", "q0__other": "custom" }`
- **THEN** the answer selects nothing and carries free text "custom"

#### Scenario: Both fields carry typed text
- **WHEN** the accepted content is `{ "q0": "typed in the select", "q0__other": "typed in the field" }` and neither is an option
- **THEN** the free text is "typed in the select\ntyped in the field"

#### Scenario: The same text in both fields
- **WHEN** the accepted content is `{ "q0": "same", "q0__other": " same " }` and "same" is not an option
- **THEN** the free text is "same"

#### Scenario: Negative control
- **WHEN** the bridge keeps only the `q0__other` text and drops "typed in the select"
- **THEN** the "Both fields carry typed text" assertion MUST fail
