'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { wiki, query, parseFrontmatter, createFrontmatter, tokenize } = require('../src/wiki');
const { extractSymbols } = require('../src/symbols');
const { walkDir } = require('../src/util');
const { discoverWorkspaces } = require('../src/workspaces');

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raptor-test-'));
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'fixture-cli',
    version: '1.0.0',
    description: 'Fixture CLI project',
    bin: { fixture: './bin/fixture.js' },
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'bin', 'raptor.js'), '#!/usr/bin/env node\nrequire("../src/index").main();\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'src', 'index.js'), 'exports.main = function main() { return "ok"; };\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'src', 'api.py'), 'def handle_request():\n    return True\n\nclass Worker:\n    pass\n', 'utf8');
  return dir;
}

function nestedFrontendRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raptor-nested-'));
  fs.mkdirSync(path.join(dir, 'frontend', 'gui', 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'frontend', 'gui', 'package.json'), JSON.stringify({
    name: 'avepa-gui',
    scripts: { dev: 'vite' },
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'frontend', 'gui', 'vite.config.ts'), 'export default {};\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'frontend', 'gui', 'src', 'main.tsx'), 'console.log("main");\n', 'utf8');
  return dir;
}

function capture(fn) {
  const original = console.log;
  const lines = [];
  console.log = (value) => lines.push(value);
  try {
    fn();
  } finally {
    console.log = original;
  }
  return JSON.parse(lines.join('\n'));
}

test('frontmatter round-trips required wiki metadata', () => {
  const fm = createFrontmatter({
    status: 'draft',
    source_commit: 'abc',
    last_generated: '2026-06-04T00:00:00.000Z',
    sources: ['package.json'],
    source_hashes: { 'package.json': 'deadbeef' },
    confidence: 'high',
  });
  const parsed = parseFrontmatter(`${fm}\n\n# Page`);
  assert.equal(parsed.meta.status, 'draft');
  assert.deepEqual(parsed.meta.sources, ['package.json']);
  assert.equal(parsed.meta.source_hashes['package.json'], 'deadbeef');
});

test('symbol extraction covers CommonJS, Python, and CLI fixture symbols', () => {
  const dir = tempRepo();
  const jsSymbols = extractSymbols(path.join(dir, 'src', 'index.js')).map(symbol => symbol.name);
  const pySymbols = extractSymbols(path.join(dir, 'src', 'api.py')).map(symbol => symbol.name);
  assert.ok(jsSymbols.includes('main'));
  assert.ok(pySymbols.includes('handle_request'));
  assert.ok(pySymbols.includes('Worker'));
});

test('wiki build creates pages, indexes, manifest, and llms exports', () => {
  const dir = tempRepo();
  const result = capture(() => wiki(['build', dir, '--json']));
  assert.equal(result.ok, true);
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'wiki', 'overview.md')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'wiki', 'workspaces.md')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'index', 'chunks.jsonl')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'index', 'symbols.jsonl')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'index', 'links.json')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'manifest.json')));
  assert.ok(fs.existsSync(path.join(dir, 'llms.txt')));
  assert.ok(fs.existsSync(path.join(dir, 'llms-full.txt')));
});

test('wiki build renders nested workspaces and groups entrypoints by workspace', () => {
  const dir = nestedFrontendRepo();
  const result = capture(() => wiki(['build', dir, '--json']));
  assert.equal(result.ok, true);

  const workspaces = fs.readFileSync(path.join(dir, '.raptor', 'wiki', 'workspaces.md'), 'utf8');
  const entrypoints = fs.readFileSync(path.join(dir, '.raptor', 'wiki', 'entrypoints.md'), 'utf8');

  assert.ok(workspaces.includes('### frontend/gui'));
  assert.ok(workspaces.includes('[frontend/gui/package.json](../../frontend/gui/package.json)'));
  assert.ok(workspaces.includes('[frontend/gui/src/main.tsx](../../frontend/gui/src/main.tsx)'));
  assert.ok(entrypoints.includes('### frontend/gui'));
  assert.ok(entrypoints.includes('[frontend/gui/src/main.tsx](../../frontend/gui/src/main.tsx)'));
});

