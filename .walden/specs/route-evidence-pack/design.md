---
status: approved
approved_at: 2026-06-08T07:24:06Z
last_modified: 2026-06-08T07:24:06Z
source_requirements_approved_at: 2026-06-08T07:19:39Z
---

# Feature Design

## Overview

Raptor will add deterministic route evidence as a first-class local artifact. <!-- assumed: route extraction belongs in a new `src/routes.js` module so the current symbol and workspace modules stay focused --> During `wiki build`, Raptor will scan already-walked source files for source-text route declarations, write `.raptor/index/routes.jsonl`, generate `.raptor/wiki/routes.md`, and include route source files in validation/staleness checks.

The query layer will load routes alongside chunks and symbols, then rank matching route evidence for procedural/API questions. A new `raptor answer-pack <question> [path] --json` command will aggregate wiki results, route hits, symbol hits, bounded source snippets, confidence, and warnings for downstream skills such as a future doc-builder.

The design deliberately keeps embeddings and semantic reranking out of this increment. Route evidence and answer packs create a cleaner deterministic retrieval layer first; embeddings can later rerank or supplement the same records without changing the workflow boundary.

## Architecture

Data flow:

```text
walkDir(root)
  -> discoverWorkspaces(files, root)
  -> extractRouteRecords(files, root, workspaces)
  -> buildContext()
  -> createPages()
       -> routes.md
  -> writeIndexes()
       -> routes.jsonl
       -> chunks.jsonl
       -> symbols.jsonl
       -> links.json
  -> query()
       -> chunks + symbols + routes
  -> answerPack()
       -> query evidence + route hits + symbol hits + source snippets
```

Route extraction will be a text scanner over files selected by extension. It will not import or execute application code. Framework-specific extractors will share a normalized route record interface so query, wiki rendering, and answer-pack code do not need to know parser internals.

## Options Considered

### Option A

- Summary: Add `src/routes.js` for deterministic route extraction and `src/answerPack.js` for evidence aggregation, then integrate both through `src/wiki.js` and `bin/raptor.js`.
- Why chosen: It keeps each responsibility small, supports focused tests, preserves CommonJS style, and keeps `wiki.js` as the orchestration point rather than the parser for every framework.

### Option B

- Summary: Add route extraction directly inside `src/wiki.js`.
- Why rejected: `wiki.js` is already large and owns build/query/validation. Putting route parsers there would make route heuristics hard to test and would increase the risk of unrelated query regressions.

### Option C

- Summary: Add embeddings or a local semantic reranker first and use it to discover route-like evidence.
- Why rejected: The current problem is not semantic ranking yet; it is missing deterministic API evidence. Embeddings would add runtime, dependency, and explainability costs before route records exist.

## Simplicity And Elegance Review

- Simplest viable shape: one route extraction module, one answer-pack module, one new wiki page, one new JSONL index, and small query/build integration.
- Coupling check: `routes.js` knows source text and framework patterns; `answerPack.js` knows evidence aggregation; `wiki.js` wires those pieces into existing build/query commands.
- Future-proofing: the route record schema can later feed embeddings, doc-builder, or route coverage reports without changing page frontmatter or existing symbol index shape.

## Components And Interfaces

### `src/routes.js`

- Purpose: Extract normalized route records from local source files.
- Inputs/Outputs:
  - `extractRoutes(files, rootPath, workspaces)` returns `{ routes, warnings }`.
  - `routes[]` uses forward-slash relative paths.
  - `warnings[]` records unresolved patterns or parser limitations.
- Dependencies: Node `fs`, Node `path`.
- Requirements: `R1`, `NFR1`, `NFR2`, `NFR3`, `NFR5`, `C1`, `C2`, `C4`, `C5`

### Route Extractors

