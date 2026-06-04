# Install Raptor Skill for GitHub Copilot

## Prerequisites

1. Install the `raptor` CLI:

   ```bash
   npm install -g raptor-docgen
   ```

   Or use without global install (the skill will call it via `npx raptor-docgen`).

   Verify:
   ```bash
   raptor doctor
   ```

2. A GitHub Copilot CLI environment.

## Install the Skill

**Using setup script (recommended):**

```bash
# macOS/Linux
./setup.sh

# Windows
./setup.ps1
```

**Manual install:**

```bash
# macOS/Linux
mkdir -p ~/.copilot/skills/raptor
cp skill/raptor/SKILL.md ~/.copilot/skills/raptor/SKILL.md
```

```powershell
# Windows
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.copilot\skills\raptor"
Copy-Item skill\raptor\SKILL.md "$env:USERPROFILE\.copilot\skills\raptor\SKILL.md"
```

**Via `npx skills add` (installs to all compatible agents):**

```bash
npx skills add https://github.com/Kobe-eng-it/raptor
```

## Usage

Once installed, invoke by asking:
- "Generate documentation for this project"
- "Run raptor"
- "Document my codebase"

The skill will guide you through analysis, planning, and generation.
