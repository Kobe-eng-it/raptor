<!-- raptor:start:overview -->
# Docstrings Reference

Inventario simboli principali della codebase Raptor.
<!-- raptor:end:overview -->

<!-- raptor:start:symbols -->
## Symbol Inventory

### bin/raptor.js
- command router: dispatch dei comandi `analyze`, `diff`, `write`, `doctor`, `version`

### src/analyze.js
- `analyze(argv)`: produce il profilo strutturale della codebase

### src/diff.js
- `diff(argv)`: calcola delta file rispetto a HEAD

### src/write.js
- `write(argv)`: scrive o mergea sezioni con marker stabili

### src/doctor.js
- `doctor(argv)`: controlla prerequisiti runtime e repository
<!-- raptor:end:symbols -->
