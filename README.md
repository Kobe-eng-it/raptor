# Raptor 🦖

> AI-driven codebase documentation generator for GitHub Copilot CLI, Claude Code, Cursor, and more.

Raptor analyzes your codebase and generates structured, up-to-date documentation via your AI assistant:

| Doc | Path | Description |
|-----|------|-------------|
| README | `README.md` | Project overview, install, usage |
| Architecture | `docs/ARCHITECTURE.md` | System design, modules, data flow |
| API Reference | `docs/api.md` | HTTP routes, exported functions and types |
| Docstrings | `docs/docstrings.md` | Symbol inventory with inferred descriptions |
| LLM Index | `llms.txt` | [llms.txt](https://llmstxt.org) standard index |

---

## How It Works

Raptor has two components:

1. **CLI** (`raptor-docgen` on npm) — deterministic work: file tree, language detection, symbol extraction, git diff, file write/merge
2. **Skill** (`skill/raptor/SKILL.md`) — installed in your AI agent to orchestrate the LLM reasoning and generation

The skill calls the CLI for all data gathering and file writing. The LLM generates the actual documentation content.

```
User → AI Agent (skill) → raptor analyze --json → [LLM generates docs] → raptor write --file ...
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
2. Analyze the codebase
3. Present a plan and ask for your confirmation
4. Generate each document
5. Write files (with smart merge if docs already exist)

### Deep analysis

For richer output (reads key source files in addition to structure):

```
Generate documentation with deep analysis
```

### GitHub repository

```
Generate documentation for https://github.com/org/repo
```

In GitHub mode, docs are shown in the chat. To write files, clone the repo and run in local mode.

---

## CLI Reference

```
raptor analyze [path] [--deep] [--json]   Analyze codebase
raptor diff    [path] [--json]            Git-tracked changes since HEAD
raptor write   --file <path> [--merge]    Write doc content from stdin
raptor doctor  [--json]                   Check prerequisites
raptor version [--json]                   Print version
```

### Section markers

Raptor uses stable HTML comment markers for smart merging:

```markdown
<!-- raptor:start:overview -->
## Overview

Your content here...

<!-- raptor:end:overview -->
```

On subsequent runs with `--merge`, only sections between matching markers are updated. Content outside markers is preserved.

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
    write.js              File write with section-marker merge
    doctor.js             Environment preflight checks
    util.js               Shared utilities
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
