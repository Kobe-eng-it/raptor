'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  walkDir,
  detectLanguages,
  detectFramework,
  getPackageInfo,
  getEntryPoints,
  output,
  outputError,
} = require('./util');
const { getHeadCommit } = require('./git');
const { extractSymbols, isSymbolFile } = require('./symbols');
const { discoverWorkspaces } = require('./workspaces');
const { extractRoutes } = require('./routes');

const SCHEMA_VERSION = 'v0.1.0';
const WIKI_DIR = path.join('.raptor', 'wiki');
const INDEX_DIR = path.join('.raptor', 'index');
const PAGE_STATUS = new Set(['draft', 'reviewed', 'stale']);

function nowIso() {
  return new Date().toISOString();
}

function slash(value) {
  return value.replace(/\\/g, '/');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fileHash(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function ensureRaptor(rootPath) {
  fs.mkdirSync(path.join(rootPath, WIKI_DIR), { recursive: true });
  fs.mkdirSync(path.join(rootPath, INDEX_DIR), { recursive: true });
}

function parsePathArg(argv) {
  const pathArg = argv.find(arg => !arg.startsWith('--'));
  return pathArg ? path.resolve(pathArg) : process.cwd();
}

function markdownList(items, emptyText = 'None detected.') {
  if (!items.length) return emptyText;
  return items.map(item => `- ${item}`).join('\n');
}

function yamlValue(value) {
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return `\n${value.map(item => `  - ${item}`).join('\n')}`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return '{}';
    return `\n${entries.map(([key, val]) => `  ${key}: ${val}`).join('\n')}`;
  }
  if (value === null || value === undefined) return '';
  return String(value);
}

function createFrontmatter(meta) {
  const keys = ['status', 'source_commit', 'last_generated', 'sources', 'source_hashes', 'confidence'];
  const lines = ['---'];
  for (const key of keys) {
    lines.push(`${key}: ${yamlValue(meta[key])}`);
  }
  lines.push('---');
  return lines.join('\n');
}

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) return { meta: null, body: content };
  const end = content.indexOf('\n---', 4);
  if (end === -1) return { meta: null, body: content };

  const raw = content.slice(4, end).split(/\r?\n/);
  const meta = {};
  let currentKey = null;
  for (const line of raw) {
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && currentKey) {
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
      meta[currentKey].push(listMatch[1]);
      continue;
    }

    const objectMatch = line.match(/^\s+([^:]+):\s*(.*)$/);
    if (objectMatch && currentKey) {
      if (!meta[currentKey] || Array.isArray(meta[currentKey]) || typeof meta[currentKey] !== 'object') {
        meta[currentKey] = {};
      }
      meta[currentKey][objectMatch[1]] = objectMatch[2];
      continue;
    }

    const keyMatch = line.match(/^([^:]+):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      const value = keyMatch[2];
      if (value === '[]') meta[currentKey] = [];
      else if (value === '{}') meta[currentKey] = {};
      else if (value === '') meta[currentKey] = [];
      else meta[currentKey] = value;
    }
  }

  return { meta, body: content.slice(end + 5).replace(/^\r?\n/, '') };
}

function sourceHashes(rootPath, sources) {
  const hashes = {};
  for (const source of sources) {
    const full = path.join(rootPath, source);
    if (!fs.existsSync(full)) continue;
    try {
      hashes[source] = fileHash(full).slice(0, 16);
    } catch {}
  }
  return hashes;
}

function writePage(rootPath, filename, meta, body) {
  const pagePath = path.join(rootPath, WIKI_DIR, filename);
  fs.writeFileSync(pagePath, `${createFrontmatter(meta)}\n\n${body.trim()}\n`, 'utf8');
  return slash(path.relative(rootPath, pagePath));
}

function buildContext(rootPath) {
  const files = walkDir(rootPath);
  const relFiles = files.map(file => slash(path.relative(rootPath, file)));
  const packageInfo = getPackageInfo(rootPath);
  const languages = detectLanguages(files, rootPath);
  const framework = detectFramework(rootPath);
  const entryPoints = getEntryPoints(files, rootPath);
  const workspaceAnalysis = discoverWorkspaces(files, rootPath);
  const routeAnalysis = extractRoutes(files, rootPath, workspaceAnalysis.workspaces);
  const symbolFiles = files.filter(isSymbolFile).slice(0, 250);
  const symbolRows = [];
  const symbolMap = {};

  for (const file of symbolFiles) {
    const rel = slash(path.relative(rootPath, file));
    const symbols = extractSymbols(file);
    if (!symbols.length) continue;
    symbolMap[rel] = symbols;
    for (const symbol of symbols) {
      symbolRows.push({ path: rel, ...symbol });
    }
  }

  return {
    rootPath,
    files,
    relFiles,
    packageInfo,
    languages,
    framework,
    entryPoints,
    workspaces: workspaceAnalysis.workspaces,
    workspaceWarnings: workspaceAnalysis.warnings,
    routes: routeAnalysis.routes,
    routeWarnings: routeAnalysis.warnings,
    symbolRows,
    symbolMap,
    sourceCommit: getHeadCommit(rootPath) || 'unknown',
  };
}

