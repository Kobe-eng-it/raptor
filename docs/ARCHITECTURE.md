<!-- raptor:start:overview -->
# Architecture

## Overview
Raptor e un sistema composto da una skill AI (orchestrazione) e un CLI Node.js (operazioni deterministiche) per costruire una wiki locale interrogabile della codebase.
<!-- raptor:end:overview -->

<!-- raptor:start:stack -->
## Tech Stack
- Node.js (CLI)
- JavaScript (runtime e comandi)
- Markdown e JSONL (wiki locale e indici lexical)
<!-- raptor:end:stack -->

<!-- raptor:start:structure -->
## Module Structure
- `bin/raptor.js`: entrypoint CLI
- `src/analyze.js`: analisi struttura, linguaggi, simboli
- `src/diff.js`: rilevamento file cambiati tramite git
- `src/git.js`: metadati git con fallback filesystem
- `src/symbols.js`: estrazione simboli CommonJS, ESM, TypeScript, Python e Go
- `src/wiki.js`: init/build/validate/status/query della wiki
- `src/write.js`: scrittura e merge sezionale con marker
- `src/doctor.js`: preflight ambiente
- `skill/raptor/SKILL.md`: flusso operativo della skill
<!-- raptor:end:structure -->

<!-- raptor:start:dataflow -->
## Data Flow
Richiesta utente -> skill -> `raptor doctor` -> `raptor wiki build` -> `raptor wiki validate` -> review umana -> `raptor query` per domande sulla codebase.
<!-- raptor:end:dataflow -->
