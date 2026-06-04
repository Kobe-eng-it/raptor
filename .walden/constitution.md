# Project Constitution

This file captures stable project-wide context that applies across all features. It is optional and does not participate in the approval workflow.

## Project Summary

Raptor is a local codebase wiki and query CLI for developer agents such as GitHub Copilot CLI, Claude Code, and Cursor. Its core value is to build `.raptor/wiki` as an authoritative, reviewable Markdown knowledge base and answer codebase questions through deterministic local indexes.

## Tech Stack

- Node.js >= 18
- JavaScript CommonJS modules
- Markdown wiki pages
- JSON and JSONL local indexes
- Git metadata when available, with filesystem fallback for sandboxed Windows environments
- Node's built-in test APIs executed through `node test/wiki.test.js`

## Conventions

- CLI entrypoint lives in `bin/raptor.js`.
- Production modules live in `src/`.
- Raptor agent skill lives in `skill/raptor/SKILL.md`.
- Tests live in `test/`.
- Generated wiki authority lives in `.raptor/wiki`.
- Search indexes live in `.raptor/index`.
- Use CommonJS, ASCII text, and minimal dependencies.
- Use conventional commits for repository history.

## Sanity Checks

```bash
npm test
raptor wiki build --json
raptor wiki validate --json
```

## Key Files

- `bin/raptor.js`: CLI command dispatcher.
- `src/wiki.js`: wiki init/build/validate/status/query implementation.
- `src/util.js`: file walking, language detection, framework hints, entrypoint detection.
- `src/symbols.js`: pragmatic symbol extraction for CommonJS, ESM, TypeScript, Python, and Go.
- `src/git.js`: Git command helpers and filesystem fallback.
- `test/wiki.test.js`: core wiki regression tests.
- `skill/raptor/SKILL.md`: agent workflow for Raptor.
- `package.json`: package metadata, CLI bin, and test script.

## Hard Rules

- `.raptor/wiki` is the authoritative documentation source for the current increment.
- Queries must work locally without embeddings.
- Do not add MCP server, plugin marketplace, or hard approval gates unless explicitly scoped.
- Preserve Windows compatibility and avoid shell-dependent command execution where possible.
- Generated pages may stay `draft`; soft gates must disclose draft or stale sources in query output.