function makeMeta(context, sources, confidence = 'medium') {
  return {
    status: 'draft',
    source_commit: context.sourceCommit,
    last_generated: nowIso(),
    sources,
    source_hashes: sourceHashes(context.rootPath, sources),
    confidence,
  };
}

function sourceLink(source) {
  return `[${source}](../../${source})`;
}

function workspaceLabel(workspace) {
  return workspace.root || '.';
}

function workspaceSummary(workspaces) {
  const nested = workspaces.filter(workspace => workspace.root);
  if (!nested.length) return 'Only the root workspace was analyzed.';
  return `Detected ${workspaces.length} workspace(s), including ${nested.length} nested workspace(s).`;
}

function renderWorkspaces(workspaces) {
  if (!workspaces.length) return 'No workspaces detected.';
  return workspaces.map(workspace => {
    const lines = [
      `### ${workspaceLabel(workspace)}`,
      '',
      `- Manifest: ${workspace.manifest ? sourceLink(workspace.manifest) : 'None detected.'}`,
      `- Type: ${workspace.manifestType}`,
      `- Name: ${workspace.name || 'unknown'}`,
      `- Language: ${workspace.language || 'unknown'}`,
      '',
      '#### Entrypoints',
      '',
      markdownList(workspace.entrypoints.map(entry => `${sourceLink(entry.path)} (${entry.kind}, ${entry.source}) - ${entry.reason}`)),
    ];
    if (workspace.warnings.length) {
      lines.push('', '#### Warnings', '', markdownList(workspace.warnings));
    }
    if (workspace.skippedEntrypoints.length) {
      lines.push('', '#### Skipped References', '', markdownList(workspace.skippedEntrypoints.map(entry => `${entry.path} (${entry.source}) - ${entry.reason}`)));
    }
    return lines.join('\n');
  }).join('\n\n');
}

function renderWorkspaceEntrypoints(workspaces, legacyEntryPoints = []) {
  const sections = workspaces.map(workspace => {
    const lines = [
      `### ${workspaceLabel(workspace)}`,
      '',
      markdownList(workspace.entrypoints.map(entry => `${sourceLink(entry.path)} (${entry.kind}, ${entry.source}) - ${entry.reason}`)),
    ];
    return lines.join('\n');
  });

  const workspaceEntrypoints = new Set(workspaces.flatMap(workspace => workspace.entrypoints.map(entry => entry.path)));
  const legacyOnly = legacyEntryPoints.filter(entry => !workspaceEntrypoints.has(entry));
  if (legacyOnly.length) {
    sections.push([
      '### Legacy Detection',
      '',
      markdownList(legacyOnly.map(entry => `${sourceLink(entry)} (legacy helper)`)),
    ].join('\n'));
  }

  return sections.length ? sections.join('\n\n') : 'None detected.';
}

function renderRoutes(routes) {
  if (!routes.length) return 'No routes detected.';
  const byWorkspace = new Map();
  for (const route of routes) {
    const key = route.workspace || '.';
    if (!byWorkspace.has(key)) byWorkspace.set(key, []);
    byWorkspace.get(key).push(route);
  }

  return [...byWorkspace.entries()].map(([workspace, workspaceRoutes]) => {
    const lines = [`### ${workspace}`, ''];
    for (const route of workspaceRoutes) {
      const handler = route.handler ? ` handler \`${route.handler}\`` : ' handler unknown';
      lines.push(`- \`${route.method} ${route.route}\` - ${sourceLink(route.path)}:${route.line} (${route.framework}, ${route.confidence}) -${handler}; ${route.reason}`);
    }
    return lines.join('\n');
  }).join('\n\n');
}

function createPages(context) {
  const packageSources = ['package.json', 'go.mod', 'Cargo.toml', 'pyproject.toml', 'setup.py']
    .filter(source => fs.existsSync(path.join(context.rootPath, source)));
  const readmeSources = ['README.md'].filter(source => fs.existsSync(path.join(context.rootPath, source)));
  const docsSources = context.relFiles.filter(file => /^docs\/.*\.md$/i.test(file)).slice(0, 50);
  const symbolSources = Object.keys(context.symbolMap).slice(0, 100);
  const entrySources = context.entryPoints.filter(source => fs.existsSync(path.join(context.rootPath, source)));
  const workspaceEntrySources = [...new Set(context.workspaces.flatMap(workspace => workspace.entrypoints.map(entry => entry.path)))];
  const allEntrySources = [...new Set([...workspaceEntrySources, ...entrySources])];
  const workspaceSources = [...new Set(context.workspaces.flatMap(workspace => [
    workspace.manifest,
    ...workspace.entrypoints.map(entry => entry.path),
  ]).filter(Boolean))];
  const routeSources = [...new Set(context.routes.map(route => route.path))];

  const languageLines = context.languages.map(lang => `${lang.name}: ${lang.files} files (${lang.percentage}%)`);
  const topDirs = [...new Set(context.relFiles.map(file => file.split('/')[0]).filter(Boolean))]
    .filter(dir => dir !== '.raptor')
    .slice(0, 20);

  const pages = [
    {
      filename: 'overview.md',
      sources: [...packageSources, ...readmeSources],
      confidence: packageSources.length || readmeSources.length ? 'high' : 'medium',
      body: `# Project Overview

## Summary

${context.packageInfo.description || `${context.packageInfo.name || path.basename(context.rootPath)} is a local codebase analyzed by Raptor.`}

## Package

- Name: ${context.packageInfo.name || path.basename(context.rootPath)}
- Version: ${context.packageInfo.version || 'unknown'}
- Source: ${context.packageInfo.source || 'directory name'}

## Stack

${markdownList(languageLines)}

## Framework

${context.framework || 'None detected.'}

## Source References

${markdownList([...packageSources, ...readmeSources].map(source => `[${source}](../../${source})`))}`,
    },
    {
      filename: 'architecture.md',
      sources: [...packageSources, ...allEntrySources],
      confidence: 'medium',
      body: `# Architecture

## Module Structure

${markdownList(topDirs.map(dir => `\`${dir}/\``))}

