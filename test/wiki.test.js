'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { wiki, query, parseFrontmatter, createFrontmatter, tokenize } = require('../src/wiki');
const { extractSymbols } = require('../src/symbols');

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
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'index', 'chunks.jsonl')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'index', 'symbols.jsonl')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'index', 'links.json')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'manifest.json')));
  assert.ok(fs.existsSync(path.join(dir, 'llms.txt')));
  assert.ok(fs.existsSync(path.join(dir, 'llms-full.txt')));
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

test('query ranks entrypoint page for CLI entrypoint question and warns on draft pages', () => {
  const dir = tempRepo();
  capture(() => wiki(['build', dir, '--json']));
  const result = capture(() => query(['where is the CLI entrypoint?', dir, '--json']));
  assert.equal(result.ok, true);
  assert.equal(result.result.results[0].page, 'entrypoints.md');
  assert.ok(result.result.warnings[0].includes('non-reviewed'));
});

test('query tokenizer removes generic question words', () => {
  assert.deepEqual(tokenize('where is the CLI entrypoint?'), ['cli', 'entrypoint']);
});
