# Spec Delta

## Purpose

Defines what the team's release-notes skill instructs an agent to do when it drafts release notes for a tagged release, and the shape the drafted notes take.

## ADDED Requirements

### Requirement: Skill instructs package grouping
The release-notes skill SHALL contain the sentence `Group release notes by package before listing changes.` verbatim and exactly once, as its own paragraph between the `# Release notes` heading and the numbered steps. All other lines of the skill SHALL stay unchanged.

#### Scenario: Delivered skill text
- **WHEN** the release-notes skill file is read after the change
- **THEN** exactly one line equals `Group release notes by package before listing changes.`, it sits between the `# Release notes` heading and step 1, and removing that line and its following blank line yields the file as it was before the change

#### Scenario: Negative control
- **WHEN** the skill file carries a paraphrase such as `Sort release notes by package.`, the sentence twice, or the sentence with an edited step 1-4
- **THEN** the delivered-text check MUST fail

### Requirement: Drafted notes are grouped by package
When an agent follows the release-notes skill for a release whose user-visible changes touch more than one package (the repository's own unit: workspace package, module or top-level component), the draft SHALL put its change bullets into one group per package, headed by the package name, and SHALL place each bullet in the group of a package that change touches.

#### Scenario: Two-package release
- **WHEN** an agent drafts notes with the skill for a release whose merged pull requests change user-visible behaviour in two packages
- **THEN** the draft shows one group per package, each headed by its package name, and every change bullet sits in the group of a package it touches

#### Scenario: Negative control
- **WHEN** a draft for that two-package release lists all change bullets in one flat list, or a bullet sits under a package its change does not touch
- **THEN** the draft MUST fail the package-grouping judgement