## Entry Points

${markdownList(context.entryPoints.map(entry => `[${entry}](../../${entry})`))}

## Data Flow

Raptor inferred the architecture from local source files, package metadata, entry points, and exported symbols. Treat this page as a reviewable draft until a human marks it reviewed.

## Related Pages

- [Project Overview](overview.md)
- [Workspaces](workspaces.md)
- [Symbols](symbols.md)`,
    },
    {
      filename: 'workspaces.md',
      sources: workspaceSources,
      confidence: context.workspaces.length ? 'medium' : 'low',
      body: `# Workspaces

## Summary

${workspaceSummary(context.workspaces)}

## Detected Workspaces

${renderWorkspaces(context.workspaces)}

## Build Warnings

${markdownList(context.workspaceWarnings)}

## Related Pages

- [Entrypoints](entrypoints.md)
- [Routes](routes.md)
- [Architecture](architecture.md)`,
    },
    {
      filename: 'entrypoints.md',
      sources: allEntrySources,
      confidence: allEntrySources.length ? 'high' : 'low',
      body: `# Entrypoints

## Detected Entrypoints

${renderWorkspaceEntrypoints(context.workspaces, context.entryPoints)}

## Notes

These files are likely startup, command-line, or application entrypoints based on conventional filenames. For CLI projects, the entrypoint is the file launched by the package binary or shell wrapper.`,
    },
    {
      filename: 'routes.md',
      sources: routeSources,
      confidence: context.routes.length ? 'medium' : 'low',
      body: `# Routes

## Summary

Detected ${context.routes.length} route(s).

## Detected Routes

${renderRoutes(context.routes)}

## Build Warnings

${markdownList(context.routeWarnings)}

## Related Pages

- [Architecture](architecture.md)
- [Symbols](symbols.md)`,
    },
    {
      filename: 'symbols.md',
      sources: symbolSources,
      confidence: symbolSources.length ? 'medium' : 'low',
      body: `# Symbols

## Symbol Inventory

${symbolSources.length ? symbolSources.map(file => {
  const lines = context.symbolMap[file].map(symbol => `- \`${symbol.name}\` (${symbol.kind})`);
  return `### ${file}\n\n${lines.join('\n')}`;
}).join('\n\n') : 'No symbols detected.'}`,
    },
    {
      filename: 'documentation.md',
      sources: [...readmeSources, ...docsSources],
      confidence: readmeSources.length || docsSources.length ? 'high' : 'low',
      body: `# Documentation Map

## Existing Documentation

${markdownList([...readmeSources, ...docsSources].map(source => `[${source}](../../${source})`))}

## Exported Indexes

- [llms.txt](../../llms.txt)
- [llms-full.txt](../../llms-full.txt)`,
    },
  ];

  return pages.map(page => ({
    ...page,
    path: writePage(context.rootPath, page.filename, makeMeta(context, page.sources, page.confidence), page.body),
  }));
}

function pageTitle(body, fallback) {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback.replace(/\.md$/, '');
}

function createChunks(rootPath, pageFiles) {
  const chunks = [];
  for (const pageFile of pageFiles) {
    const full = path.join(rootPath, pageFile);
    const { meta, body } = parseFrontmatter(readText(full));
    const relPage = slash(path.relative(path.join(rootPath, WIKI_DIR), full));
    const sections = body.split(/\n(?=##\s+)/);
    sections.forEach((section, index) => {
      const heading = section.match(/^#{1,3}\s+(.+)$/m)?.[1] || pageTitle(body, relPage);
      chunks.push({
        id: `${relPage}#${index + 1}`,
        page: relPage,
        status: meta?.status || 'draft',
        title: pageTitle(body, relPage),
        heading,
        text: section.trim().slice(0, 4000),
      });
    });
  }
  return chunks;
}

function refreshChunkIndex(rootPath) {
  const pages = listWikiPages(rootPath).map(page => slash(path.relative(rootPath, page)));
  const chunks = createChunks(rootPath, pages);
  writeJsonl(path.join(rootPath, INDEX_DIR, 'chunks.jsonl'), chunks);
  return chunks.length;
}

