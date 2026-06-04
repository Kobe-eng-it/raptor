---
status: approved
approved_at: 2026-06-04T13:32:49Z
last_modified: 2026-06-04T13:32:49Z
source_requirements_approved_at: 2026-06-04T13:30:04Z
---

# Feature Design

## Overview

Raptor will add deterministic nested workspace discovery before wiki page generation. <!-- assumed: workspace analysis belongs in a new `src/workspaces.js` module so `util.js` remains a shared helper layer rather than a domain parser --> The build context will include root and nested workspace records, each with manifest metadata, detected entrypoints, parse warnings, and skipped references. `wiki.js` will render a new `workspaces.md` page, enrich `entrypoints.md`, include workspace sources in page frontmatter, and adjust query ranking so workspace and entrypoint answers outrank generic symbol chunks.

The design keeps the implementation local, dependency-free, and pragmatic. It does not attempt full package-manager graph resolution; it detects manifest roots and conventional launch files that produce useful answers for projects like `frontend/gui`.

## Architecture

Data flow:

```text
walkDir(root)
  -> discoverWorkspaces(files, root)
  -> detectWorkspaceEntrypoints(workspace, files)
  -> buildContext()
  -> createPages()
       -> workspaces.md
       -> entrypoints.md grouped by workspace
  -> createChunks()/createLinks()
  -> query() ranking boost for workspace and entrypoint chunks
```

`src/workspaces.js` will consume the already-walked file list from `buildContext()` to avoid a second recursive scan. It will use forward-slash relative paths internally and only convert to platform paths when reading files.

## Options Considered

### Option A

- Summary: Add `src/workspaces.js` with exported discovery and entrypoint helpers, then integrate those helpers into `src/wiki.js`.
- Why chosen: It keeps parsing logic isolated, supports direct unit tests, and avoids turning `wiki.js` or `util.js` into a catch-all module.

### Option B

- Summary: Extend `getEntryPoints()` in `src/util.js` to scan nested folders and return richer records.
- Why rejected: `getEntryPoints()` currently returns simple path strings. Expanding it into workspace metadata would create a hidden contract change for existing callers and make util-level helpers domain-heavy.

### Option C

- Summary: Add a full workspace graph resolver for npm, pnpm, Yarn, Python, and Go workspaces.
- Why rejected: It exceeds this increment. The requirements explicitly exclude full monorepo package-manager graph resolution.

## Simplicity And Elegance Review

- Simplest viable shape: one new workspace module, one new wiki page, and small integration points in `buildContext()`, `createPages()`, and `query()`.
- Coupling check: `workspaces.js` depends only on Node `fs`/`path` and receives file lists from callers; it does not import `wiki.js`.
- Future-proofing: workspace records can later grow package-manager graph fields without changing existing wiki page frontmatter or query output shape.

## Components And Interfaces

### `src/workspaces.js`

- Purpose: Discover root and nested workspace records and derive entrypoint candidates.
- Inputs/Outputs:
  - `discoverWorkspaces(files, rootPath)` returns `{ workspaces, warnings }`.
  - `workspaces[]` includes `root`, `manifest`, `manifestType`, `name`, `language`, `entrypoints`, `warnings`, and `skippedEntrypoints`.
  - `entrypoints[]` includes `path`, `source`, `kind`, and `reason`.
- Dependencies: Node `fs`, Node `path`.
- Requirements: `R1`, `R2`, `NFR1`, `NFR2`, `NFR3`, `C1`, `C2`, `C3`

### `src/wiki.js` Build Context

- Purpose: Include workspace analysis in the context used by page generation and index creation.
- Inputs/Outputs:
  - Adds `context.workspaces` and `context.workspaceWarnings`.
  - Adds workspace manifest and entrypoint paths to relevant page source lists.
- Dependencies: `walkDir`, `getPackageInfo`, `getEntryPoints`, `discoverWorkspaces`.
- Requirements: `R1`, `R2`, `R3`, `R5`, `C4`

### Wiki Page Rendering

- Purpose: Render `.raptor/wiki/workspaces.md` and enhance `.raptor/wiki/entrypoints.md`.
- Inputs/Outputs:
  - `workspaces.md` lists root/nested workspace records, manifest paths, entrypoints, warnings, and skipped references.
  - `entrypoints.md` groups launch files by workspace and links each source path.
- Dependencies: existing `writePage()`, `makeMeta()`, and source hash handling.
- Requirements: `R3`, `R5`, `NFR2`, `C4`