test('wiki validate reports stale source hashes after source changes', () => {
  const dir = tempRepo();
  capture(() => wiki(['build', dir, '--json']));
  fs.appendFileSync(path.join(dir, 'src', 'index.js'), '\nexports.extra = 1;\n', 'utf8');
  const result = capture(() => wiki(['validate', dir, '--json']));
  assert.equal(result.ok, true);
  assert.equal(result.result.ok, true);
  assert.ok(result.result.pages.some(page => page.stale));
});

test('wiki validate reports stale and missing nested workspace sources', () => {
  const staleDir = nestedFrontendRepo();
  capture(() => wiki(['build', staleDir, '--json']));
  fs.appendFileSync(path.join(staleDir, 'frontend', 'gui', 'package.json'), '\n', 'utf8');
  const staleResult = capture(() => wiki(['validate', staleDir, '--json']));
  const staleWorkspacePage = staleResult.result.pages.find(page => page.page === 'workspaces.md');
  assert.equal(staleWorkspacePage.stale, true);
  assert.ok(staleWorkspacePage.warnings.some(warning => warning.includes('frontend/gui/package.json')));

  const missingDir = nestedFrontendRepo();
  capture(() => wiki(['build', missingDir, '--json']));
  fs.unlinkSync(path.join(missingDir, 'frontend', 'gui', 'src', 'main.tsx'));
  const missingResult = capture(() => wiki(['validate', missingDir, '--json']));
  const missingWorkspacePage = missingResult.result.pages.find(page => page.page === 'workspaces.md');
  assert.ok(missingWorkspacePage.errors.some(error => error.includes('missing sources')));
  assert.ok(missingResult.result.errors.some(error => error.includes('frontend/gui/src/main.tsx')));
});

test('query ranks entrypoint page for CLI entrypoint question and warns on draft pages', () => {
  const dir = tempRepo();
  capture(() => wiki(['build', dir, '--json']));
  const result = capture(() => query(['where is the CLI entrypoint?', dir, '--json']));
  assert.equal(result.ok, true);
  assert.equal(result.result.results[0].page, 'entrypoints.md');
  assert.ok(result.result.warnings[0].includes('non-reviewed'));
});

test('query ranks workspace entrypoint chunks for frontend app questions', () => {
  const dir = nestedFrontendRepo();
  capture(() => wiki(['build', dir, '--json']));
  const result = capture(() => query(['where is the frontend app entrypoint?', dir, '--json']));

  assert.equal(result.ok, true);
  assert.ok(['entrypoints.md', 'workspaces.md'].includes(result.result.results[0].page));
  assert.ok(result.result.results.some(row => row.excerpt.includes('frontend/gui/src/main.tsx')));
  assert.ok(result.result.warnings[0].includes('non-reviewed'));
});

test('query treats app started questions as startup queries', () => {
  const dir = nestedFrontendRepo();
  capture(() => wiki(['build', dir, '--json']));
  const result = capture(() => query(['where is the app started?', dir, '--json']));

  assert.equal(result.ok, true);
  assert.ok(['entrypoints.md', 'workspaces.md'].includes(result.result.results[0].page));
  assert.notEqual(result.result.results[0].page, 'symbols.md');
  assert.notEqual(result.result.results[0].heading, 'Notes');
  assert.ok(result.result.results.some(row => row.excerpt.includes('frontend/gui/src/main.tsx')));
});

test('query tokenizer removes generic question words', () => {
  assert.deepEqual(tokenize('where is the CLI entrypoint?'), ['cli', 'entrypoint']);
});

test('walkDir handles wide directories without spreading into push arguments', () => {
  const originalReaddirSync = fs.readdirSync;
  const root = path.join(os.tmpdir(), 'raptor-wide-mock');
  const nested = path.join(root, 'src');
  const dirent = (name, type) => ({
    name,
    isDirectory: () => type === 'directory',
    isFile: () => type === 'file',
  });

  try {
    fs.readdirSync = (dir) => {
      if (dir === root) return [dirent('src', 'directory')];
      if (dir === nested) {
        return Array.from({ length: 70000 }, (_, i) => dirent(`file-${i}.js`, 'file'));
      }
      return [];
    };
    const files = walkDir(root);
    assert.equal(files.length, 70000);
  } finally {
    fs.readdirSync = originalReaddirSync;
  }
});

