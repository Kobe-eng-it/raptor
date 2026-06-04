---
status: draft
source_commit: 86c17ae4eac3bf40a93da77ef07f3dd0e4f79a11
last_generated: 2026-06-04T12:53:51.411Z
sources: 
  - src/analyze.js
  - src/diff.js
  - src/doctor.js
  - src/git.js
  - src/symbols.js
  - src/util.js
  - src/wiki.js
  - src/write.js
  - test/wiki.test.js
source_hashes: 
  src/analyze.js: a19090ef105694df
  src/diff.js: f873e4e114325763
  src/doctor.js: c97c2e2154cc4c78
  src/git.js: dd6e162228aac497
  src/symbols.js: 3eb92f85261b3da5
  src/util.js: baaf733a6b4510dc
  src/wiki.js: 4be74a0d8843116f
  src/write.js: 5a50000107c48217
  test/wiki.test.js: 650db79002e3b5ec
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
- `query` (function)
- `wiki` (function)
- `module.exports` (commonjs-export)

### src/write.js

- `mergeContent` (function)
- `write` (function)
- `START_MARKER` (function)
- `END_MARKER` (function)
- `module.exports` (commonjs-export)

### test/wiki.test.js

- `tempRepo` (function)
- `capture` (function)
- `main` (commonjs-export)
- `extra` (commonjs-export)