### Query Ranking

- Purpose: Prefer workspace and entrypoint chunks for workspace/startup questions.
- Inputs/Outputs:
  - Adds query boosts for `workspaces.md`, `entrypoints.md`, workspace path tokens, and launch-related terms.
  - Keeps existing warnings for draft or stale pages.
- Dependencies: existing `tokenize()` and chunk scoring.
- Requirements: `R4`

## Data Models

Workspace record:

```json
{
  "root": "frontend/gui",
  "manifest": "frontend/gui/package.json",
  "manifestType": "package.json",
  "name": "avepa-gui",
  "language": "JavaScript",
  "entrypoints": [
    {
      "path": "frontend/gui/src/main.tsx",
      "source": "package-script",
      "kind": "frontend",
      "reason": "script dev references Vite and conventional src/main.tsx exists"
    }
  ],
  "warnings": [],
  "skippedEntrypoints": []
}
```

Build context additions:

```json
{
  "workspaces": [],
  "workspaceWarnings": []
}
```

The root workspace will be included even when no nested workspace exists. Nested workspace roots are discovered by manifest files under subdirectories, excluding ignored directories already handled by `walkDir()`.

## Error Handling

- Invalid `package.json`: include workspace with `manifestType: "package.json"`, omit package name, and add a parse warning.
- Missing derived entrypoint: omit from `entrypoints`, add a skipped reference with reason.
- No nested workspace: render a root-only statement in `workspaces.md`.
- Missing source after build: existing validation catches missing sources through frontmatter `sources`; `workspaces.md` will include all workspace manifest and entrypoint paths in `sources`.

## Security Considerations

Workspace detection reads local text manifests and path metadata only. It must not execute package scripts, config files, shell commands, or dependency manager commands.

## Failure Modes And Tradeoffs

- Failure mode: A script references an entrypoint through a custom build tool pattern.
- Mitigation: Use script text as a hint but only include existing conventional source files.
- Tradeoff: Some real entrypoints may remain undetected until additional heuristics are added.

- Failure mode: A repository has many nested package manifests in examples or fixtures.
- Mitigation: Reuse existing ignored directories and keep workspace records lightweight.
- Tradeoff: Raptor may include example workspaces if they are not in ignored paths.

- Failure mode: Query terms are too generic.
- Mitigation: Boost only specific workspace and launch terms while keeping existing score logic.
- Tradeoff: Some generic "app" queries may favor entrypoints more strongly than symbol inventory.

## Testing Strategy

- Unit tests for workspace discovery from nested `package.json`.
- Unit tests for invalid manifest parse warnings.
- Unit tests for entrypoint detection from `main`, `bin`, scripts, frontend conventional files, Python files, and Go `cmd/*/main.go`.
- Integration test using a fixture with `frontend/gui/package.json` and `frontend/gui/src/main.tsx`.
- Regression test that `raptor query "where is the frontend app entrypoint?"` ranks `entrypoints.md` or `workspaces.md` above `symbols.md`.
- Validation test that changing a workspace manifest marks `workspaces.md` stale.

## Verification Plan

- Requirement proof: The fixture repo will include root-only and nested workspace layouts, with assertions against generated wiki pages and query output.
- Test evidence: `npm test` will cover discovery, page generation, validation, and ranking.
- Operational evidence: Manual smoke test in a real nested repo such as `avepa` using `raptor wiki build --json`, `raptor wiki validate --json`, and `raptor query "where is the frontend app entrypoint?" --json`.

## Requirement Coverage

| Requirement | Covered By |
| --- | --- |
| `R1` | `src/workspaces.js` discovery records and build context integration |
| `R2` | entrypoint heuristics in `src/workspaces.js` |
| `R3` | `workspaces.md` rendering and grouped `entrypoints.md` rendering |
| `R4` | query ranking boosts and excerpt behavior |
| `R5` | page source frontmatter and existing validation source checks |
| `NFR1` | no network, embeddings, or external command execution |
| `NFR2` | forward-slash relative path model and path conversion at filesystem boundary |
| `NFR3` | reuse of existing `walkDir()` ignore behavior and single-pass file list |
| `C1` | Node built-in APIs only |
| `C2` | CommonJS module exports in `src/workspaces.js` |
| `C3` | build context works with `source_commit: unknown` |
| `C4` | wiki-only output path with no docs write-back |
