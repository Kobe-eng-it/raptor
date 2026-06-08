---
status: approved
approved_at: 2026-06-08T15:43:45Z
last_modified: 2026-06-08T15:53:22Z
source_design_approved_at: 2026-06-08T15:39:33Z
---

# Implementation Plan

- [x] 1. Add standalone doc-builder skill
  - [x] 1.1 Create `skill/doc-builder/SKILL.md` with evidence-first workflow
    - Requirements: `R1.AC1`, `R1.AC2`, `R1.AC3`, `R1.AC4`, `R1.AC5`, `R2.AC1`, `R2.AC2`, `R2.AC3`, `R2.AC4`, `R4.AC2`, `R4.AC3`, `R6.AC1`, `R6.AC2`, `R7.AC1`, `R7.AC2`, `NFR1`, `NFR2`, `NFR4`
    - Design: `skill/doc-builder/SKILL.md`, Evidence Phase, Outline Phase, Draft Phase
    - Verification:
      - command: ["npm", "test"]
        covers: ["R1.AC1", "R1.AC2", "R1.AC3", "R1.AC4", "R1.AC5", "R2.AC1", "R2.AC2", "R2.AC3", "R2.AC4", "R4.AC2", "R4.AC3", "R6.AC1", "R6.AC2", "R7.AC1", "R7.AC2"]

  - [x] 1.2 Add doc-builder storage, write-approval, and scope guardrails to the skill
    - Requirements: `R3.AC1`, `R3.AC2`, `R3.AC3`, `R3.AC4`, `R3.AC5`, `R5.AC1`, `R5.AC2`, `R5.AC3`, `R5.AC4`, `R6.AC3`, `R6.AC4`, `R7.AC3`, `R7.AC4`, `R7.AC5`, `NFR3`, `NFR5`
    - Design: Outline Phase, Write Phase, Security Considerations, Failure Modes And Tradeoffs
    - Verification:
      - command: ["npm", "test"]
        covers: ["R3.AC1", "R3.AC2", "R3.AC3", "R3.AC4", "R3.AC5", "R5.AC1", "R5.AC2", "R5.AC3", "R5.AC4", "R6.AC3", "R6.AC4", "R7.AC3", "R7.AC4", "R7.AC5"]

- [x] 2. Add regression tests for the doc-builder skill contract
  - [x] 2.1 Assert required doc-builder workflow text in `test/wiki.test.js`
    - Requirements: `R1.AC1`, `R1.AC2`, `R1.AC5`, `R2.AC2`, `R2.AC4`, `R3.AC1`, `R3.AC2`, `R4.AC2`, `R4.AC3`, `R4.AC4`, `R4.AC5`, `R5.AC1`, `R5.AC2`, `R5.AC3`, `R6.AC1`, `R7.AC4`, `NFR4`, `NFR5`
    - Design: Testing Strategy, Verification Plan
    - Verification:
      - command: ["npm", "test"]
        covers: ["R1.AC1", "R1.AC2", "R1.AC5", "R2.AC2", "R2.AC4", "R3.AC1", "R3.AC2", "R4.AC2", "R4.AC3", "R4.AC4", "R4.AC5", "R5.AC1", "R5.AC2", "R5.AC3", "R6.AC1", "R7.AC4"]

- [x] 3. Refresh generated project knowledge
  - [x] 3.1 Rebuild, review, and validate Raptor's own wiki after adding the skill
    - Requirements: `R1.AC1`, `R7.AC1`, `NFR5`
    - Design: Verification Plan, Security Considerations
    - Verification:
      - command: ["node", "bin/raptor.js", "wiki", "build", "--json"]
        covers: ["R1.AC1", "R7.AC1"]
      - command: ["node", "bin/raptor.js", "wiki", "review", "--all", "--json"]
        covers: ["R1.AC1"]
      - command: ["node", "bin/raptor.js", "wiki", "validate", "--json"]
        covers: ["R1.AC1", "NFR5"]

- [x] 4. Smoke-test the agent-facing workflow
  - [x] 4.1 Run a local smoke check that doc-builder can produce an outline from Raptor evidence
    - Requirements: `R1.AC1`, `R1.AC2`, `R2.AC2`, `R3.AC1`, `R4.AC1`, `R4.AC4`, `NFR1`, `NFR4`
    - Design: Verification Plan, Operational evidence
    - Verification:
      - command: ["npm", "test"]
        covers: ["R1.AC1", "R1.AC2", "R2.AC2", "R3.AC1", "R4.AC1", "R4.AC4"]
