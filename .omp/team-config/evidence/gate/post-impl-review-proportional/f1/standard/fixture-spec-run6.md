# Spec Delta

## Purpose
Late fee accrual for overdue invoices and the report that lists them for finance follow-up.

## ADDED Requirements

### Requirement: Late fee per invoice
An invoice overdue at the as-of date SHALL accrue a late fee of 2% of its amount for each complete 30-day period overdue, capped at 25% of the amount, in whole cents rounded down. Days overdue are counted in UTC calendar days.

#### Scenario: One complete period
- **WHEN** an invoice of 10000 cents due 2026-01-10 is evaluated as of 2026-02-15
- **THEN** its late fee is 200 cents

#### Scenario: Fee cap
- **WHEN** an invoice of 10000 cents is more than a year overdue
- **THEN** its late fee is 2500 cents

#### Scenario: Negative control
- **WHEN** an invoice is only 29 days overdue
- **THEN** any late fee above 0 cents MUST fail this requirement

### Requirement: Overdue report ordering
The overdue report SHALL list only invoices with a late fee above zero, ordered by late fee descending, then by due date ascending (earlier first), then by invoice id ascending in plain code-unit string order, followed by a total of all listed fees. The order SHALL NOT depend on the order of the input file.

#### Scenario: Different fees
- **WHEN** one invoice has a fee of 1000 cents and another a fee of 200 cents
- **THEN** the 1000-cent invoice is listed first

#### Scenario: Equal fees
- **WHEN** two listed invoices have equal late fees and different due dates, in any input order
- **THEN** the invoice with the earlier due date is listed first, and invoices with equal due dates are listed by id

#### Scenario: Negative control
- **WHEN** an invoice has a late fee of 0 cents
- **THEN** a report line for it MUST fail this requirement
