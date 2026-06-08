---
status: approved
approved_at: 2026-06-08T15:39:33Z
last_modified: 2026-06-08T15:39:33Z
source_requirements_approved_at: 2026-06-08T15:35:28Z
---

# Feature Design

## Overview

Doc-builder will start as a standalone agent skill that depends on Raptor for deterministic evidence. The skill does not reimplement repository analysis. It instructs the agent to call `raptor answer-pack`, inspect evidence files, propose an outline, draft source-grounded document content, and optionally write approved drafts or final documents to disk.

The simplest useful increment is skill-only: no MCP server, no embeddings, no new full-document CLI command. This keeps Raptor as the evidence layer and makes doc-builder the orchestration layer.

## Architecture

```text
User request
  -> doc-builder skill
  -> raptor answer-pack <question> <target-path> --json
  -> inspect route/source files
  -> diagnose low confidence when needed
  -> propose outline
  -> draft document from approved outline
  -> optional write to .raptor/docs or docs
```

The skill works through instructions and existing agent tools. It relies on the installed `raptor` CLI and normal file-reading/editing capabilities. Generated content remains review-gated: long documents require outline approval, and writes require explicit approval.

## Options Considered

### Option A

- Summary: Add a standalone `doc-builder` skill that orchestrates Raptor evidence and document drafting.
- Why chosen: It keeps analysis and writing separate while giving the user a single workflow. It avoids expanding the CLI before document schemas stabilize.

### Option B

- Summary: Add a new `raptor doc-build` CLI command.
- Why rejected: It would require hard-coding document generation behavior too early and would blur the boundary between deterministic evidence extraction and agent-authored documents.

### Option C

- Summary: Add an MCP server for Raptor evidence resources.
- Why rejected: MCP is useful once evidence contracts and document schemas are stable, but it adds transport and lifecycle complexity before the first doc-builder workflow has proven itself.

## Simplicity And Elegance Review

- Simplest viable shape: a single skill file with clear phases and templates.
- Coupling check: doc-builder consumes `raptor answer-pack` output but does not import or duplicate Raptor internals.
- Future-proofing: MCP and CLI document generation are deferred until the skill workflow exposes stable schemas.

## Components And Interfaces

### `skill/doc-builder/SKILL.md`

- Purpose: Define the agent workflow for source-grounded document generation.
- Inputs/Outputs:
  - Input: user request, target path, optional document type, optional language, optional write request.
  - Output: outline, draft, evidence-insufficiency brief, or approved file write.
- Dependencies: installed `raptor` CLI, especially `raptor answer-pack`.
- Requirements: `R1`, `R2`, `R3`, `R4`, `R5`, `R6`, `R7`

### Evidence Phase

- Purpose: Gather and inspect code evidence before drafting.
- Inputs/Outputs:
  - Runs `raptor answer-pack <question> <target-path> --json`.
  - Reads at least the first three distinct route/source files when available.
  - Records verified files, route evidence, confidence, assumptions, and limits.
- Dependencies: Raptor wiki/index state and source file access.
- Requirements: `R1`, `R4`, `NFR1`, `NFR4`

### Outline Phase

- Purpose: Determine document type, language, and structure before long-form drafting.
- Inputs/Outputs:
  - Defaults document type to functional document unless the user specifies another supported type.
  - Defaults language to Italian unless the user specifies another language.
  - Presents an outline for documents with more than three sections.
- Dependencies: evidence phase result and user approval.
- Requirements: `R2`, `R3`, `R6`

### Draft Phase

- Purpose: Produce source-grounded document content from the evidence and approved outline.
- Inputs/Outputs:
  - Includes verified files, evidence, assumptions, limits, and partial/inferred workflow labels when needed.
  - Produces an evidence-insufficiency brief instead of a full document when confidence remains low after diagnosis.
- Dependencies: approved outline when required.
- Requirements: `R1`, `R3`, `R4`, `R6`, `NFR4`

### Write Phase

- Purpose: Persist generated content only after approval.
- Inputs/Outputs:
  - Writes drafts to `.raptor/docs/`.
  - Writes final approved documents to `docs/`.
  - Never writes to official docs without explicit approval.
