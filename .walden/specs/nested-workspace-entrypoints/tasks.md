---
status: approved
approved_at: 2026-06-04T13:42:26Z
last_modified: 2026-06-04T13:55:54Z
source_design_approved_at: 2026-06-04T13:32:49Z
---

# Implementation Plan

- [x] 1. Implement workspace discovery and entrypoint heuristics
  - [x] 1.1 Add `src/workspaces.js` with workspace discovery from recognized manifests
    - Requirements: `R1.AC1`, `R1.AC2`, `R1.AC3`, `NFR1`, `NFR2`, `NFR3`
    - Design: `src/workspaces.js`, Data Models, Error Handling
    - Verification:
      - command: ["node", "test/wiki.test.js"]
        covers: ["R1.AC1", "R1.AC2", "R1.AC3"]

  - [x] 1.2 Add deterministic entrypoint detection for JavaScript, TypeScript, Python, and Go workspaces
    - Requirements: `R2.AC1`, `R2.AC2`, `R2.AC3`, `R2.AC4`, `C1`, `C2`, `C3`
    - Design: `src/workspaces.js`, Data Models, Error Handling, Security Considerations
    - Verification:
      - command: ["node", "test/wiki.test.js"]
        covers: ["R2.AC1", "R2.AC2", "R2.AC3", "R2.AC4"]

- [x] 2. Integrate workspace data into wiki build, validation, and query
  - [x] 2.1 Add workspace analysis to `buildContext()` and generate `.raptor/wiki/workspaces.md`
    - Requirements: `R1.AC1`, `R1.AC2`, `R3.AC1`, `R3.AC3`, `R3.AC4`, `R5.AC1`, `C4`
    - Design: `src/wiki.js` Build Context, Wiki Page Rendering, Requirement Coverage
    - Verification:
      - command: ["node", "test/wiki.test.js"]
        covers: ["R3.AC1", "R3.AC3", "R3.AC4", "R5.AC1"]

  - [x] 2.2 Update `.raptor/wiki/entrypoints.md` rendering to group entrypoints by workspace
    - Requirements: `R2.AC1`, `R2.AC2`, `R2.AC3`, `R3.AC2`, `R3.AC3`, `NFR2`
    - Design: Wiki Page Rendering, Data Models
    - Verification:
      - command: ["node", "test/wiki.test.js"]
        covers: ["R3.AC2", "R3.AC3"]

  - [x] 2.3 Extend lexical query ranking for workspace and launch-related questions
    - Requirements: `R4.AC1`, `R4.AC2`, `R4.AC3`
    - Design: Query Ranking, Failure Modes And Tradeoffs
    - Verification:
      - command: ["node", "test/wiki.test.js"]
        covers: ["R4.AC1", "R4.AC2", "R4.AC3"]

- [x] 3. Add regression coverage and refresh generated wiki exports
  - [x] 3.1 Add fixture tests for nested frontend workspace detection, invalid manifests, and staleness
    - Requirements: `R1.AC3`, `R2.AC4`, `R5.AC2`, `R5.AC3`
    - Design: Testing Strategy, Verification Plan
    - Verification:
      - command: ["node", "test/wiki.test.js"]
        covers: ["R1.AC3", "R2.AC4", "R5.AC2", "R5.AC3"]

  - [x] 3.2 Rebuild and validate Raptor's own wiki after implementation
    - Requirements: `R3.AC1`, `R3.AC2`, `R5.AC1`, `NFR1`, `NFR2`
    - Design: Verification Plan
    - Verification:
      - command: ["node", "bin/raptor.js", "wiki", "build", "--json"]
        covers: ["R3.AC1", "R3.AC2"]
      - command: ["node", "bin/raptor.js", "wiki", "validate", "--json"]
        covers: ["R5.AC1"]