function createLinks(rootPath, pageFiles) {
  const pageNames = new Set(pageFiles.map(file => slash(path.relative(path.join(rootPath, WIKI_DIR), path.join(rootPath, file)))));
  const links = { page_to_page: {}, page_to_sources: {} };

  for (const pageFile of pageFiles) {
    const full = path.join(rootPath, pageFile);
    const relPage = slash(path.relative(path.join(rootPath, WIKI_DIR), full));
    const { meta, body } = parseFrontmatter(readText(full));
    const internal = [];
    const sourceLinks = [];
    let match;
    const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;
    while ((match = linkRe.exec(body)) !== null) {
      const target = match[1];
      if (target.endsWith('.md') && pageNames.has(target)) internal.push(target);
      if (target.startsWith('../../')) sourceLinks.push(target.slice(6));
    }
    links.page_to_page[relPage] = [...new Set(internal)];
    links.page_to_sources[relPage] = [...new Set([...(meta?.sources || []), ...sourceLinks])];
  }
  return links;
}

function writeJsonl(filePath, rows) {
  fs.writeFileSync(filePath, rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''), 'utf8');
}

function writeIndexes(context, pages) {
  const pageFiles = pages.map(page => page.path);
  const chunks = createChunks(context.rootPath, pageFiles);
  const symbols = context.symbolRows;
  const routes = context.routes;
  const links = createLinks(context.rootPath, pageFiles);

  writeJsonl(path.join(context.rootPath, INDEX_DIR, 'chunks.jsonl'), chunks);
  writeJsonl(path.join(context.rootPath, INDEX_DIR, 'symbols.jsonl'), symbols);
  writeJsonl(path.join(context.rootPath, INDEX_DIR, 'routes.jsonl'), routes);
  fs.writeFileSync(path.join(context.rootPath, INDEX_DIR, 'links.json'), JSON.stringify(links, null, 2) + '\n', 'utf8');

  return { chunks: chunks.length, symbols: symbols.length, routes: routes.length, links };
}

