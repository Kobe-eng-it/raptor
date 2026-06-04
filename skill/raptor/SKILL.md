---
name: raptor
description: "Builds and queries a local Raptor wiki for a codebase. Use when the user asks to run raptor, document a project, build a codebase wiki, or ask questions about local codebase documentation."
metadata:
  short-description: Codebase documentation generator
---

# Raptor

Build, review, and query a local codebase wiki. Reply in the user's preferred language.

## When To Use

- User wants to generate or update a local codebase wiki
- User wants to ask questions about the codebase through Raptor
- User wants README/llms exports derived from `.raptor/wiki`
- User mentions "raptor", "run raptor", "generate docs", "document this project"

---

## Prerequisites

The `raptor` CLI must be installed and in PATH. Run `raptor doctor --json` first.

If `raptor` is not available, inform the user and show the install instructions:

```
npm install -g raptor-docgen
```

Or without global install:
```
npx raptor-docgen doctor
```

If the doctor check fails on required items (`node`, `writePermission`), stop and explain what needs to be fixed.

---

## Phase 1 — Bootstrap

1. Run `raptor doctor --json` to check prerequisites.
2. Parse the JSON result. If `ok` is `false` for any required check, report which checks failed and stop.
3. Show the user a brief summary of the environment (git available, in a git repo or not).

---

## Phase 2 — Wiki Build

Raptor's authoritative documentation source is `.raptor/wiki`, not `docs/`.

For local projects:

1. Run `raptor wiki init --json` if `.raptor/wiki` does not exist.
2. Run `raptor wiki build --json`.
3. Run `raptor wiki validate --json`.
4. Present the generated wiki pages and validation warnings/errors for human review.

The build creates:

- `.raptor/wiki/*.md` authoritative wiki pages with `draft`, `reviewed`, or `stale` frontmatter.
- `.raptor/index/chunks.jsonl` lexical search chunks.
- `.raptor/index/symbols.jsonl` extracted source symbols.
- `.raptor/index/links.json` wiki and source reference links.
- `.raptor/manifest.json` schema, build time, and source commit metadata.
- `llms.txt` and `llms-full.txt` as export indexes derived from the wiki. Treat these as convenience files, not a guaranteed LLM provider standard.

---

## Phase 3 — Review Gate

After validation, present a concise table:

| Wiki Page | Status | Notes |
|-----------|--------|-------|
| `.raptor/wiki/overview.md` | draft/reviewed/stale | validation notes |
| `.raptor/wiki/architecture.md` | draft/reviewed/stale | validation notes |
| `.raptor/wiki/workspaces.md` | draft/reviewed/stale | validation notes |
| `.raptor/wiki/entrypoints.md` | draft/reviewed/stale | validation notes |
| `.raptor/wiki/symbols.md` | draft/reviewed/stale | validation notes |
| `.raptor/wiki/documentation.md` | draft/reviewed/stale | validation notes |

Raptor uses soft gates:

- Queries may run against `draft` or `stale` pages.
- Always disclose when query results include non-reviewed or stale pages.
- If the user approves the generated wiki, run `raptor wiki review --all --json` and then `raptor wiki status --json`.
- Do not copy wiki content into `docs/` in this increment unless the user explicitly asks for README/llms exports.

---

## Phase 4 — Query

When the user asks a codebase question, query the wiki first:

```bash
raptor query "<question>"
```

Use non-JSON output for user-facing answers because it surfaces the best match and source paths directly.

Use JSON output when the agent needs structured grounding:

```bash
raptor query "<question>" --json
```

Use the returned pages, excerpts, symbols, sources, and warnings as grounded context. If `.raptor/index/chunks.jsonl` is missing, run `raptor wiki build --json` first.

For procedural questions such as "Come si crea un'utenza?", query Raptor first, then inspect the returned wiki page and source paths if the excerpt is not enough to answer. Answer in the user's language and cite the relevant wiki page plus source file paths.

---

## Phase 5 — Report

After all documents are written, show a final summary:

```
✅ Raptor wiki complete

Generated:
  • .raptor/wiki/*.md
  • .raptor/index/chunks.jsonl
  • .raptor/index/symbols.jsonl
  • .raptor/index/links.json
  • .raptor/manifest.json
  • llms.txt
  • llms-full.txt

Validation: passed / warnings / failed
```

If any `raptor write` command failed, report the error clearly.

---

## Error Handling

- **CLI not found**: Show install instructions, stop.
- **Path does not exist**: Confirm the path with the user, stop.
- **Write permission denied**: Report the error from doctor, stop.
- **Empty analysis** (0 files found): Warn the user the directory may be empty or fully excluded.
- **Index missing for query**: Run `raptor wiki build --json` first.
- **No git repo**: Inform the user incremental update is unavailable; proceed with full regeneration.
- **Stale wiki pages**: Run `raptor wiki build --json`, then `raptor wiki validate --json`.
