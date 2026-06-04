---
status: approved
approved_at: 2026-06-04T13:30:04Z
last_modified: 2026-06-04T13:30:04Z
---

# Requirements Document

## Introduction

Raptor Wiki Core currently builds a local wiki from the current directory, but real projects may keep the runnable application inside nested folders such as `frontend/gui`. This feature improves Raptor's local analysis so it detects nested workspaces, derives entrypoints from project manifests and common config files, writes those findings into the wiki, and makes related queries return useful source-backed answers.

## Requirements

### R1 Nested Workspace Discovery

**User Story:** As a developer using Raptor on a repository with nested projects, I want Raptor to detect subprojects automatically, so that the wiki reflects the real project layout instead of only the root folder.

#### Acceptance Criteria

1. `R1.AC1` WHEN `raptor wiki build` scans a project directory, the system SHALL identify nested workspace roots that contain recognized project manifests.
2. `R1.AC2` The system SHALL include each detected workspace root path, manifest type, optional package name, and primary language in the build context.
3. `R1.AC3` IF a recognized manifest file cannot be parsed, THEN the system SHALL keep the workspace in the analysis with a parse warning.

### R2 Entrypoint Detection From Workspace Metadata

**User Story:** As a developer asking where an application starts, I want Raptor to infer entrypoints from package metadata and common config files, so that query results point to the files that actually launch the app.

#### Acceptance Criteria

1. `R2.AC1` WHEN a JavaScript or TypeScript workspace contains `package.json`, the system SHALL derive candidate entrypoints from `main`, `module`, `exports`, `bin`, and scripts named `dev`, `start`, or `serve`.
2. `R2.AC2` WHEN a workspace contains common frontend config files, the system SHALL derive candidate entrypoints from conventional files such as `src/main.ts`, `src/main.tsx`, `src/index.ts`, `src/index.tsx`, `src/App.tsx`, and `src/App.jsx`.
3. `R2.AC3` WHEN a Python or Go workspace contains recognized manifests or conventional source files, the system SHALL derive candidate entrypoints from `main.py`, `app.py`, `manage.py`, `cmd/*/main.go`, and `main.go`.
4. `R2.AC4` IF a derived entrypoint path does not exist, THEN the system SHALL omit that entrypoint and record the skipped reference in validation diagnostics or build warnings.

### R3 Wiki Representation

**User Story:** As a developer reviewing the generated wiki, I want workspace and entrypoint findings represented explicitly, so that I can validate Raptor's understanding before relying on query answers.

#### Acceptance Criteria

1. `R3.AC1` WHEN `raptor wiki build` completes, the system SHALL generate or update `.raptor/wiki/workspaces.md`.
2. `R3.AC2` WHEN `.raptor/wiki/entrypoints.md` is generated, the system SHALL group detected entrypoints by workspace.
3. `R3.AC3` The system SHALL include source references for each workspace manifest and each detected entrypoint.
4. `R3.AC4` IF no nested workspaces are detected, THEN the system SHALL state that only the root workspace was analyzed.

### R4 Local Query Quality

**User Story:** As a developer asking Raptor about a nested project, I want lexical queries to rank workspace and entrypoint pages highly, so that I get useful answers without manually browsing `.raptor/wiki`.

#### Acceptance Criteria

1. `R4.AC1` WHEN a query mentions workspace, frontend, backend, app, entrypoint, start, dev, or a detected workspace path token, the system SHALL rank matching workspace and entrypoint chunks above generic symbol inventory chunks.
2. `R4.AC2` WHEN query results include workspace or entrypoint chunks, the system SHALL return excerpts that include the relevant source path.
3. `R4.AC3` IF query results are based on `draft` or `stale` wiki pages, THEN the system SHALL include the existing non-reviewed or stale warning.

### R5 Validation And Staleness

**User Story:** As a maintainer, I want validation to understand workspace page sources, so that stale or broken workspace references are surfaced before users trust the wiki.

#### Acceptance Criteria

1. `R5.AC1` WHEN `raptor wiki validate` checks wiki pages, the system SHALL validate source references from `.raptor/wiki/workspaces.md`.
2. `R5.AC2` WHEN a workspace manifest or detected entrypoint source changes after build, the system SHALL mark the affected wiki page as stale.
3. `R5.AC3` IF a workspace source reference is deleted after build, THEN the system SHALL report the missing source during validation.

## Non-Functional Requirements

- `NFR1` Raptor SHALL keep workspace detection local and deterministic without embeddings or network access.
- `NFR2` Raptor SHALL preserve Windows path compatibility while storing wiki and index paths with forward slashes.
- `NFR3` Raptor SHALL keep the build usable on medium repositories by limiting recursive scans through the existing ignored directory and file extension rules.

## Constraints And Dependencies

- `C1` The implementation depends on Node.js built-in filesystem and path APIs only.
- `C2` The implementation must remain compatible with the existing CommonJS module structure.
- `C3` The feature must not require a Git repository; projects without `.git` must still build with `source_commit: unknown`.
- `C4` `.raptor/wiki` remains the authoritative documentation source; this feature must not introduce docs write-back as the primary workflow.

## Out Of Scope

- Embedding-based semantic search.
- MCP server integration.
- Hard approval gates for marking wiki pages reviewed.
- Full monorepo package-manager graph resolution for npm, pnpm, Yarn, Go workspaces, or Python dependency managers.
- Writing generated workspace documentation into `docs/`.