- Purpose: Keep framework-specific heuristics isolated inside `routes.js`.
- Inputs/Outputs:
  - Java Spring: class-level `@RequestMapping` prefix plus method annotations such as `@GetMapping`, `@PostMapping`, `@PutMapping`, and `@DeleteMapping`.
  - JavaScript/TypeScript Express: `app.get(...)`, `app.post(...)`, `router.get(...)`, `router.post(...)`, and equivalent `put`, `patch`, `delete`.
  - Python FastAPI/Flask: decorators such as `@app.get(...)`, `@router.post(...)`, `@app.route(..., methods=[...])`.
- Dependencies: source text only.
- Requirements: `R1`

### `src/wiki.js` Build Integration

- Purpose: Include route evidence in wiki build output and validation.
- Inputs/Outputs:
  - Adds `context.routes` and `context.routeWarnings`.
  - Writes `.raptor/index/routes.jsonl`.
  - Renders `.raptor/wiki/routes.md`.
  - Adds route source paths to page frontmatter and links.
- Dependencies: `extractRoutes()`, existing page/index helpers.
- Requirements: `R2`, `R5`, `C3`

### Query Integration

- Purpose: Make route evidence visible and ranked for procedural/API questions.
- Inputs/Outputs:
  - Loads `.raptor/index/routes.jsonl` when present.
  - Scores route records against expanded query terms.
  - Adds `routes` to JSON query output.
  - Human-readable query output displays best route source before generic sources when route evidence wins.
- Dependencies: existing `tokenize()`, query expansion, chunk scoring, symbol scoring.
- Requirements: `R3`, `R5`

### `src/answerPack.js`

- Purpose: Return a bounded evidence bundle for agents and future doc-builder workflows.
- Inputs/Outputs:
  - `answerPack(argv)` parses question/path/json flags and returns the standard JSON envelope through `output()`.
  - Evidence includes `question`, `path`, `wiki_results`, `symbols`, `routes`, `sources`, `confidence`, and `warnings`.
  - `sources[]` includes file path and bounded snippets selected around matched terms.
- Dependencies: route/symbol/chunk indexes, local filesystem reads, existing output helpers.
- Requirements: `R4`, `NFR4`, `C4`

### CLI Dispatcher

- Purpose: Expose answer-pack as a top-level command.
- Inputs/Outputs:
  - Adds `answer-pack <question> [path] --json` to `bin/raptor.js`.
  - Updates help output.
- Dependencies: `src/answerPack.js`.
- Requirements: `R4`

### Raptor Skill

- Purpose: Teach agents to use answer-pack as the default source-grounded context bundle.
- Inputs/Outputs:
  - Updates `skill/raptor/SKILL.md` procedural workflow.
  - Instructs agents to cite route files when present and state low confidence limitations.
- Dependencies: generated answer-pack schema.
- Requirements: `R6`

## Data Models

Route record:

```json
{
  "method": "GET",
  "route": "/api/user",
  "path": "documentale/repository/src/main/java/com/example/UserController.java",
  "line": 12,
  "handler": "getUser",
  "framework": "spring",
  "workspace": "documentale/repository",
  "confidence": "high",
  "reason": "class @RequestMapping prefix plus method @GetMapping"
}
```

Route index:

```text
.raptor/index/routes.jsonl
```

Each line is one route record JSON object.

Answer-pack JSON result:

```json
{
  "question": "Come si crea un utenza?",
  "path": "C:/repo",
  "confidence": "medium",
  "wiki_results": [],
  "routes": [],
  "symbols": [],
  "sources": [
    {
      "path": "src/server/users.js",
      "snippets": [
        {
          "line_start": 10,
          "line_end": 35,
          "text": "..."
        }
      ]
    }
  ],
  "warnings": []
}
```

Confidence rules:

- `high`: route hits and source snippets both match query terms.
- `medium`: symbol or wiki hits exist, but no route hit confirms the workflow.
- `low`: no direct route or symbol evidence is found.

Snippet limits:

- maximum 5 source files;
- maximum 2 snippets per source file;
- maximum 40 lines per snippet;
- preserve relative paths and line numbers.

## Error Handling

