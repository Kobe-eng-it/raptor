---
name: raptor
description: "Generates comprehensive documentation for a codebase: README.md, docs/ARCHITECTURE.md, docs/api.md, docs/docstrings.md, and llms.txt. Use when the user asks to document a project, generate docs, run raptor, or mentions codebase documentation."
metadata:
  short-description: Codebase documentation generator
---

# Raptor

Generate comprehensive, structured documentation for any codebase. Reply in the user's preferred language.

## When To Use

- User wants to generate or update project documentation
- User wants a README, architecture doc, API reference, or llms.txt
- User mentions "raptor", "generate docs", "document this project"

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

## Phase 2 — Source

Ask the user: **local project (current directory) or a GitHub repository URL?**

### Local mode
Run `raptor analyze --json` in the project root.
If the user wants deeper analysis (explicit request or project has > 50 files), run `raptor analyze --deep --json`.

### GitHub mode
Use the available GitHub MCP tools:
- Use `github-mcp-server-get_file_contents` to fetch the repo root and key files
- Use `github-mcp-server-search_code` to find exported functions, routes, types
- Build the analysis manually from MCP results
- Note to the user that in GitHub mode, docs will be generated in the chat (no write-back to the repo). If they want to write files, they must clone the repo and run in local mode.

---

## Phase 3 — Analysis & Plan

After analysis, present a **summary table** to the user:

| Doc | Output Path | Status |
|-----|-------------|--------|
| README | `README.md` | ✅ exists / ⬜ new |
| Architecture | `docs/ARCHITECTURE.md` | ... |
| API Reference | `docs/api.md` | ... |
| Docstrings | `docs/docstrings.md` | ... |
| LLM Index | `llms.txt` | ... |

Then ask:
1. **Language**: What language should the documentation be written in? (Detect from context if not specified)
2. **Mode**: For existing docs — overwrite entirely, or merge (update only changed sections)?
   - If git is available, suggest merge mode and show which source files changed since last commit (`raptor diff --json`)
   - If no git, suggest full regeneration

Wait for user confirmation before proceeding.

---

## Phase 4 — Generate

Generate documents one at a time, in this order:
1. `README.md`
2. `docs/ARCHITECTURE.md`
3. `docs/api.md`
4. `docs/docstrings.md`
5. `llms.txt` (always last — it indexes the other docs)

For each document, follow the template below. After generating, pipe the content into:
- `echo "<content>" | raptor write --file <path>` for new files
- `echo "<content>" | raptor write --file <path> --merge` when updating existing files with raptor markers

Use PowerShell heredoc syntax on Windows:
```powershell
@'
<document content here>
'@ | raptor write --file README.md --merge
```

---

### README.md template

```
<!-- raptor:start:header -->
# <project-name>

> <one-sentence description>
<!-- raptor:end:header -->

<!-- raptor:start:overview -->
## Overview

<2-3 paragraphs describing what the project does, its purpose, and key features>
<!-- raptor:end:overview -->

<!-- raptor:start:install -->
## Installation

<install instructions derived from package.json scripts, go.mod, Cargo.toml, etc.>
<!-- raptor:end:install -->

<!-- raptor:start:usage -->
## Usage

<basic usage examples>
<!-- raptor:end:usage -->

<!-- raptor:start:structure -->
## Project Structure

<key directories and what they contain>
<!-- raptor:end:structure -->

<!-- raptor:start:license -->
## License

<license info from package.json or LICENSE file if present>
<!-- raptor:end:license -->
```

---

### docs/ARCHITECTURE.md template

```
<!-- raptor:start:overview -->
# Architecture

## Overview

<high-level description of the system: what it does, core responsibilities>
<!-- raptor:end:overview -->

<!-- raptor:start:stack -->
## Tech Stack

<language, framework, key libraries inferred from analysis>
<!-- raptor:end:stack -->

<!-- raptor:start:structure -->
## Module Structure

<describe each top-level directory and its role>
<!-- raptor:end:structure -->

<!-- raptor:start:dataflow -->
## Data Flow

<describe how data moves through the system: input → processing → output>
<!-- raptor:end:dataflow -->

<!-- raptor:start:decisions -->
## Key Design Decisions

<notable architectural choices and tradeoffs>
<!-- raptor:end:decisions -->
```

---

### docs/api.md template

```
<!-- raptor:start:overview -->
# API Reference

<brief intro>
<!-- raptor:end:overview -->

<!-- raptor:start:routes -->
## HTTP Routes

<table or list of routes found in the codebase: METHOD /path — description>
<!-- raptor:end:routes -->

<!-- raptor:start:exports -->
## Exported Functions & Types

<for each file with exports: file path as H3, then list of exported symbols with signatures and descriptions>
<!-- raptor:end:exports -->
```

Only include sections that have real content. If no routes were found, omit the routes section entirely.

---

### docs/docstrings.md template

```
<!-- raptor:start:overview -->
# Docstrings Reference

Functions and classes extracted from the codebase, with descriptions.
<!-- raptor:end:overview -->

<!-- raptor:start:symbols -->
## Symbol Inventory

<for each file with symbols: file path as H3, then each function/class name with its inferred description based on name, parameters, and context>
<!-- raptor:end:symbols -->
```

---

### llms.txt template

Generate this last, referencing all the docs just written.

```
# <project-name>

> <one-sentence summary of what the project is>

<2-3 sentences of context for an AI assistant reading this file>

## Documentation

- [README](./README.md): Project overview, installation, and usage
- [Architecture](./docs/ARCHITECTURE.md): System design, module structure, and data flow
- [API Reference](./docs/api.md): HTTP routes and exported functions
- [Docstrings](./docs/docstrings.md): Symbol inventory with descriptions

## Source

- [Entry Point](./<entry-point>): Main application entry
```

Only include links to files that were actually generated.

---

## Phase 5 — Report

After all documents are written, show a final summary:

```
✅ Raptor documentation complete

Generated:
  • README.md              (created / updated)
  • docs/ARCHITECTURE.md   (created / updated)
  • docs/api.md            (created / updated)
  • docs/docstrings.md     (created / updated)
  • llms.txt               (created / updated)

Language: <language>
Mode: full generation / merge
```

If any `raptor write` command failed, report the error clearly.

---

## Error Handling

- **CLI not found**: Show install instructions, stop.
- **Path does not exist**: Confirm the path with the user, stop.
- **Write permission denied**: Report the error from doctor, stop.
- **Empty analysis** (0 files found): Warn the user the directory may be empty or fully excluded.
- **GitHub mode, write requested**: Explain that GitHub mode is read-only; instruct user to clone and run locally.
- **No git repo**: Inform the user incremental update is unavailable; proceed with full regeneration.
- **Existing docs without raptor markers**: Warn that files will be backed up as `<filename>.raptor-backup` before overwriting; ask confirmation.
