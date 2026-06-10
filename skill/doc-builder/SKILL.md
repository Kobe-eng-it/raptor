---
name: doc-builder
description: "Builds source-grounded document drafts from a local codebase by using Raptor answer-pack evidence first. Use when the user asks for functional documents, technical documents, test plans, test cases, API notes, or workflow notes derived from code."
metadata:
  short-description: Source-grounded document drafting
---

# Doc Builder

Create source-grounded document drafts from local code evidence. Reply in the user's preferred language when possible; default to Italian when the user does not specify a language.

Doc-builder is an agent workflow, not a replacement for Raptor analysis. Raptor remains the deterministic evidence layer. Do not duplicate Raptor analysis logic, do not add embeddings, and do not use MCP in this increment. Treat MCP as a future extension only.

## When To Use

- The user asks for a functional document from code.
- The user asks for a technical document from code.
- The user asks for a test plan or test cases from code.
- The user asks for API notes or user workflow notes from code.
- The user asks to turn a Raptor answer-pack result into a reviewed document draft.

## Supported Document Types

Supported document types:

- `functional document`
- `technical document`
- `test plan`
- `test cases`
- `API notes`
- `user workflow notes`

When the user explicitly names a document type, use that type. When the user does not name a document type, default to `functional document`. If the requested document type is unsupported, ask the user to choose one supported document type before continuing.

Map user-facing requests before applying the default:

- Requests such as "manuale utente", "guida utente", "come usare l'applicazione", "istruzioni utente", or "user manual" SHALL use `user workflow notes`.
- Requests for verification strategy, collaudo, casi di prova, or test scenarios SHALL use `test plan` or `test cases`, based on the user's wording.
- Requests for endpoints, payloads, API behavior, or integration notes SHALL use `API notes`.
- Requests for architecture, implementation, internals, or source-code behavior SHALL use `technical document`.
- Only use `functional document` as the fallback when no stronger document-type signal is present.

## Prerequisites

The `raptor` CLI must be installed and available in `PATH`.

Run:

```bash
raptor doctor --json
```

If Raptor is missing, stop and show:

```bash
npm install -g raptor-docgen
```

Or:

```bash
npx raptor-docgen doctor
```

## Workflow

### Phase 1 - Target And Request

1. Identify the target codebase path.
2. Identify the user's document goal.
3. Determine document type:
   - use the explicit type if provided;
   - map user-facing guide/manual requests to `user workflow notes`;
   - otherwise default to `functional document`.
4. Determine language:
   - use the explicit language if provided;
   - otherwise start in Italian.
5. Form the evidence question from the user's request.

Never assume a parent workspace is the target project when the user names a nested project. If the target path is ambiguous and cannot be inferred from the current request, ask for the target path before running Raptor.

### Phase 2 - Evidence First

Before drafting document content, run:

```bash
raptor answer-pack "<question>" "<target-path>" --json
```

In the answer, explicitly report that `raptor answer-pack "<question>" "<target-path>" --json` was run. If `raptor answer-pack` was not run successfully, do not draft an outline or document; explain the blocker and run `raptor wiki build "<target-path>" --json` when the index is missing.

If `.raptor/index/chunks.jsonl` is missing, run or request:

```bash
raptor wiki build "<target-path>" --json
```

Then retry `raptor answer-pack`.

Use the JSON result as the source of truth for:

- `confidence`
- `wiki_results`
- `routes`
- `symbols`
- `sources`
- `warnings`

When `answer-pack` returns route or source files, inspect at least the first three distinct evidence files before drafting document content. Prefer route files first, then source files, then symbol paths. If fewer than three distinct files are returned, inspect all returned files and state the limitation.

For behavioral documents and workflow documents, a behavioral claim requires at least one verified route, controller, service, entrypoint, command, component, or equivalent workflow boundary. Do not claim a complete workflow unless the inspected evidence shows:

- an entrypoint or route;
- a service or handler;
- persistence, provider, configuration, or another downstream implementation boundary.

If inspected evidence does not show this full chain, label the workflow as `partial` or `inferred`.

### Phase 3 - Confidence Handling

Use these thresholds:

- `high`: proceed to outline after required evidence inspection.
- `medium`: proceed to outline after required evidence inspection, but disclose assumptions and limits.
- `low`: diagnose before drafting.

For low confidence, diagnose likely causes before drafting:

- wrong target path;
- wiki not built;
- stale or empty index;
- no route evidence;
- no symbols matching the requested workflow;
- query too vague or using terms not present in the code.

If evidence remains low after diagnosis, produce an evidence-insufficiency brief instead of a full document. The brief must include:

- question;
- target path;
- files or wiki pages checked;
- why evidence is insufficient;
- suggested next query or source area to inspect.

### Phase 4 - Outline Gate

Create an outline before long-form drafting.

If the proposed document has more than three sections, present the outline and wait for explicit outline approval before drafting section content. Do not treat silence as approval.

This is a hard gate: when the outline has more than three sections, the response SHALL stop after the outline, verified files, assumptions, limits, and the approval question. It SHALL NOT include drafted sections, procedures, troubleshooting content, or appendix content in the same response.

Keep an explicit approval state:

- `outline_approved: false` until the user explicitly approves the outline.
- `draft_created: false` until a draft is actually produced after outline approval.
- `save_requested: false` unless the user explicitly asks to save after a draft exists.

Do not ask whether to save a draft while `outline_approved: false` or `draft_created: false`. A request such as "preparare un manuale" means prepare the evidence and outline first; it does not imply save approval.

If the proposed document has three sections or fewer, direct draft generation is allowed without a separate outline approval gate.

