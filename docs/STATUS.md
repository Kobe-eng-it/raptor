# Raptor Status And Direction

Last updated: 2026-06-04

## Original Goal

Raptor is being built as a local, queryable codebase wiki for agent workflows.

The first target is not a full platform. The first target is a deterministic CLI that creates `.raptor/wiki` as the authoritative local knowledge base, builds lexical indexes without embeddings, validates/reviews wiki pages, and lets GitHub Copilot CLI or another agent answer questions by grounding itself in the wiki and source files.

## Current Product Boundary

Raptor CLI is the deterministic layer:

- build and validate `.raptor/wiki`;
- index Markdown chunks and extracted symbols;
- detect workspaces and entrypoints;
- answer local lexical queries;
- expose review state through soft gates.

The agent skill is the orchestration layer:

- run `raptor doctor`;
- build/review/query the wiki;
- read returned source files;
- synthesize user-facing explanations;
- cite verified files and caveats.

Raptor does not currently implement embeddings, MCP, provider-specific LLM integrations, plugin marketplace behavior, or hard approval gates.

## Implemented

### Wiki Core

- `raptor wiki init [path] [--json]`
- `raptor wiki build [path] [--json]`
- `raptor wiki validate [path] [--json]`
- `raptor wiki status [path] [--json]`
- `raptor wiki review [page|--all] [path] [--json]`
- `raptor query <question> [path] [--json]`

Generated local storage:

- `.raptor/wiki/*.md`
- `.raptor/index/chunks.jsonl`
- `.raptor/index/symbols.jsonl`
- `.raptor/index/links.json`
- `.raptor/manifest.json`
- `llms.txt`
- `llms-full.txt`

### Codebase Analysis

- Windows-safe file walking without recursive spread stack overflow.
- Nested workspace detection from manifests such as `package.json`.
- Entrypoint detection grouped by workspace.
- Symbol extraction for JavaScript, TypeScript, CommonJS, Python, and Go in a pragmatic regex-based form.
- Stale source detection through source hashes.

### Query Behavior

- Human-readable query output for direct CLI use.
- JSON query output for agents.
- Lexical scoring over page title, heading, page path, source paths, symbols, and chunk text.
- Startup/entrypoint query boosts.
- Italian/procedural query support for account/user questions such as `Come si crea un utenza?`.
- Source path cleanup to avoid truncated paths from excerpts.
- Symbol ranking so exact symbol matches are preferred in answers.

### Raptor Skill

The `skill/raptor/SKILL.md` workflow now instructs agents to:

- identify the target codebase path before build/query;
- run Raptor commands with explicit target path;
- stop if results point to Raptor's own implementation instead of the intended app;
- use JSON output for procedural/diagnostic questions;
- read top wiki/source files before answering;
- run a second backend/API query when frontend files only show auth/token/roles;
- answer with `Risposta`, `Procedura`, `File verificati`, `Evidenza`, and `Limiti`.

## Test Evidence

Automated tests currently cover:

- frontmatter round trips;
- wiki build artifacts;
- nested workspace pages;
- stale and missing source validation;
- query ranking for CLI/frontend/startup questions;
- review status and warning refresh;
- human-readable query output;
- Italian procedural account queries;
- path truncation regression;
- wide directory walking;
- workspace discovery and explicit package bin entrypoints.

Current passing suite:

```text
npm test
# 18/18 pass
```

## Avepa Manual Test Findings

Target repo used for manual testing:

```text
C:\Users\tomsalvino\Desktop\Progetti\avepa
```

Useful command flow:

```powershell
raptor wiki build --json
raptor wiki review --all --json
raptor query "Come si crea un utenza?"
```

Observed result:

- Raptor correctly identified `documentale/frontend/gui/src/app/user.service.ts` as the top symbol/source for `Come si crea un utenza?`.
- Copilot CLI, when using the skill from the correct directory/target path, read frontend auth/service files and then searched backend files.
- The grounded answer found:
  - frontend auth redirects to OAuth2/IdP;
  - frontend reads roles through `GET /user`;
  - backend `UserController.java` exposes `/user` as read-oriented, not user creation;
  - no verified internal `POST /users` endpoint was found in inspected files;
  - user creation appears delegated to WSO2/Identity Provider.

Important lesson:

- If Copilot runs Raptor in the parent workspace `Codebase` instead of `avepa`, the query indexes Raptor itself and produces a wrong answer.
- The skill now explicitly enforces target path discipline to prevent this.

## Current Quality Bar

Raptor is usable as a local wiki/search tool and as a Copilot grounding helper.

It is not yet a complete answer engine. The CLI finds relevant wiki pages, symbols, and source paths. The agent must still read files and synthesize the final explanation.

This split is intentional for now:

- CLI remains deterministic and testable;
- agent handles interpretation and language.

## Next Development Options

### 1. Answer Pack / Evidence Pack

Add a command that returns a richer context bundle for agents, for example:

```powershell
raptor answer-pack "Come si crea un utenza?" <path> --json
```

Possible output:

- top wiki page;
- top symbols;
- top source files;
- nearby callers/imports/routes;
- relevant snippets;
- warnings and confidence.

This would reduce how much Copilot has to discover manually after `raptor query`.

### 2. Better Procedural Query Expansion

Improve multilingual/domain query expansion beyond the current minimal Italian synonyms:

- `utenza`, `utente`, `ruolo`, `profilo`;
- `crea`, `aggiunge`, `registra`;
- `endpoint`, `controller`, `service`, `route`;
- auth/provider terms such as `OAuth`, `OIDC`, `Keycloak`, `WSO2`.

This should remain deterministic and covered by tests.

### 3. Backend Route Detection

Extend source analysis to detect backend routes/controllers:

- Java Spring annotations: `@RequestMapping`, `@GetMapping`, `@PostMapping`;
- Express routes;
- FastAPI decorators;
- Go HTTP routers.

Store route rows in a new index such as:

```text
.raptor/index/routes.jsonl
```

Then query can answer user/account/API questions with stronger evidence.

### 4. Review And Confidence Improvements

Improve confidence scoring:

- `high` when source files and routes confirm the workflow;
- `medium` when only service/symbol files are found;
- `low` when query finds only generic docs or symbols.

Expose this in both `raptor query` and the skill response.

### 5. Packaging / Distribution

Decide how users update the skill:

- copy from repo to `~/.copilot/skills`;
- install from npm package;
- install from a plugin/marketplace layout if supported.

Document the exact update flow in README.

## Suggested Immediate Next Step

Implement `routes.jsonl` and route/controller detection first.

Reason:

- The `avepa` test showed the biggest remaining weakness is proving backend/API presence or absence.
- Route detection is deterministic and testable.
- It makes future procedural answers much more grounded without requiring embeddings or an LLM inside the CLI.

Proposed first route targets:

- Java Spring: `@RequestMapping`, `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`;
- TypeScript/JavaScript Express: `.get`, `.post`, `.put`, `.delete`;
- Python FastAPI/Flask decorators.

## Useful Recent Commits

- `86c17ae feat(wiki): add local wiki core`
- `d01d684 fix(wiki): avoid stack overflow in directory walk`
- `2c3ba78 feat(workspaces): detect nested entrypoints`
- `dc896b2 feat(wiki): add review command`
- `02d86fb feat(query): support Italian procedural questions`
- `26d2ac4 fix(query): avoid truncated source paths`
- `b7ce46f docs(skill): guide source-grounded answers`
- `46042b7 docs(skill): require verified procedural answers`
- `2dd5097 docs(skill): enforce target codebase path`

