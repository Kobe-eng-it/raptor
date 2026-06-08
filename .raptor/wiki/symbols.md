---
status: reviewed
source_commit: 9dd45e71d7de4818fd3b974a5779b37f3c5e6f96
last_generated: 2026-06-08T15:55:22.219Z
sources:
  - src/analyze.js
  - src/answerPack.js
  - src/diff.js
  - src/doctor.js
  - src/git.js
  - src/routes.js
  - src/symbols.js
  - src/util.js
  - src/wiki.js
  - src/workspaces.js
  - src/write.js
  - test/wiki.test.js
source_hashes:
  src/analyze.js: a19090ef105694df
  src/answerPack.js: 94b2615f7a6881d2
  src/diff.js: f873e4e114325763
  src/doctor.js: c97c2e2154cc4c78
  src/git.js: dd6e162228aac497
  src/routes.js: d8d9a24027d71ae3
  src/symbols.js: 3eb92f85261b3da5
  src/util.js: 584d1e1f1a6f4da0
  src/wiki.js: 874aae567706c06f
  src/workspaces.js: 6eee97da965c9081
  src/write.js: 5a50000107c48217
  test/wiki.test.js: c7140064dc142d4d
confidence: medium
---

# Symbols

## Symbol Inventory

### src/analyze.js

- `readDeepContent` (function)
- `analyze` (function)
- `module.exports` (commonjs-export)

### src/answerPack.js

- `expandQueryTerms` (function)
- `loadJsonl` (function)
- `parseAnswerPackArgs` (function)
- `isRouteQuery` (function)
- `scoreSymbol` (function)
- `scoreRoute` (function)
- `scoreChunk` (function)
- `snippet` (function)
- `insideRoot` (function)
- `selectSourcePaths` (function)
- `extractSourcePaths` (function)
- `buildSourceSnippet` (function)
- `confidenceFor` (function)
- `answerPack` (function)
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

### src/routes.js

- `slash` (function)
- `lineNumberAt` (function)
- `findWorkspace` (function)
- `joinRoutes` (function)
- `normalizeRoutePath` (function)
- `parseLiteralStrings` (function)
- `isDynamicRoutePath` (function)
- `parseSpringAnnotationArgs` (function)
- `functionNameAfter` (function)
- `findClassPrefix` (function)
- `handlerAfter` (function)
- `pushRoute` (function)
- `extractSpringRoutes` (function)
- `extractExpressRoutes` (function)
- `parsePythonRouteMethods` (function)
- `extractPythonRoutes` (function)
- `extractRoutes` (function)
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

- `shouldIgnoreRelPath` (function)
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
- `renderRoutes` (function)
- `createPages` (function)
- `pageTitle` (function)
- `createChunks` (function)
- `refreshChunkIndex` (function)
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
- `normalizePageName` (function)
- `parseReviewArgs` (function)
- `writeReviewedPage` (function)
- `wikiReview` (function)
- `tokenize` (function)
- `expandQueryTerms` (function)
- `loadJsonl` (function)
- `parseQueryArgs` (function)
- `snippet` (function)
- `hasSourcePath` (function)
- `scoreSymbol` (function)
- `extractSourcePaths` (function)
- `isRouteQuery` (function)
- `scoreRoute` (function)
- `formatRouteEvidence` (function)
- `formatQueryText` (function)
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
- `deepSpringRepo` (function)
- `capture` (function)
- `captureText` (function)
- `captureError` (function)
- `runCli` (function)
- `module.exports` (commonjs-export)
- `main` (commonjs-export)
- `extra` (commonjs-export)
- `GET /users` (route)
- `POST /users` (route)
- `DELETE /users/:id` (route)