- Missing wiki index: `answer-pack` returns the same style of error as `query`, instructing the user to run `raptor wiki build`.
- Missing routes index: query and answer-pack continue with empty route hits and include no fatal error.
- Unresolved route expressions: extractor returns a `low` confidence route when method/path are partially known; if resolution would require execution, it skips resolution and emits a warning.
- Missing source file after build: existing wiki validation reports missing `routes.md` sources.
- Malformed JSONL line: answer-pack and query skip invalid route lines and include a warning instead of failing the whole command.

## Security Considerations

Route extraction and answer-pack must only read local files. They must not execute application code, shell commands, package scripts, framework CLIs, dependency manager commands, or network requests. This is especially important for route discovery because some frameworks allow dynamic route registration; those cases are intentionally marked low confidence or skipped.

## Failure Modes And Tradeoffs

- Failure mode: A framework uses dynamic route construction or imported constants for route paths.
- Mitigation: Keep partial evidence with `confidence: low` when possible and warn when execution would be required.
- Tradeoff: Some real routes will be incomplete until AST or framework-specific parsers are added.

- Failure mode: Java class-level and method-level annotations combine paths in unusual forms.
- Mitigation: Support common literal string forms first and include line numbers so agents can inspect source context.
- Tradeoff: Complex annotation arrays may be simplified or low confidence.

- Failure mode: Query boosts make route pages outrank more relevant symbol pages for non-API questions.
- Mitigation: Apply strong route boosts only for procedural/API terms and direct route/path matches.
- Tradeoff: Some ambiguous questions may still surface routes early; JSON output keeps symbols and wiki results for fallback.

- Failure mode: Answer-pack snippets omit important caller context.
- Mitigation: Prefer route files first, include symbol files second, and keep source limits explicit.
- Tradeoff: Caller graph analysis remains a future extension.

## Testing Strategy

- Unit tests for Java Spring route extraction with class and method annotations.
- Unit tests for Express route extraction from JavaScript and TypeScript files.
- Unit tests for FastAPI/Flask route decorator extraction.
- Unit tests for low-confidence unresolved route cases.
- Integration tests that `wiki build` writes `routes.jsonl` and `routes.md`.
- Validation tests that route source changes mark `routes.md` stale and deleted sources are reported.
- Query tests that procedural/API questions rank route evidence above `symbols.md`.
- Answer-pack tests for confidence, route-first source ordering, snippet bounds, and missing index errors.
- Skill text regression checks through direct file assertions where practical.

## Verification Plan

- Requirement proof: Fixture repos will include Spring, Express, and FastAPI/Flask route examples plus a no-routes fixture.
- Test evidence: `npm test` will cover extraction, build artifacts, validation, query ranking, and answer-pack output.
- Operational evidence: Manual smoke test on `avepa` should surface `UserController.java` and `/user` route evidence for "Come si crea un utenza?" and preserve the conclusion that creation is external when no POST user route is found.

## Requirement Coverage

| Requirement | Covered By |
| --- | --- |
| `R1` | `src/routes.js` extractors and route record schema |
| `R2` | `src/wiki.js` build integration, `routes.jsonl`, and `routes.md` |
| `R3` | query route scoring and route JSON/human output |
| `R4` | `src/answerPack.js` and CLI `answer-pack` command |
| `R5` | route page frontmatter sources and existing validate/status flows |
| `R6` | `skill/raptor/SKILL.md` answer-pack workflow updates |
| `NFR1` | source-text extraction without embeddings, model calls, or network access |
| `NFR2` | forward-slash relative path model |
| `NFR3` | no execution policy in route extraction and security tests by design |
| `NFR4` | answer-pack source and snippet limits |
| `NFR5` | CommonJS modules and Node built-in APIs |
| `C1` | Node `fs` and `path` only |
| `C2` | integration with existing `wiki`, `symbols`, and `workspaces` modules |
| `C3` | route wiki page as `.raptor/wiki` authority |
| `C4` | path-based build/query/answer-pack without Git dependency |
| `C5` | heuristic source-text route extraction |
