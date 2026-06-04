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
4. Identify the target codebase path before build or query:
   - if the user named or implied a path, use that path explicitly;
   - otherwise use the current working directory and report it to the user;
   - never assume the parent workspace is the app codebase when it contains multiple repositories.

### Target Path Discipline

Always run Raptor commands against the intended codebase path, not against an arbitrary parent directory.

For a target path:

```bash
raptor wiki build "<target-path>" --json
raptor wiki validate "<target-path>" --json
raptor query "<question>" "<target-path>" --json
```

If the user asks about a project such as `avepa`, but the current directory is a parent workspace such as `Codebase`, ask the user for the target path or use the known project path. Do not build/query the parent workspace.

After each query, sanity-check the returned `path`, `result.symbols[].path`, and `result.results[].sources`:

- If most sources point to the Raptor tool itself (`raptor/bin`, `raptor/src`, `raptor/skill`, `.raptor/wiki` for the wrong project), stop and say the query ran against the wrong target path.
- Then rerun the build/query with the correct target path if it is known.
- Do not answer a domain question from Raptor's own implementation files unless the user is asking about Raptor itself.

---

## Phase 2 — Wiki Build

Raptor's authoritative documentation source is `.raptor/wiki`, not `docs/`.

For local projects:

1. Run `raptor wiki init "<target-path>" --json` if `.raptor/wiki` does not exist.
2. Run `raptor wiki build "<target-path>" --json`.
3. Run `raptor wiki validate "<target-path>" --json`.
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
- If the user approves the generated wiki, run `raptor wiki review --all "<target-path>" --json` and then `raptor wiki status "<target-path>" --json`.
- Do not copy wiki content into `docs/` in this increment unless the user explicitly asks for README/llms exports.

---

## Phase 4 — Query

When the user asks a codebase question, query the wiki first.

For quick lookup questions, use the human-readable output:

```bash
raptor query "<question>" "<target-path>"
```

Use non-JSON output for user-facing answers because it surfaces the best match and source paths directly.

For procedural, diagnostic, or implementation questions, use JSON output and inspect sources before answering. Procedural questions often start with words such as "how", "come", "where", "dove", "why", "perche", "what calls", "come si crea", "come funziona", or "dove viene gestito".

```bash
raptor query "<question>" "<target-path>" --json
```

Use the returned pages, excerpts, symbols, sources, and warnings as grounded context. If `.raptor/index/chunks.jsonl` is missing, run `raptor wiki build --json` first.

### Source-Grounded Answer Workflow

For questions such as "Come si crea un'utenza?", do not stop at the Raptor query result. Use this workflow:

1. Run `raptor query "<question>" "<target-path>" --json`.
2. Read the top returned wiki page under `.raptor/wiki/`.
3. Read the top 3-5 source paths from `result.symbols[].path` and `result.results[].sources`, preferring symbol paths first.
4. If the top source is a service, controller, route, command, or component, search nearby files for callers, route declarations, imports, or API endpoints before answering.
5. If the inspected files only show frontend authentication, token handling, roles, or an external identity provider, run a second Raptor query before answering:
   - `raptor query "backend endpoint create user account role keycloak" "<target-path>" --json`
   - `raptor query "API create user account role" "<target-path>" --json`
   - use the user's domain words too, for example `utenza`, `utente`, `ruolo`, `profilo`.
6. Read any backend/controller/service/config files returned by the second query, especially files that mention `POST`, `create`, `user`, `role`, `Keycloak`, `OAuth`, `issuer`, or route decorators.
7. Answer in the user's language with:
   - the shortest procedural explanation that fits the evidence;
   - the key files and symbols involved;
   - any endpoint, command, method, or component names found;
   - an explicit caveat if Raptor found likely files but the exact workflow is not fully visible.

Never claim a workflow is complete unless the inspected files show the full path from entrypoint/caller to implementation. If the result only identifies a likely service or symbol, say that clearly and suggest the next file to inspect.

### Required Answer Shape

For source-grounded answers, include these sections:

```text
Risposta:
[direct answer]

Procedura:
1. [step]
2. [step]

File verificati:
- path/to/file.ext — [what was verified]

Evidenza:
- [method, endpoint, config value, role name, or symbol that supports the answer]

Limiti:
- [what was not visible or still needs backend/provider verification]
```

If no backend endpoint is found after the second query, say "Non ho trovato una API backend interna per creare utenze nei file verificati" instead of implying the endpoint does not exist globally.

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
