---
status: approved
approved_at: 2026-06-08T07:19:39Z
last_modified: 2026-06-08T07:19:39Z
---

# Requirements Document

## Introduction

Raptor can already build a local wiki, index symbols, detect nested workspaces, and guide Copilot CLI toward source-grounded answers. Manual testing on `avepa` showed the next gap: procedural questions such as "Come si crea un'utenza?" need stronger backend/API evidence than symbol search alone can provide.

This feature adds deterministic route/controller evidence and an agent-facing evidence bundle. <!-- assumed: this increment should strengthen deterministic retrieval before adding embeddings or a document generator --> The scope is local route extraction, route wiki/index output, route-aware query ranking, and a structured `answer-pack` command that downstream skills can use to generate test, functional, or technical documents.

## Requirements

### R1 Route Extraction

**User Story:** As a developer asking procedural questions about a codebase, I want Raptor to detect backend routes and controllers, so that answers can cite API evidence instead of relying only on symbol names.

#### Acceptance Criteria

1. `R1.AC1` WHEN `raptor wiki build` scans a Java source file, the system SHALL extract route records from Spring mapping annotations.
2. `R1.AC2` WHEN `raptor wiki build` scans a JavaScript or TypeScript source file, the system SHALL extract route records from Express-style router or app HTTP method calls.
3. `R1.AC3` WHEN `raptor wiki build` scans a Python source file, the system SHALL extract route records from FastAPI or Flask route decorators.
4. `R1.AC4` The system SHALL store each route record with HTTP method, route path, source file path, line number, optional handler name, framework hint, workspace root, confidence, and reason.
5. `R1.AC5` IF a route path or HTTP method cannot be fully resolved, THEN the system SHALL keep the route record with `confidence: low`.
6. `R1.AC6` IF a route-like pattern requires executing source code to resolve, THEN the system SHALL skip route resolution for that pattern.
7. `R1.AC7` IF a route-like pattern requires executing source code to resolve, THEN the system SHALL record a build warning.

### R2 Route Index And Wiki Page

**User Story:** As a developer reviewing Raptor's generated wiki, I want route evidence written to local artifacts, so that I can validate API understanding before trusting procedural answers.

#### Acceptance Criteria

1. `R2.AC1` WHEN `raptor wiki build` completes, the system SHALL write route records to `.raptor/index/routes.jsonl`.
2. `R2.AC2` WHEN `raptor wiki build` completes, the system SHALL generate or update `.raptor/wiki/routes.md`.
3. `R2.AC3` The system SHALL include every route source file in the `sources` frontmatter for `.raptor/wiki/routes.md`.
4. `R2.AC4` IF no routes are detected, THEN the system SHALL generate `.raptor/wiki/routes.md` with a no-routes-found statement.
5. `R2.AC5` WHEN `llms.txt` or `llms-full.txt` is generated, the system SHALL include the route wiki page in the exported wiki index.

### R3 Route-Aware Query Ranking

**User Story:** As a developer asking "how is X created or handled?", I want Raptor queries to prefer route and controller evidence, so that results point toward the backend surface involved in the workflow.

#### Acceptance Criteria

1. `R3.AC1` WHEN a query contains procedural or API terms, the system SHALL rank matching route chunks above generic symbol inventory chunks.
2. `R3.AC2` WHEN a query term matches a route path, HTTP method, handler name, framework hint, or source file path, the system SHALL increase the route result score.
3. `R3.AC3` WHEN route results are returned in JSON output, the system SHALL include matching route records.
4. `R3.AC4` WHEN human-readable query output has route matches, the system SHALL display the best matching route source before generic source paths.
5. `R3.AC5` IF route matches come from non-reviewed or stale pages, THEN the system SHALL include the existing review or staleness warning.

### R4 Answer Pack

**User Story:** As a downstream agent or doc-builder skill, I want a structured evidence bundle for a question, so that generated documents can be grounded in files, routes, symbols, snippets, and caveats.

#### Acceptance Criteria

1. `R4.AC1` WHEN `raptor answer-pack <question> [path] --json` runs, the system SHALL return a JSON envelope with question, target path, wiki results, symbol hits, route hits, source snippets, confidence, and warnings.
2. `R4.AC2` WHEN `raptor answer-pack` selects source snippets, the system SHALL prefer files referenced by route hits before files referenced only by symbol hits.
3. `R4.AC3` WHEN `raptor answer-pack` reads source files, the system SHALL limit snippet size per file.
4. `R4.AC4` IF the wiki index is missing, THEN the system SHALL return an error that instructs the user to run `raptor wiki build`.
5. `R4.AC5` IF no direct route or symbol evidence is found, THEN the system SHALL return low confidence with an explicit insufficient-evidence warning.

### R5 Validation And Staleness

**User Story:** As a maintainer, I want route evidence to participate in validation, so that stale or broken API evidence is surfaced before agents rely on it.

#### Acceptance Criteria

1. `R5.AC1` WHEN `raptor wiki validate` checks wiki pages, the system SHALL validate source references from `.raptor/wiki/routes.md`.
2. `R5.AC2` WHEN a route source file changes after build, the system SHALL mark `.raptor/wiki/routes.md` as stale.
3. `R5.AC3` IF a route source file is deleted after build, THEN the system SHALL report the missing route source during validation.
4. `R5.AC4` WHEN `raptor wiki status --json` runs, the system SHALL include `.raptor/wiki/routes.md` in draft, reviewed, or stale status lists.

### R6 Agent Workflow Compatibility

**User Story:** As a Copilot CLI user, I want the Raptor skill to consume route and answer-pack evidence, so that procedural answers and future document builders follow the same verified-source workflow.

#### Acceptance Criteria

1. `R6.AC1` WHERE the Raptor skill is used for procedural questions, the system SHALL instruct the agent to call `raptor answer-pack <question> <target-path> --json` before manual grep-style exploration.
2. `R6.AC2` WHERE the answer pack includes route hits, the system SHALL instruct the agent to cite route files in `File verificati`.
3. `R6.AC3` IF the answer pack confidence is low, THEN the system SHALL instruct the agent to state the limitation before proposing a workflow.

## Non-Functional Requirements

- `NFR1` Raptor SHALL keep route extraction local and deterministic without embeddings, model calls, or network access.
- `NFR2` Raptor SHALL preserve Windows path compatibility while storing index paths with forward slashes.
- `NFR3` Raptor SHALL avoid executing project source code, package scripts, dependency managers, or framework CLIs during route extraction.
- `NFR4` Raptor SHALL keep answer-pack output bounded so that agents can consume it without reading entire repositories.
- `NFR5` Raptor SHALL keep CommonJS module structure and Node.js built-in APIs as the default implementation style.

## Constraints And Dependencies

- `C1` The implementation depends on Node.js built-in filesystem and path APIs only.
- `C2` The implementation must remain compatible with the existing `src/wiki.js`, `src/symbols.js`, and `src/workspaces.js` module layout.
- `C3` `.raptor/wiki` remains the authoritative documentation source.
- `C4` Query and answer-pack behavior must work when the target directory is not a Git repository.
- `C5` Route extraction will be heuristic and source-text based in this increment.

## Out Of Scope

- Embeddings, vector indexes, semantic reranking, or local embedding models.
- Generating test plans, functional documents, or technical documents directly.
- MCP server integration.
- Full framework parsing with AST dependencies.
- Executing source files or application servers to discover routes dynamically.
- Provider-specific WSO2, Keycloak, Auth0, or OAuth administration flows.