function writeManifest(context, indexStats) {
  const manifest = {
    schema_version: SCHEMA_VERSION,
    source_commit: context.sourceCommit,
    generated_at: nowIso(),
    wiki_pages: fs.readdirSync(path.join(context.rootPath, WIKI_DIR)).filter(file => file.endsWith('.md')).length,
    index: {
      chunks: indexStats.chunks,
      symbols: indexStats.symbols,
      routes: indexStats.routes,
    },
  };
  fs.writeFileSync(path.join(context.rootPath, '.raptor', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return manifest;
}

function writeLlmsExports(rootPath) {
  const wikiPath = path.join(rootPath, WIKI_DIR);
  const pages = fs.readdirSync(wikiPath).filter(file => file.endsWith('.md')).sort();
  const summaries = pages.map(file => {
    const { body } = parseFrontmatter(readText(path.join(wikiPath, file)));
    return { file, title: pageTitle(body, file), excerpt: body.replace(/^#.+$/m, '').trim().split(/\s+/).slice(0, 40).join(' ') };
  });

  const llms = [
    '# Raptor Wiki',
    '',
    '> Local, reviewable project wiki generated by Raptor. This export is a convenience index for LLM tools, not a provider-guaranteed standard.',
    '',
    '## Wiki Pages',
    '',
    ...summaries.map(page => `- [${page.title}](./.raptor/wiki/${page.file}): ${page.excerpt || 'Wiki page.'}`),
    '',
  ].join('\n');

  const full = [
    '# Raptor Wiki Full Export',
    '',
    'This file concatenates the local `.raptor/wiki` pages for tools that prefer a single Markdown context file.',
    '',
    ...pages.map(file => {
      const content = readText(path.join(wikiPath, file));
      return `<!-- source: .raptor/wiki/${file} -->\n\n${content}`;
    }),
    '',
  ].join('\n');

  fs.writeFileSync(path.join(rootPath, 'llms.txt'), llms, 'utf8');
  fs.writeFileSync(path.join(rootPath, 'llms-full.txt'), full, 'utf8');
}

function wikiInit(argv) {
  const json = argv.includes('--json');
  const targetPath = parsePathArg(argv);
  if (!fs.existsSync(targetPath)) return outputError(`Path does not exist: ${targetPath}`, json);
  ensureRaptor(targetPath);
  const manifestPath = path.join(targetPath, '.raptor', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(manifestPath, JSON.stringify({
      schema_version: SCHEMA_VERSION,
      source_commit: getHeadCommit(targetPath) || 'unknown',
      generated_at: null,
      wiki_pages: 0,
      index: { chunks: 0, symbols: 0 },
    }, null, 2) + '\n', 'utf8');
  }
  output({
    path: targetPath,
    created: [WIKI_DIR, INDEX_DIR, path.join('.raptor', 'manifest.json')],
  }, json);
}

function wikiBuild(argv) {
  const json = argv.includes('--json');
  const targetPath = parsePathArg(argv);
  if (!fs.existsSync(targetPath)) return outputError(`Path does not exist: ${targetPath}`, json);
  ensureRaptor(targetPath);
  const context = buildContext(targetPath);
  const pages = createPages(context);
  const indexStats = writeIndexes(context, pages);
  const manifest = writeManifest(context, indexStats);
  writeLlmsExports(targetPath);
  output({
    path: targetPath,
    source_commit: context.sourceCommit,
    pages: pages.map(page => page.path),
    index: { chunks: indexStats.chunks, symbols: indexStats.symbols, routes: indexStats.routes },
    manifest,
    exports: ['llms.txt', 'llms-full.txt'],
  }, json);
}

function listWikiPages(rootPath) {
  const wikiPath = path.join(rootPath, WIKI_DIR);
  if (!fs.existsSync(wikiPath)) return [];
  return fs.readdirSync(wikiPath)
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(wikiPath, file));
}

function validatePage(rootPath, pagePath, pageNames) {
  const rel = slash(path.relative(path.join(rootPath, WIKI_DIR), pagePath));
  const errors = [];
  const warnings = [];
  const { meta, body } = parseFrontmatter(readText(pagePath));

  if (!meta) {
    errors.push('missing frontmatter');
    return { page: rel, status: 'invalid', stale: false, errors, warnings };
  }

  for (const key of ['status', 'source_commit', 'last_generated', 'sources', 'confidence']) {
    if (meta[key] === undefined) errors.push(`missing frontmatter field: ${key}`);
  }
  if (!PAGE_STATUS.has(meta.status)) errors.push(`invalid status: ${meta.status}`);

  const missingSources = [];
  const changedSources = [];
  const sources = Array.isArray(meta.sources) ? meta.sources : [];
  for (const source of sources) {
    const full = path.join(rootPath, source);
    if (!fs.existsSync(full)) {
      missingSources.push(source);
      continue;
    }
    const expected = meta.source_hashes?.[source];
    if (expected) {
      const actual = fileHash(full).slice(0, 16);
      if (actual !== expected) changedSources.push(source);
    }
  }
  if (missingSources.length) errors.push(`missing sources: ${missingSources.join(', ')}`);
  if (changedSources.length) warnings.push(`stale sources: ${changedSources.join(', ')}`);

  const brokenLinks = [];
  let match;
  const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;
  while ((match = linkRe.exec(body)) !== null) {
    const target = match[1].split('#')[0];
    if (!target || /^https?:\/\//.test(target)) continue;
    if (target.endsWith('.md') && !target.startsWith('../') && !pageNames.has(target)) brokenLinks.push(target);
    if (target.startsWith('../../') && !fs.existsSync(path.join(rootPath, target.slice(6)))) brokenLinks.push(target);
  }
  if (brokenLinks.length) errors.push(`broken links: ${[...new Set(brokenLinks)].join(', ')}`);

  const currentCommit = getHeadCommit(rootPath) || 'unknown';
  const stale = changedSources.length > 0 || (meta.source_commit !== 'unknown' && currentCommit !== 'unknown' && meta.source_commit !== currentCommit);
  return { page: rel, status: meta.status, stale, errors, warnings };
}

function wikiValidate(argv) {
  const json = argv.includes('--json');
  const targetPath = parsePathArg(argv);
  if (!fs.existsSync(targetPath)) return outputError(`Path does not exist: ${targetPath}`, json);
  const pages = listWikiPages(targetPath);
  const pageNames = new Set(pages.map(page => slash(path.relative(path.join(targetPath, WIKI_DIR), page))));
  const results = pages.map(page => validatePage(targetPath, page, pageNames));
  const errors = results.flatMap(page => page.errors.map(error => `${page.page}: ${error}`));
  const warnings = results.flatMap(page => page.warnings.map(warning => `${page.page}: ${warning}`));
  output({
    ok: errors.length === 0,
    pages: results,
    errors,
    warnings,
  }, json);
  if (!json && errors.length) process.exitCode = 1;
}

function wikiStatus(argv) {
  const json = argv.includes('--json');
  const targetPath = parsePathArg(argv);
  if (!fs.existsSync(targetPath)) return outputError(`Path does not exist: ${targetPath}`, json);
  const pages = listWikiPages(targetPath);
  const pageNames = new Set(pages.map(page => slash(path.relative(path.join(targetPath, WIKI_DIR), page))));
  const validation = pages.map(page => validatePage(targetPath, page, pageNames));
  const status = { draft: [], reviewed: [], stale: [] };
  for (const page of validation) {
    if (page.stale || page.status === 'stale') status.stale.push(page.page);
    else if (page.status === 'reviewed') status.reviewed.push(page.page);
    else status.draft.push(page.page);
  }
  output({ path: targetPath, ...status, pages: validation }, json);
}

function normalizePageName(page) {
  const normalized = slash(page).replace(/^\.raptor\/wiki\//, '');
  return normalized.endsWith('.md') ? normalized : `${normalized}.md`;
}

function parseReviewArgs(argv) {
  const json = argv.includes('--json');
  const all = argv.includes('--all');
  const nonFlags = argv.filter(arg => !arg.startsWith('--'));
  let targetPath = process.cwd();
  let page = null;

  if (all) {
    if (nonFlags.length > 0) targetPath = path.resolve(nonFlags[0]);
  } else {
    page = nonFlags[0] ? normalizePageName(nonFlags[0]) : null;
    if (nonFlags.length > 1) targetPath = path.resolve(nonFlags[1]);
  }

  return { json, all, page, targetPath };
}

function writeReviewedPage(pagePath) {
  const content = readText(pagePath);
  const { meta, body } = parseFrontmatter(content);
  if (!meta) return { ok: false, error: 'missing frontmatter' };
  meta.status = 'reviewed';
  fs.writeFileSync(pagePath, `${createFrontmatter(meta)}\n\n${body.trim()}\n`, 'utf8');
  return { ok: true };
}

function wikiReview(argv) {
  const { json, all, page, targetPath } = parseReviewArgs(argv);
  if (!fs.existsSync(targetPath)) return outputError(`Path does not exist: ${targetPath}`, json);
  if (!all && !page) return outputError('wiki review requires <page> or --all', json);

  const pages = listWikiPages(targetPath);
  if (!pages.length) return outputError('Raptor wiki not found. Run "raptor wiki build" first.', json);
  const pageNames = new Set(pages.map(pagePath => slash(path.relative(path.join(targetPath, WIKI_DIR), pagePath))));
  const selected = all
    ? pages
    : pages.filter(pagePath => slash(path.relative(path.join(targetPath, WIKI_DIR), pagePath)) === page);

  if (!selected.length) return outputError(`Wiki page not found: ${page}`, json);

  const reviewed = [];
  const skipped = [];
  for (const pagePath of selected) {
    const relPage = slash(path.relative(path.join(targetPath, WIKI_DIR), pagePath));
    const validation = validatePage(targetPath, pagePath, pageNames);
    if (validation.errors.length) {
      skipped.push({ page: relPage, errors: validation.errors });
      continue;
    }
    const result = writeReviewedPage(pagePath);
    if (result.ok) reviewed.push(relPage);
    else skipped.push({ page: relPage, errors: [result.error] });
  }

  const chunks = refreshChunkIndex(targetPath);
  output({ path: targetPath, reviewed, skipped, index: { chunks } }, json);
}

const QUERY_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'for', 'from', 'how', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'where',
  'che', 'chi', 'come', 'con', 'cosa', 'da', 'dei', 'del', 'della', 'delle', 'di', 'gli', 'il', 'la', 'le', 'lo',
  'nel', 'nella', 'per', 'si', 'un', 'una', 'uno',
]);

const QUERY_SYNONYMS = {
  aggiunge: ['add', 'create'],
  aggiungere: ['add', 'create'],
  crea: ['create', 'add', 'new'],
  creare: ['create', 'add', 'new'],
  creazione: ['create', 'creation', 'new'],
  nuova: ['new', 'create'],
  nuovo: ['new', 'create'],
  registra: ['register', 'signup', 'create'],
  registrare: ['register', 'signup', 'create'],
  account: ['user', 'users', 'profile', 'auth', 'authentication'],
  profilo: ['profile', 'user', 'account'],
  utenza: ['user', 'users', 'account', 'accounts', 'profile', 'profiles', 'auth', 'authentication'],
  utenze: ['user', 'users', 'account', 'accounts', 'profile', 'profiles', 'auth', 'authentication'],
  utente: ['user', 'users', 'account', 'accounts', 'profile', 'profiles', 'auth', 'authentication'],
  utenti: ['user', 'users', 'account', 'accounts', 'profile', 'profiles', 'auth', 'authentication'],
};

function tokenize(value) {
  return String(value).toLowerCase().split(/[^a-z0-9_./-]+/)
    .filter(token => token.length > 1 && !QUERY_STOPWORDS.has(token));
}

function expandQueryTerms(terms) {
  const expanded = [];
  const seen = new Set();
  for (const term of terms) {
    const additions = [term, ...(QUERY_SYNONYMS[term] || [])];
    for (const addition of additions) {
      if (seen.has(addition)) continue;
      seen.add(addition);
      expanded.push(addition);
    }
  }
  return expanded;
}

function loadJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return readText(filePath).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function parseQueryArgs(argv) {
  const json = argv.includes('--json');
  const nonFlags = argv.filter(arg => !arg.startsWith('--'));
  let targetPath = process.cwd();
  let questionParts = nonFlags;
  if (nonFlags.length > 1) {
    const last = path.resolve(nonFlags[nonFlags.length - 1]);
    if (fs.existsSync(last) && fs.statSync(last).isDirectory()) {
      targetPath = last;
      questionParts = nonFlags.slice(0, -1);
    }
  }
  return { json, targetPath, question: questionParts.join(' ').trim() };
}

function snippet(text, terms) {
  const lower = text.toLowerCase();
  let index = 0;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found !== -1) {
      index = Math.max(0, found - 100);
      break;
    }
  }
  return text.slice(index, index + 320).replace(/\s+/g, ' ').trim();
}

function hasSourcePath(text) {
  return /[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|java)\b/.test(text);
}

function scoreSymbol(symbol, terms) {
  const name = symbol.name.toLowerCase();
  const sourcePath = symbol.path.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (name === term) score += 100;
    else if (name.startsWith(term)) score += 40;
    else if (name.includes(term)) score += 20;
    if (sourcePath.includes(term)) score += 5;
  }
  return score;
}

