---
status: approved
approved_at: 2026-06-08T07:26:44Z
last_modified: 2026-06-08T07:26:44Z
source_design_approved_at: 2026-06-08T07:24:06Z
---

# Implementation Plan

- [ ] 1. Add deterministic route extraction
  - [ ] 1.1 Implement `src/routes.js` with normalized route records and Java Spring extraction
    - Requirements: `R1.AC1`, `R1.AC4`, `R1.AC5`, `R1.AC6`, `R1.AC7`, `NFR1`, `NFR2`, `NFR3`, `NFR5`, `C1`, `C2`, `C4`, `C5`
    - Design: `src/routes.js`, Route Extractors, Data Models, Security Considerations
    - Verification:
      - command: ["npm", "test"]
        covers: ["R1.AC1", "R1.AC4", "R1.AC5", "R1.AC6", "R1.AC7"]

  - [ ] 1.2 Extend `src/routes.js` for Express JavaScript/TypeScript routes and FastAPI/Flask decorators
    - Requirements: `R1.AC2`, `R1.AC3`, `R1.AC4`, `R1.AC5`, `NFR1`, `NFR2`, `NFR3`, `NFR5`, `C1`, `C2`, `C5`
    - Design: Route Extractors, Data Models, Testing Strategy
    - Verification:
      - command: ["npm", "test"]
        covers: ["R1.AC2", "R1.AC3", "R1.AC4", "R1.AC5"]

- [ ] 2. Integrate routes into wiki build artifacts
  - [ ] 2.1 Add route extraction to build context and write `.raptor/index/routes.jsonl`
    - Requirements: `R2.AC1`, `R2.AC3`, `R5.AC1`, `R5.AC2`, `R5.AC3`, `NFR2`, `C2`, `C3`, `C4`
    - Design: `src/wiki.js` Build Integration, Data Models, Error Handling
    - Verification:
      - command: ["npm", "test"]
        covers: ["R2.AC1", "R2.AC3", "R5.AC1", "R5.AC2", "R5.AC3"]

  - [ ] 2.2 Generate `.raptor/wiki/routes.md` and include it in exports, status, review, and validation flows
    - Requirements: `R2.AC2`, `R2.AC3`, `R2.AC4`, `R2.AC5`, `R5.AC1`, `R5.AC2`, `R5.AC3`, `R5.AC4`, `C3`
    - Design: `src/wiki.js` Build Integration, Failure Modes And Tradeoffs, Verification Plan
    - Verification:
      - command: ["npm", "test"]
        covers: ["R2.AC2", "R2.AC3", "R2.AC4", "R2.AC5", "R5.AC1", "R5.AC2", "R5.AC3", "R5.AC4"]

- [ ] 3. Make query route-aware
  - [ ] 3.1 Load and score route records in `raptor query --json`
    - Requirements: `R3.AC1`, `R3.AC2`, `R3.AC3`, `R3.AC5`, `NFR1`, `NFR2`, `C2`, `C4`
    - Design: Query Integration, Data Models, Error Handling
    - Verification:
      - command: ["npm", "test"]
        covers: ["R3.AC1", "R3.AC2", "R3.AC3", "R3.AC5"]

  - [ ] 3.2 Update human-readable query output to prefer best route evidence when route hits exist
    - Requirements: `R3.AC4`, `R3.AC5`
    - Design: Query Integration, Failure Modes And Tradeoffs
    - Verification:
      - command: ["npm", "test"]
        covers: ["R3.AC4", "R3.AC5"]

- [ ] 4. Add answer-pack command
  - [ ] 4.1 Implement `src/answerPack.js` with bounded source snippet selection and confidence scoring
    - Requirements: `R4.AC1`, `R4.AC2`, `R4.AC3`, `R4.AC4`, `R4.AC5`, `NFR1`, `NFR2`, `NFR4`, `NFR5`, `C1`, `C2`, `C4`
    - Design: `src/answerPack.js`, Data Models, Error Handling, Security Considerations
    - Verification:
      - command: ["npm", "test"]
        covers: ["R4.AC1", "R4.AC2", "R4.AC3", "R4.AC4", "R4.AC5"]

  - [ ] 4.2 Wire `answer-pack` into `bin/raptor.js` help and command dispatch
    - Requirements: `R4.AC1`, `R4.AC4`, `C2`
    - Design: CLI Dispatcher
    - Verification:
      - command: ["npm", "test"]
        covers: ["R4.AC1", "R4.AC4"]

- [ ] 5. Update agent workflow and generated project knowledge
  - [ ] 5.1 Update `skill/raptor/SKILL.md` to use `raptor answer-pack` for procedural questions
    - Requirements: `R6.AC1`, `R6.AC2`, `R6.AC3`
    - Design: Raptor Skill
    - Verification:
      - command: ["npm", "test"]
        covers: ["R6.AC1", "R6.AC2", "R6.AC3"]

  - [ ] 5.2 Regenerate and review Raptor's own wiki/index exports after implementation
    - Requirements: `R2.AC1`, `R2.AC2`, `R2.AC5`, `R5.AC4`, `R6.AC1`
    - Design: Verification Plan
    - Verification:
      - command: ["node", "bin/raptor.js", "wiki", "build", "--json"]
        covers: ["R2.AC1", "R2.AC2", "R2.AC5"]
      - command: ["node", "bin/raptor.js", "wiki", "review", "--all", "--json"]
        covers: ["R5.AC4"]
      - command: ["node", "bin/raptor.js", "wiki", "validate", "--json"]
        covers: ["R5.AC1", "R5.AC2", "R5.AC3", "R5.AC4"]

- [ ] 6. Perform final smoke checks and repository handoff
  - [ ] 6.1 Run local smoke checks for route query and answer-pack on a fixture-backed or current repository build
    - Requirements: `R3.AC1`, `R3.AC2`, `R3.AC3`, `R3.AC4`, `R4.AC1`, `R4.AC2`, `R4.AC3`, `R4.AC5`
    - Design: Verification Plan, Operational evidence
    - Verification:
      - command: ["npm", "test"]
        covers: ["R3.AC1", "R3.AC2", "R3.AC3", "R3.AC4", "R4.AC1", "R4.AC2", "R4.AC3", "R4.AC5"]
      - command: ["node", "bin/raptor.js", "answer-pack", "where is the route API implemented?", "--json"]
        covers: ["R4.AC1", "R4.AC2", "R4.AC3", "R4.AC5"]
