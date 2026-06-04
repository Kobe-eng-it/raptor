# Raptor

> Local, queryable codebase wiki for GitHub Copilot CLI, Claude Code, Cursor, and more.

Raptor builds `.raptor/wiki` as the authoritative local documentation source, then lets an AI assistant query it through deterministic lexical search:

| Artifact | Path | Description |
|----------|------|-------------|
| Wiki Pages | `.raptor/wiki/*.md` | Reviewable Markdown pages with source metadata |
| Search Chunks | `.raptor/index/chunks.jsonl` | Lexical query index built from wiki pages |
| Symbols | `.raptor/index/symbols.jsonl` | Extracted CommonJS, ESM, TypeScript, Python, and Go symbols |
| Links | `.raptor/index/links.json` | Page-to-page and page-to-source references |
| Manifest | `.raptor/manifest.json` | Schema, source commit, and build timestamp |
| LLM Exports | `llms.txt`, `llms-full.txt` | Convenience exports derived from the wiki |

---

## How It Works

Raptor has two components:

1. **CLI** (`raptor-docgen` on npm) — deterministic work: file walking, language detection, symbol extraction, wiki generation, validation, and local query ranking
2. **Skill** (`skill/raptor/SKILL.md`) — installed in your AI agent to orchestrate analysis, review, and codebase questions

The CLI remains the deterministic source of truth. The skill asks the CLI to build and query `.raptor/wiki`, then uses the returned pages, excerpts, symbols, and warnings as grounded context.

```
User -> AI Agent (skill) -> raptor doctor -> raptor wiki build -> raptor wiki validate -> raptor query
```

---

## Install

### 1. Install the CLI

```bash
npm install -g raptor-docgen
```

Or use without global install (invoked via `npx raptor-docgen` by the skill).

Verify:

```bash
raptor doctor
```

### 2. Install the skill

**Interactive (recommended):**

```bash
# macOS/Linux
./setup.sh

# Windows
./setup.ps1
```

**Manual — GitHub Copilot CLI:**

```bash
mkdir -p ~/.copilot/skills/raptor
cp skill/raptor/SKILL.md ~/.copilot/skills/raptor/SKILL.md
```

```powershell
# Windows
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.copilot\skills\raptor"
Copy-Item skill\raptor\SKILL.md "$env:USERPROFILE\.copilot\skills\raptor\SKILL.md"
```

**Via `npx skills add` (installs to all compatible agents at once):**

```bash
npx skills add https://github.com/Kobe-eng-it/raptor
```

---

## Usage

Once the skill is installed, open your AI agent in any project and say:

```
Generate documentation for this project
```

or

```
Run raptor
```

The skill will:
1. Check prerequisites (`raptor doctor`)
2. Initialize/build `.raptor/wiki`
3. Validate frontmatter, links, source references, and stale pages
4. Present wiki pages for review
5. Query the wiki for follow-up codebase questions

You can also ask direct questions after building the wiki:

```
Ask raptor where documentation generation happens
```

---

## CLI Reference

```
raptor analyze [path] [--deep] [--json]   Analyze codebase
raptor diff    [path] [--json]            Git-tracked changes since HEAD
raptor write   --file <path> [--merge]    Write doc content from stdin
raptor doctor  [--json]                   Check prerequisites
raptor wiki init [path] [--json]          Create .raptor wiki/index directories
raptor wiki build [path] [--json]         Build wiki pages and lexical indexes
raptor wiki validate [path] [--json]      Validate wiki metadata, links, and sources
raptor wiki status [path] [--json]        Show draft, reviewed, and stale wiki pages
raptor query <question> [path] [--json]   Search the local wiki
raptor version [--json]                   Print version
```

### Soft Gates

Wiki pages use `status: draft | reviewed | stale` frontmatter. Queries still work against draft or stale pages, but results include warnings when the answer is grounded in non-reviewed or stale material.

---

## Distribute to Colleagues

### Option A — `npx skills add` (zero setup, all agents)

Once your repo is public on GitHub:

```bash
npx skills add https://github.com/Kobe-eng-it/raptor
```

This installs the skill to all compatible agents (Copilot, Claude Code, Cursor, etc.) automatically.

### Option B — Setup script (recommended for teams)

Each colleague clones the repo and runs the interactive installer:

```bash
git clone https://github.com/Kobe-eng-it/raptor
cd raptor

# macOS/Linux
./setup.sh

# Windows
./setup.ps1
```

The script installs the CLI globally and copies the skill to the chosen agent.

### Option C — Manual copy (minimal footprint)

No clone needed. Just copy one file:

```bash
# Copilot CLI
mkdir -p ~/.copilot/skills/raptor
curl -sSL https://raw.githubusercontent.com/Kobe-eng-it/raptor/main/skill/raptor/SKILL.md \
  > ~/.copilot/skills/raptor/SKILL.md
```

```powershell
# Windows / Copilot CLI
New-Item -ItemType Directory -Force "$env:USERPROFILE\.copilot\skills\raptor"
Invoke-WebRequest `
  "https://raw.githubusercontent.com/Kobe-eng-it/raptor/main/skill/raptor/SKILL.md" `
  -OutFile "$env:USERPROFILE\.copilot\skills\raptor\SKILL.md"
```

Then install the CLI separately:
```bash
npm install -g raptor-docgen
```

---

## Project Structure

```
raptor/
  bin/
    raptor.js             CLI entry point
  src/
    analyze.js            File tree, language detection, symbol extraction
    diff.js               Git diff for incremental updates
    git.js                Git metadata helpers with filesystem fallback
    symbols.js            Pragmatic source symbol extraction
    wiki.js               Wiki build, validate, status, and query commands
    write.js              File write with section-marker merge
    doctor.js             Environment preflight checks
    util.js               Shared utilities
  test/
    wiki.test.js          Wiki core regression tests
  skill/
    raptor/
      SKILL.md            AI skill (works with Copilot, Claude, Cursor, etc.)
      install-copilot.md  Copilot-specific install guide
  setup.sh                Interactive installer (macOS/Linux)
  setup.ps1               Interactive installer (Windows)
  package.json
  README.md
```

---

## License

MIT