function extractSourcePaths(text) {
  const sources = [];
  const seen = new Set();
  const patterns = [
    /\[[^\]]+\]\(\.\.\/\.\.\/([^)]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|java))\)/g,
    /\b([A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|java))\b/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (seen.has(match[1])) continue;
      seen.add(match[1]);
      sources.push(match[1]);
    }
  }
  return sources;
}

const ROUTE_QUERY_TERMS = new Set([
  'api', 'apis', 'endpoint', 'endpoints', 'route', 'routes', 'controller', 'controllers',
  'backend', 'service', 'services', 'post', 'get', 'put', 'delete', 'patch',
]);

const ACCOUNT_QUERY_TERMS = new Set([
  'account', 'accounts', 'auth', 'authentication', 'profile', 'profiles', 'role', 'roles',
  'user', 'users', 'utenza', 'utenze', 'utente', 'utenti',
]);

const PROCEDURAL_QUERY_TERMS = new Set([
  'add', 'create', 'creation', 'new', 'register', 'signup',
]);

function isRouteQuery(terms) {
  const hasRouteTerm = terms.some(term => ROUTE_QUERY_TERMS.has(term));
  const hasAccountTerm = terms.some(term => ACCOUNT_QUERY_TERMS.has(term));
  const hasProceduralTerm = terms.some(term => PROCEDURAL_QUERY_TERMS.has(term));
  return hasRouteTerm || (hasAccountTerm && hasProceduralTerm);
}

