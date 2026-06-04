# Walden Lessons

Review this file before non-trivial work when the current request matches past mistakes, rejections, or validation failures.

## Lessons

<!-- Append entries with: walden lesson log --feature <name> --phase <phase> --trigger "..." --lesson "..." --guardrail "..." -->
### 2026-06-04T13:56:27Z | nested-workspace-entrypoints | execute
- Trigger: Smoke test showed package.json bin path was skipped because bin/ is ignored by walkDir
- Lesson: Explicit manifest references are source-of-truth paths and may be valid even when their directory is excluded from recursive scans
- Guardrail: When deriving source paths from manifests, verify existence on disk instead of relying only on the walked file set

