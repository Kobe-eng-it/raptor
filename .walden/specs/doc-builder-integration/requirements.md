---
status: approved
approved_at: 2026-06-08T15:35:28Z
last_modified: 2026-06-08T15:35:28Z
---

# Requirements Document

## Introduction

This feature introduces a doc-builder workflow that turns local code evidence into source-grounded document drafts. Raptor remains the deterministic evidence layer through `.raptor/wiki`, lexical indexes, route evidence, and `raptor answer-pack`. The new doc-builder workflow starts as an agent skill that orchestrates analysis, outline creation, drafting, review, and optional file writing.

The first increment focuses on a standalone doc-builder skill and does not add an MCP server or a new Raptor document-generation CLI command.

## Requirements

### R1 Evidence-First Document Workflow

**User Story:** As a developer, I want doc-builder to analyze code evidence before drafting, so that generated documents are grounded in verified source files.

#### Acceptance Criteria

1. `R1.AC1` WHEN a user requests a document for a target codebase, the system SHALL run `raptor answer-pack <question> <target-path> --json` before drafting document content.
2. `R1.AC2` WHEN `answer-pack` returns route or source files, the system SHALL inspect at least the first three distinct evidence files before drafting document content.
3. `R1.AC3` WHEN inspected evidence supports a claim, the system SHALL cite the supporting file path in the draft.
4. `R1.AC4` IF inspected evidence does not show a complete workflow chain, THEN the system SHALL label the workflow as partial or inferred.
5. `R1.AC5` IF the target wiki index is missing, THEN the system SHALL run or request `raptor wiki build` before generating an outline.

### R2 Document Type Selection

**User Story:** As a user, I want to choose the document type, so that doc-builder produces the format I need.

#### Acceptance Criteria

1. `R2.AC1` WHEN a user explicitly names a document type, the system SHALL use that document type for the outline.
2. `R2.AC2` WHEN a user does not name a document type, the system SHALL default to a functional document.
3. `R2.AC3` WHERE document type selection is supported, the system SHALL support functional document, technical document, test plan, test cases, API notes, and user workflow notes.
4. `R2.AC4` IF a requested document type is unsupported, THEN the system SHALL ask the user to choose one supported document type.

### R3 Outline Gate

**User Story:** As a reviewer, I want to approve the document outline before long-form drafting, so that the document structure matches the intended use.

#### Acceptance Criteria

1. `R3.AC1` WHEN the proposed document has more than three sections, the system SHALL present an outline before drafting section content.
2. `R3.AC2` WHEN the proposed document has more than three sections, the system SHALL wait for explicit outline approval before drafting section content.
3. `R3.AC3` WHEN a user changes the document type during outline review, the system SHALL regenerate the outline for the selected document type.
4. `R3.AC4` WHEN a user changes the language during outline review, the system SHALL regenerate the outline in the selected language.
5. `R3.AC5` WHERE the proposed document has three sections or fewer, the system SHALL allow direct draft generation without a separate outline approval gate.

### R4 Evidence Thresholds And Confidence Handling

**User Story:** As a maintainer, I want doc-builder to distinguish complete evidence from weak evidence, so that drafts do not overstate what the code proves.

#### Acceptance Criteria

1. `R4.AC1` WHEN `answer-pack` returns medium or high confidence, the system SHALL allow draft outline generation after inspecting the required evidence files.
2. `R4.AC2` WHEN a behavioral document describes a workflow, the system SHALL require at least one verified route, controller, service, entrypoint, or equivalent workflow boundary before claiming behavioral evidence.
3. `R4.AC3` WHEN the inspected evidence shows entrypoint or route, service, and persistence or provider or configuration, the system SHALL allow the draft to describe the workflow as complete.
4. `R4.AC4` IF `answer-pack` returns low confidence, THEN the system SHALL diagnose the likely cause before drafting a document.
5. `R4.AC5` IF evidence remains low after diagnosis, THEN the system SHALL produce an evidence-insufficiency brief instead of a full document.

### R5 Draft And Final Storage

**User Story:** As a project owner, I want generated documents to stay separate from official documentation until approved, so that generated drafts do not pollute the repository docs.

#### Acceptance Criteria

1. `R5.AC1` WHEN a user approves saving a draft, the system SHALL write draft documents under `.raptor/docs/` in the target codebase.
2. `R5.AC2` WHEN a user explicitly approves publishing a final document, the system SHALL write the final document under `docs/` in the target codebase.
3. `R5.AC3` IF a user has not approved writing to `docs/`, THEN the system SHALL not write generated content to `docs/`.
4. `R5.AC4` WHEN a generated document is written to disk, the system SHALL include source evidence, assumptions, and limits in the document.

### R6 Language Handling

**User Story:** As an Italian-speaking user, I want doc-builder to start in Italian while allowing language changes, so that documents match the intended audience.

#### Acceptance Criteria

1. `R6.AC1` WHEN the user does not specify a language, the system SHALL start the outline in Italian.
2. `R6.AC2` WHEN the user specifies a language, the system SHALL use the requested language for the outline.
3. `R6.AC3` WHEN the user changes language during outline review, the system SHALL regenerate the outline in the selected language.
4. `R6.AC4` WHEN drafting begins from an approved outline, the system SHALL use the outline language for the draft.

### R7 Scope Boundary

**User Story:** As a maintainer, I want the first doc-builder increment to stay small, so that Raptor's evidence layer remains stable.

#### Acceptance Criteria

1. `R7.AC1` WHERE doc-builder is implemented in this increment, the system SHALL implement it as a standalone agent skill.
2. `R7.AC2` WHERE Raptor evidence is needed, the system SHALL consume existing Raptor CLI output instead of duplicating Raptor analysis logic.
3. `R7.AC3` The system SHALL treat MCP as a future extension.
4. `R7.AC4` The system SHALL not add an MCP server in this increment.
5. `R7.AC5` The system SHALL not add embeddings or semantic reranking in this increment.

## Non-Functional Requirements

- `NFR1` The system SHALL keep document generation source-grounded by requiring file evidence for behavioral claims.
- `NFR2` The system SHALL keep the first increment usable from agent CLI workflows without introducing new runtime dependencies.
- `NFR3` The system SHALL preserve Windows path compatibility for target paths and generated document paths.
- `NFR4` The system SHALL keep generated drafts reviewable by exposing assumptions, limits, and verified files.
- `NFR5` The system SHALL avoid committing or publishing private target-project details in public Raptor repository artifacts.

## Constraints And Dependencies

- `C1` The implementation depends on the existing `raptor answer-pack <question> <target-path> --json` command.
- `C2` The implementation depends on the existing Raptor skill and local agent skill conventions.
- `C3` Draft storage uses `.raptor/docs/` in the target codebase.
- `C4` Final document storage uses `docs/` in the target codebase only after explicit approval.
- `C5` MCP is deferred until the evidence schema and doc-builder workflow stabilize.

## Out Of Scope

- MCP server implementation.
- Embeddings, vector search, or semantic reranking.
- A new Raptor CLI command for generating full documents.
- Automatic publication of generated documents into official `docs/`.
- Proving workflows that are not visible in inspected source evidence.
