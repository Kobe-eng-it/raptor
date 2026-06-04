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

function createPages(context) {
  const packageSources = ['package.json', 'go.mod', 'Cargo.toml', 'pyproject.toml', 'setup.py']
    .filter(source => fs.existsSync(path.join(context.rootPath, source)));
  const readmeSources = ['README.md'].filter(source => fs.existsSync(path.join(context.rootPath, source)));
  const docsSources = context.relFiles.filter(file => /^docs\/.*\.md$/i.test(file)).slice(0, 50);
  const symbolSources = Object.keys(context.symbolMap).slice(0, 100);
  const entrySources = context.entryPoints.filter(source => fs.existsSync(path.join(context.rootPath, source)));

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
      sources: [...packageSources, ...entrySources],
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
- [Symbols](symbols.md)`,
    },
    {
      filename: 'entrypoints.md',
      sources: entrySources,
      confidence: entrySources.length ? 'high' : 'low',
      body: `# Entrypoints

## Detected Entrypoints

${markdownList(context.entryPoints.map(entry => `[${entry}](../../${entry})`))}

## Notes

These files are likely startup, command-line, or application entrypoints based on conventional filenames. For CLI projects, the entrypoint is the file launched by the package binary or shell wrapper.`,
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
  const links = createLinks(context.rootPath, pageFiles);

  writeJsonl(path.join(context.rootPath, INDEX_DIR, 'chunks.jsonl'), chunks);
  writeJsonl(path.join(context.rootPath, INDEX_DIR, 'symbols.jsonl'), symbols);
  fs.writeFileSync(path.join(context.rootPath, INDEX_DIR, 'links.json'), JSON.stringify(links, null, 2) + '\n', 'utf8');

  return { chunks: chunks.length, symbols: symbols.length, links };
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
    index: { chunks: indexStats.chunks, symbols: indexStats.symbols },
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

function tokenize(value) {
  const stopwords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'for', 'from', 'how', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'where']);
  return String(value).toLowerCase().split(/[^a-z0-9_./-]+/)
    .filter(token => token.length > 1 && !stopwords.has(token));
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

function query(argv) {
  const { json, targetPath, question } = parseQueryArgs(argv);
  if (!question) return outputError('query question is required', json);
  const chunksPath = path.join(targetPath, INDEX_DIR, 'chunks.jsonl');
  if (!fs.existsSync(chunksPath)) {
    return outputError('Raptor wiki index not found. Run "raptor wiki build" first.', json);
  }

  const terms = tokenize(question);
  const chunks = loadJsonl(chunksPath);
  const symbols = loadJsonl(path.join(targetPath, INDEX_DIR, 'symbols.jsonl'));
  const symbolHits = symbols.filter(symbol => terms.some(term => symbol.name.toLowerCase().includes(term) || symbol.path.toLowerCase().includes(term)));

  const results = chunks.map(chunk => {
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
    }
    if (chunk.status !== 'reviewed') score -= 0.25;
    return {
      page: chunk.page,
      heading: chunk.heading,
      status: chunk.status,
      score,
      excerpt: snippet(chunk.text, terms),
    };
  }).filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const staleOrDraft = [...new Set(results.filter(result => result.status !== 'reviewed').map(result => result.page))];
  output({
    question,
    results,
    symbols: symbolHits.slice(0, 20),
    warnings: staleOrDraft.length ? [`Results include non-reviewed pages: ${staleOrDraft.join(', ')}`] : [],
  }, json);
}

function wiki(argv) {
  const subcommand = argv[0];
  const rest = argv.slice(1);
  if (subcommand === 'init') return wikiInit(rest);
  if (subcommand === 'build') return wikiBuild(rest);
  if (subcommand === 'validate') return wikiValidate(rest);
  if (subcommand === 'status') return wikiStatus(rest);
  const json = argv.includes('--json');
  return outputError('wiki subcommand is required: init, build, validate, status', json);
}

module.exports = {
  wiki,
  query,
  parseFrontmatter,
  createFrontmatter,
  tokenize,
};