function scoreRoute(route, terms, routeRelated) {
  if (!routeRelated) return 0;

  const method = String(route.method || '').toLowerCase();
  const routePath = String(route.route || '').toLowerCase();
  const sourcePath = String(route.path || '').toLowerCase();
  const handler = String(route.handler || '').toLowerCase();
  const framework = String(route.framework || '').toLowerCase();
  const haystackTokens = tokenize([method, routePath, sourcePath, handler, framework].join(' '));
  let score = 0;

  for (const term of terms) {
    if (method === term) score += 30;
    if (routePath === term || routePath === `/${term}`) score += 60;
    if (routePath.includes(term)) score += 35;
    if (handler === term) score += 45;
    if (handler.includes(term)) score += 20;
    if (sourcePath.includes(term)) score += 12;
    if (framework.includes(term)) score += 8;
    score += haystackTokens.filter(token => token.includes(term)).length * 4;
  }

  if (route.confidence === 'high') score += 8;
  if (route.confidence === 'low') score -= 4;
  return score;
}

function formatRouteEvidence(route) {
  const location = route.line ? `${route.path}:${route.line}` : route.path;
  const details = [route.framework, route.confidence ? `${route.confidence} confidence` : null]
    .filter(Boolean)
    .join(', ');
  const suffix = details ? ` (${details})` : '';
  return `${route.method} ${route.route} -> ${location}${suffix}`;
}

function formatQueryText(data) {
  const lines = [`Question: ${data.question}`];
  if (!data.results.length) {
    lines.push('', 'No wiki matches found.');
    return lines.join('\n');
  }

  const best = data.results[0];
  const bestSymbol = best.page === 'symbols.md' ? data.symbols[0] : null;
  const bestRoute = data.routes && data.routes.length ? data.routes[0] : null;
  lines.push('', `Best match: ${best.page} / ${best.heading} (${best.status})`);
  if (bestRoute && best.page === 'routes.md') {
    lines.push(`Answer: ${formatRouteEvidence(bestRoute)}`);
  } else if (bestSymbol) {
    lines.push(`Answer: ${bestSymbol.path} (${bestSymbol.kind} ${bestSymbol.name})`);
  } else if (best.sources.length) {
    lines.push(`Answer: ${best.sources[0]}`);
  } else {
    lines.push(`Answer: ${best.excerpt}`);
  }

  if (bestRoute && best.page !== 'routes.md') {
    lines.push(`Route evidence: ${formatRouteEvidence(bestRoute)}`);
  }

  lines.push('', 'Top results:');
  for (const result of data.results.slice(0, 5)) {
    const displaySource = result.page === 'symbols.md' && data.symbols.length ? data.symbols[0].path : result.sources[0];
    const sourceSuffix = displaySource ? ` -> ${displaySource}` : '';
    lines.push(`- ${result.page} / ${result.heading} (${result.status}, score ${result.score})${sourceSuffix}`);
  }

  const sourcePaths = [...new Set([
    ...(data.routes || []).map(route => route.path),
    ...data.symbols.map(symbol => symbol.path),
    ...data.results.flatMap(result => result.sources),
  ])].slice(0, 8);
  if (sourcePaths.length) {
    lines.push('', 'Sources:');
    for (const source of sourcePaths) lines.push(`- ${source}`);
  }

  if (data.warnings.length) {
    lines.push('', 'Warnings:');
    for (const warning of data.warnings) lines.push(`- ${warning}`);
  }

  return lines.join('\n');
}