test('discoverWorkspaces finds nested manifests and keeps invalid package warnings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raptor-workspaces-'));
  fs.mkdirSync(path.join(dir, 'frontend', 'gui'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'backend'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'frontend', 'gui', 'package.json'), JSON.stringify({ name: 'gui' }), 'utf8');
  fs.writeFileSync(path.join(dir, 'backend', 'package.json'), '{ invalid', 'utf8');

  const files = walkDir(dir);
  const result = discoverWorkspaces(files, dir);
  const roots = result.workspaces.map(workspace => workspace.root);

  assert.ok(roots.includes('frontend/gui'));
  assert.ok(roots.includes('backend'));
  assert.equal(result.workspaces.find(workspace => workspace.root === 'frontend/gui').name, 'gui');
  assert.ok(result.workspaces.find(workspace => workspace.root === 'backend').warnings.length > 0);
  assert.ok(result.warnings.some(warning => warning.includes('Could not parse')));
});

test('discoverWorkspaces derives JavaScript, frontend, Python, and Go entrypoints', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raptor-entrypoints-'));
  fs.mkdirSync(path.join(dir, 'frontend', 'gui', 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'api'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'goapp', 'cmd', 'server'), { recursive: true });

  fs.writeFileSync(path.join(dir, 'frontend', 'gui', 'package.json'), JSON.stringify({
    name: 'gui',
    main: 'src/main.tsx',
    bin: { gui: './missing-cli.js' },
    scripts: { dev: 'vite --host 0.0.0.0' },
  }), 'utf8');
  fs.writeFileSync(path.join(dir, 'frontend', 'gui', 'vite.config.ts'), 'export default {};\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'frontend', 'gui', 'src', 'main.tsx'), 'console.log("main");\n', 'utf8');

  fs.writeFileSync(path.join(dir, 'tools', 'pyproject.toml'), '[project]\nname = "tools"\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'tools', 'main.py'), 'print("main")\n', 'utf8');

  fs.writeFileSync(path.join(dir, 'api', 'setup.py'), 'from setuptools import setup\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'api', 'app.py'), 'print("app")\n', 'utf8');

  fs.writeFileSync(path.join(dir, 'goapp', 'go.mod'), 'module example.com/goapp\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'goapp', 'cmd', 'server', 'main.go'), 'package main\n', 'utf8');

  const result = discoverWorkspaces(walkDir(dir), dir);
  const allEntrypoints = result.workspaces.flatMap(workspace => workspace.entrypoints.map(entry => entry.path));
  const gui = result.workspaces.find(workspace => workspace.root === 'frontend/gui');

  assert.ok(allEntrypoints.includes('frontend/gui/src/main.tsx'));
  assert.ok(allEntrypoints.includes('tools/main.py'));
  assert.ok(allEntrypoints.includes('api/app.py'));
  assert.ok(allEntrypoints.includes('goapp/cmd/server/main.go'));
  assert.ok(gui.skippedEntrypoints.some(entry => entry.path === 'frontend/gui/missing-cli.js'));
});

test('discoverWorkspaces includes explicit package bin files from ignored directories', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raptor-bin-entry-'));
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'cli',
    bin: { cli: './bin/cli.js' },
  }), 'utf8');
  fs.writeFileSync(path.join(dir, 'bin', 'cli.js'), '#!/usr/bin/env node\n', 'utf8');

  const result = discoverWorkspaces(walkDir(dir), dir);
  const rootWorkspace = result.workspaces.find(workspace => workspace.root === '');
  assert.ok(rootWorkspace.entrypoints.some(entry => entry.path === 'bin/cli.js'));
  assert.equal(rootWorkspace.skippedEntrypoints.length, 0);
});