During outline review, tell the user they can change:

- document type;
- language;
- section order;
- section scope.

If the user changes document type, regenerate the outline for the selected document type. If the user changes language, regenerate the outline in the selected language. Drafting must use the approved outline language.

### Phase 5 - Draft

Draft only from inspected evidence and the approved outline when approval is required.

Every draft must include these sections unless the user explicitly asks for a shorter output:

```text
Titolo
Scopo
File verificati
Evidenza
Assunzioni
Limiti
Sezioni del documento
```

For each behavioral claim, cite the supporting file path. Include route method, route path, handler, symbol, or configuration value when available. If a claim is inferred, mark it as inferred. If a workflow is partial, mark it as partial.

Keep user-facing prose concise. Prefer clear tables or numbered procedures when the document type benefits from them.

For `user workflow notes`, user manuals, and user guides:

- Write the main sections around user goals, screens, actions, outcomes, and troubleshooting.
- Keep code symbols, JWT details, controller names, route handlers, and provider internals out of the main user flow unless the user explicitly asks for technical detail.
- Put technical findings in `Evidenza tecnica` or `Limiti`, after the user-facing content.
- Prefer labels such as `Accesso`, `Ricerca documenti`, `Consultazione dettaglio`, `Download`, `Permessi`, and `Problemi comuni` over implementation labels such as `Security.java`, `Profile.apply`, `JWT`, or controller method names.
- If evidence is mostly technical, translate it into cautious user-facing behavior and cite the files only in the evidence sections.

### Phase 6 - Write Only After Approval

Writing is separate from drafting. Do not write generated content to disk unless the user explicitly asks to save it.

Before writing, verify all of these are true:

- the outline was approved when the document has more than three sections;
- the draft was already generated;
- the user explicitly asked to save that draft.

Use these storage rules:

- Draft documents go under `.raptor/docs/` in the target codebase.
- Before writing a draft file, create `.raptor/docs/` if it does not exist.
- Final documents go under `docs/` in the target codebase only after explicit final publication approval.
- If the user has not approved writing to `docs/`, do not write generated content to `docs/`.
- If the user asks to save a draft but does not name a filename, create a concise kebab-case filename under `.raptor/docs/`.
- If the user asks to publish a final document but approval is ambiguous, ask for explicit approval before writing.

When writing a generated document to disk, include:

- source evidence;
- verified files;
- assumptions;
- limits;
- confidence;
- whether each workflow is complete, partial, or inferred.

Use the target codebase as the path root. Preserve Windows paths by using native filesystem APIs or literal paths when available, and avoid shell-built paths for writes. Do not write generated target-project documents into the Raptor repository unless the target path is the Raptor repository itself.

When reporting a written file, report the exact absolute path returned by the filesystem. If the parent directory is missing, create it and retry once before reporting failure.

## Required Output Shapes

### Outline

```text
Tipo documento: [functional document | technical document | test plan | test cases | API notes | user workflow notes]
Lingua: [Italiano | requested language]
Confidence: [high | medium | low]

File verificati:
- [path] - [what was verified]

Indice proposto:
1. [section]
2. [section]
3. [section]

Assunzioni:
- [assumption]

Limiti:
- [limit]
```

If the outline has more than three sections, end with a direct request for approval before drafting.

For a user manual or guide, the outline should lead with user-facing chapters before technical evidence, for example:

```text
Indice proposto:
1. Accesso all'applicazione
2. Navigazione principale
3. Ricerca e consultazione documenti
4. Operazioni disponibili per ruolo
5. Problemi comuni
6. Evidenza tecnica e limiti
```

For user manuals and user guides with more than three sections, stop here and ask for approval. Do not draft `Guida rapida`, `Flussi utente`, `Problemi comuni`, or technical appendix content until the user explicitly approves the outline.

### Evidence-Insufficiency Brief

```text
Risposta:
Non ci sono prove sufficienti per scrivere un documento completo.

Verifiche:
- [file/wiki/query checked]

Perche confidence e bassa:
- [cause]

Prossimo passo consigliato:
- [build/query/inspect action]
```

### Draft

```text
# [Title]

## Scopo

## Guida rapida

## Flussi utente

## Problemi comuni

## File verificati

## Evidenza

## Evidenza tecnica

## Assunzioni

## Limiti

## [Approved section 1]

## [Approved section 2]
```

## Safety And Scope

- Do not write to disk unless the user explicitly asks to save the document.
- Save draft documents under `.raptor/docs/` in the target codebase.
- Do not write final documents to `docs/` unless the user explicitly approves final publication.
- If the user has not approved writing to `docs/`, do not write generated content to `docs/`.
- Written documents must include source evidence, assumptions, and limits.
- Do not commit or push generated target-project documents unless the user explicitly approves the exact files.
- Do not copy private target-project details into the public Raptor repository.
- Do not add an MCP server in this increment.
- Do not add embeddings or semantic reranking in this increment.
- Do not claim complete workflows without inspected file evidence.

## Future Scope

These capabilities are intentionally deferred:

- MCP server or MCP resources for Raptor evidence;
- embeddings;
- semantic reranking;
- a new Raptor CLI command that generates full documents.

If a user asks for one of these deferred capabilities, explain that it is future scope and continue with the skill-based evidence workflow when possible.

## Handoff To Raptor

Use Raptor commands for evidence:

```bash
raptor answer-pack "<question>" "<target-path>" --json
raptor query "<question>" "<target-path>" --json
raptor wiki build "<target-path>" --json
```

Use `raptor query` as a follow-up when `answer-pack` is low confidence or when the outline needs broader wiki context.