- Dependencies: target filesystem write permission.
- Requirements: `R5`, `NFR3`

## Data Models

Doc-builder does not introduce a persisted data model in the first increment. The skill should use these conceptual structures in its instructions:

Evidence summary:

```json
{
  "question": "string",
  "target_path": "string",
  "confidence": "high|medium|low",
  "document_type": "functional|technical|test-plan|test-cases|api-notes|workflow-notes",
  "language": "it|en|other",
  "verified_files": [],
  "route_evidence": [],
  "assumptions": [],
  "limits": []
}
```

Document draft:

```json
{
  "title": "string",
  "outline": [],
  "sections": [],
  "verified_files": [],
  "evidence": [],
  "assumptions": [],
  "limits": []
}
```

These structures guide skill behavior; they do not need to be serialized by the CLI in this increment.

## Error Handling

- Missing Raptor CLI: report install/update instructions and stop.
- Missing wiki/index: run or request `raptor wiki build`, then retry `answer-pack`.
- Stale or draft wiki evidence: disclose status in the outline or brief.
- Low confidence: diagnose target path, wiki build state, empty indexes, route absence, and query specificity before drafting.
- Unsupported document type: ask the user to choose one supported type.
- Write without approval: refuse to write and ask for explicit approval.

## Security Considerations

- Do not commit or publish target-project private details from generated documents into the public Raptor repository.
- Keep generated drafts in the target project unless the user explicitly requests otherwise.
- Do not write to `docs/` without explicit final approval.
- Do not claim complete workflows without verified evidence from inspected files.

## Failure Modes And Tradeoffs

- Failure mode: The skill generates a plausible document from weak evidence.
- Mitigation: Require evidence inspection, confidence diagnosis, partial/inferred labels, and evidence sections.
- Tradeoff: Some drafts will be slower because the agent must inspect files before writing.

- Failure mode: The user expects a single-step output but the outline gate pauses long documents.
- Mitigation: Allow direct drafting only for short outputs with three sections or fewer.
- Tradeoff: Long documents require one extra approval step.

- Failure mode: The Raptor answer pack misses relevant code.
- Mitigation: Diagnose low confidence and use follow-up Raptor queries or rebuilds before drafting.
- Tradeoff: The first increment remains lexical and deterministic instead of adding embeddings.

- Failure mode: Generated drafts are treated as official docs too early.
- Mitigation: Store drafts in `.raptor/docs/` and require explicit approval for `docs/`.
- Tradeoff: Users perform a second approval step before publication.

## Testing Strategy

- Skill text regression tests should assert the workflow calls `raptor answer-pack` before drafting.
- Skill text regression tests should assert evidence inspection requirements.
- Skill text regression tests should assert outline approval behavior for documents over three sections.
- Skill text regression tests should assert draft and final storage paths.
- Skill text regression tests should assert low-confidence diagnosis behavior.
- Skill text regression tests should assert MCP remains future scope.

## Verification Plan

- Requirement proof: Use tests that read `skill/doc-builder/SKILL.md` and assert required workflow instructions are present.
- Test evidence: Run `npm test`.
- Operational evidence: Manually ask the installed skill for a functional document on a local fixture or reviewed project, confirming it proposes an outline before long-form drafting.

## Requirement Coverage

| Requirement | Covered By |
| --- | --- |
| `R1` | Evidence Phase, `skill/doc-builder/SKILL.md` |
| `R2` | Outline Phase, document type rules |
| `R3` | Outline Phase, approval gate rules |
| `R4` | Evidence Phase, Draft Phase, low-confidence diagnosis |
| `R5` | Write Phase, storage policy |
| `R6` | Outline Phase, Draft Phase language handling |
| `R7` | Skill-only architecture, out-of-scope controls |
| `NFR1` | Evidence inspection rules |
| `NFR2` | Skill-only implementation |
| `NFR3` | Write Phase path handling |
| `NFR4` | Draft evidence/assumption/limit sections |
| `NFR5` | Security Considerations, repository hygiene |