function query(argv) {
  const { json, targetPath, question } = parseQueryArgs(argv);
  if (!question) return outputError('query question is required', json);
  const chunksPath = path.join(targetPath, INDEX_DIR, 'chunks.jsonl');
  if (!fs.existsSync(chunksPath)) {
    return outputError('Raptor wiki index not found. Run "raptor wiki build" first.', json);
  }

  const terms = expandQueryTerms(tokenize(question));
  const launchTerms = new Set([
    'workspace', 'workspaces', 'frontend', 'backend', 'app',
    'entrypoint', 'entrypoints', 'start', 'started', 'starts', 'startup',
    'run', 'runs', 'launch', 'launched', 'bootstrap', 'bootstrapped',
    'dev', 'serve',
  ]);
  const startupTerms = new Set(['entrypoint', 'entrypoints', 'start', 'started', 'starts', 'startup', 'run', 'runs', 'launch', 'launched', 'bootstrap', 'bootstrapped']);
  const startupRelated = terms.some(term => startupTerms.has(term));
  const chunks = loadJsonl(chunksPath);
  const symbols = loadJsonl(path.join(targetPath, INDEX_DIR, 'symbols.jsonl'));
  const routes = loadJsonl(path.join(targetPath, INDEX_DIR, 'routes.jsonl'));
  const routeRelated = isRouteQuery(terms);
  const routeHits = routes
    .map(route => ({ ...route, _score: scoreRoute(route, terms, routeRelated) }))
    .filter(route => route._score > 0)
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...route }) => route);
  const scoredSymbols = symbols
    .map(symbol => ({ ...symbol, _score: scoreSymbol(symbol, terms) }))
    .filter(symbol => symbol._score > 0)
    .sort((a, b) => b._score - a._score);
  const symbolSourceScores = new Map();
  for (const symbol of scoredSymbols) {
    symbolSourceScores.set(symbol.path, Math.max(symbolSourceScores.get(symbol.path) || 0, symbol._score));
  }
  const symbolHits = scoredSymbols
    .map(({ _score, ...symbol }) => symbol);

  const results = chunks.map(chunk => {
    const sources = extractSourcePaths(chunk.text);
    const haystacks = {
      title: tokenize(chunk.title),
      heading: tokenize(chunk.heading),
      page: tokenize(chunk.page),
      text: tokenize(chunk.text),
    };
    let score = 0;
    for (const term of terms) {
      if (haystacks.title.includes(term)) score += 8;
      if (haystacks.heading.includes(term)) score += 5;
      if (chunk.title.toLowerCase().includes(term)) score += 8;
      if (chunk.heading.toLowerCase().includes(term)) score += 6;
      if (chunk.page.toLowerCase().includes(term)) score += 10;
      if (haystacks.page.some(token => token.includes(term))) score += 4;
      score += haystacks.text.filter(token => token.includes(term)).length;
      if (launchTerms.has(term) && ['entrypoints.md', 'workspaces.md'].includes(chunk.page)) score += 18;
      if (['entrypoints.md', 'workspaces.md'].includes(chunk.page) && haystacks.text.some(token => token.includes('/') && token.includes(term))) score += 12;
      if (routeRelated && chunk.page === 'routes.md' && haystacks.text.some(token => token.includes('/') && token.includes(term))) score += 20;
    }
    if (routeRelated && chunk.page === 'routes.md') score += routeHits.length ? 45 : 20;
    if (routeRelated && chunk.page === 'routes.md' && hasSourcePath(chunk.text)) score += 25;
    if (routeRelated && chunk.page === 'symbols.md' && routeHits.length) score -= 20;
    if (chunk.page === 'symbols.md') {
      const sourceScore = Math.max(0, ...sources.map(source => symbolSourceScores.get(source) || 0));
      score += Math.min(120, sourceScore);
    }
    if (startupRelated && chunk.page === 'entrypoints.md') score += 40;
    if (startupRelated && chunk.page === 'workspaces.md') score += 20;
    if (startupRelated && ['entrypoints.md', 'workspaces.md'].includes(chunk.page) && hasSourcePath(chunk.text)) score += 35;
    if (startupRelated && chunk.heading.toLowerCase() === 'notes') score -= 35;
    if (startupRelated && chunk.page === 'symbols.md') score -= 50;
    if (chunk.status !== 'reviewed') score -= 0.25;
    const excerpt = snippet(chunk.text, terms);
    return {
      page: chunk.page,
      heading: chunk.heading,
      status: chunk.status,
      score,
      excerpt,
      sources,
    };
  }).filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const staleOrDraft = [...new Set(results.filter(result => result.status !== 'reviewed').map(result => result.page))];
  const data = {
    question,
    results,
    routes: routeHits.slice(0, 20),
    symbols: symbolHits.slice(0, 20),
    warnings: staleOrDraft.length ? [`Results include non-reviewed pages: ${staleOrDraft.join(', ')}`] : [],
  };
  if (json) output(data, json);
  else console.log(formatQueryText(data));
}

function wiki(argv) {
  const subcommand = argv[0];
  const rest = argv.slice(1);
  if (subcommand === 'init') return wikiInit(rest);
  if (subcommand === 'build') return wikiBuild(rest);
  if (subcommand === 'validate') return wikiValidate(rest);
  if (subcommand === 'status') return wikiStatus(rest);
  if (subcommand === 'review') return wikiReview(rest);
  const json = argv.includes('--json');
  return outputError('wiki subcommand is required: init, build, validate, status, review', json);
}

module.exports = {
  wiki,
  query,
  parseFrontmatter,
  createFrontmatter,
  tokenize,
};
