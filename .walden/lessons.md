# Walden Lessons

Review this file before non-trivial work when the current request matches past mistakes, rejections, or validation failures.

## Lessons

<!-- Append entries with: walden lesson log --feature <name> --phase <phase> --trigger "..." --lesson "..." --guardrail "..." -->
### 2026-06-04T13:56:27Z | nested-workspace-entrypoints | execute
- Trigger: Smoke test showed package.json bin path was skipped because bin/ is ignored by walkDir
- Lesson: Explicit manifest references are source-of-truth paths and may be valid even when their directory is excluded from recursive scans
- Guardrail: When deriving source paths from manifests, verify existence on disk instead of relying only on the walked file set

### 2026-06-08T10:47:22Z | route-evidence-pack | execute
- Trigger: CLI dispatcher test failed with spawnSync EPERM in sandbox
- Lesson: Tests for CLI dispatch should avoid spawning node when the sandbox may block child processes
- Guardrail: Prefer in-process CLI loading with controlled process.argv and require cache reset for dispatcher regression tests

### 2026-06-08T10:58:23Z | route-evidence-pack | execute
- Trigger: wiki validate ran concurrently with wiki review and observed transient draft page state
- Lesson: Proof commands that mutate and then read workflow state must run sequentially
- Guardrail: Do not parallelize Walden verification commands when a later command depends on state written by an earlier command

### 2026-06-08T15:42:36Z | doc-builder-integration | tasks
- Trigger: Walden validation found missing task coverage for R1.AC5, R2.AC4, R4.AC2, and R4.AC3
- Lesson: Task plans for skill workflows must explicitly cover error, unsupported-option, and evidence-threshold acceptance criteria, not only the happy path
- Guardrail: Before opening task review, compare each task's Requirements and covers lists against all acceptance criteria including unwanted behavior and threshold rules

