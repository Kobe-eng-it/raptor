---
status: draft
source_commit: 788243df264461030b3b8de850d92c0dfb28d0b2
last_generated: 2026-06-04T14:23:19.747Z
sources: 
  - src/analyze.js
  - src/diff.js
  - src/doctor.js
  - src/git.js
  - src/symbols.js
  - src/util.js
  - src/wiki.js
  - src/workspaces.js
  - src/write.js
  - test/wiki.test.js
source_hashes: 
  src/analyze.js: a19090ef105694df
  src/diff.js: f873e4e114325763
  src/doctor.js: c97c2e2154cc4c78
  src/git.js: dd6e162228aac497
  src/symbols.js: 3eb92f85261b3da5
  src/util.js: baaf733a6b4510dc
  src/wiki.js: 66d6d7e6129f012a
  src/workspaces.js: 6eee97da965c9081
  src/write.js: 5a50000107c48217
  test/wiki.test.js: 7e0a7902d0bb6f47
confidence: medium
---

# Symbols

## Symbol Inventory

### src/analyze.js

- `readDeepContent` (function)
- `analyze` (function)
- `module.exports` (commonjs-export)

### src/diff.js

- `diff` (function)
- `module.exports` (commonjs-export)

### src/doctor.js

- `checkTool` (function)
- `checkWritePermission` (function)
- `checkGitRepo` (function)
- `doctor` (function)
- `module.exports` (commonjs-export)

### src/git.js

- `runGit` (function)
- `findGitDir` (function)
- `gitRootFromDir` (function)
- `readHeadCommitFromGitDir` (function)
- `slashRef` (function)
- `hasGitRepo` (function)
- `getGitRoot` (function)
- `getHeadCommit` (function)
- `listChangedFiles` (function)
- `module.exports` (commonjs-export)

### src/symbols.js

- `pushSymbol` (function)
- `extractJavaScriptSymbols` (function)
- `extractPythonSymbols` (function)
- `extractGoSymbols` (function)
- `dedupeSymbols` (function)
- `extractSymbols` (function)
- `isSymbolFile` (function)
- `module.exports` (commonjs-export)

### src/util.js

- `walkDir` (function)
- `detectLanguages` (function)
- `detectFramework` (function)
- `getPackageInfo` (function)
- `getEntryPoints` (function)
- `checkExistingDocs` (function)
- `hasGitRepo` (function)
- `output` (function)
- `outputError` (function)
- `module.exports` (commonjs-export)

### src/wiki.js

- `nowIso` (function)
- `slash` (function)
- `sha256` (function)
- `fileHash` (function)
- `readText` (function)
- `ensureRaptor` (function)
- `parsePathArg` (function)
- `markdownList` (function)
- `yamlValue` (function)
- `createFrontmatter` (function)
- `parseFrontmatter` (function)
- `sourceHashes` (function)
- `writePage` (function)
- `buildContext` (function)
- `makeMeta` (function)
- `sourceLink` (function)
- `workspaceLabel` (function)
- `workspaceSummary` (function)
- `renderWorkspaces` (function)
- `renderWorkspaceEntrypoints` (function)
- `createPages` (function)
- `pageTitle` (function)
- `createChunks` (function)
- `createLinks` (function)
- `writeJsonl` (function)
- `writeIndexes` (function)
- `writeManifest` (function)
- `writeLlmsExports` (function)
- `wikiInit` (function)
- `wikiBuild` (function)
- `listWikiPages` (function)
- `validatePage` (function)
- `wikiValidate` (function)
- `wikiStatus` (function)
- `tokenize` (function)
- `loadJsonl` (function)
- `parseQueryArgs` (function)
- `snippet` (function)
- `hasSourcePath` (function)
- `query` (function)
- `wiki` (function)
- `module.exports` (commonjs-export)

### src/workspaces.js

- `slash` (function)
- `rel` (function)
- `dirOf` (function)
- `joinRel` (function)
- `existsRel` (function)
- `readPackageJson` (function)
- `readGoModuleName` (function)
- `readPyProjectName` (function)
- `addEntrypoint` (function)
- `addSkipped` (function)
- `normalizeExportValue` (function)
- `stripRelativePrefix` (function)
- `detectPackageEntrypoints` (function)
- `candidatesFromScript` (function)
- `detectFrontendEntrypoints` (function)
- `detectPythonEntrypoints` (function)
- `detectGoEntrypoints` (function)
- `languageForManifest` (function)
- `hydrateWorkspace` (function)
- `discoverWorkspaces` (function)
- `module.exports` (commonjs-export)

### src/write.js

- `mergeContent` (function)
- `write` (function)
- `START_MARKER` (function)
- `END_MARKER` (function)
- `module.exports` (commonjs-export)

### test/wiki.test.js

- `tempRepo` (function)
- `nestedFrontendRepo` (function)
- `capture` (function)
- `main` (commonjs-export)
- `extra` (commonjs-export)
