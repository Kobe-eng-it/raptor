'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { wiki, query, parseFrontmatter, createFrontmatter, tokenize } = require('../src/wiki');
const { answerPack } = require('../src/answerPack');
const { extractSymbols } = require('../src/symbols');
const { extractRoutes } = require('../src/routes');
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
  fs.mkdirSync(path.join(dir, 'backend', 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'backend', 'src', 'UserController.java'), [
    'import org.springframework.web.bind.annotation.*;',
    '@RestController',
    '@RequestMapping("/api")',
    'public class UserController {',
    '  @GetMapping("/user")',
    '  public Object getUser() { return null; }',
    '}',
  ].join('\n'), 'utf8');
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

function deepSpringRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raptor-deep-spring-'));
  const relPath = path.join(
    'documentale',
    'repository',
    'src',
    'main',
    'java',
    'com',
    'eng',
    'documentale',
    'repository',
    'controller',
    'UserController.java',
  );
  const sourcePath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, [
    'import org.springframework.web.bind.annotation.*;',
    '@RestController',
    '@RequestMapping("/user")',
    'public class UserController {',
    '  @GetMapping',
    '  public Object getUser() { return null; }',
    '}',
  ].join('\n'), 'utf8');
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

function captureText(fn) {
  const original = console.log;
  const lines = [];
  console.log = (value) => lines.push(value);
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines.join('\n');
}

function captureError(fn) {
  const originalError = console.error;
  const originalExit = process.exit;
  const lines = [];
  let exitCode = null;
  console.error = (value) => lines.push(value);
  process.exit = (code) => {
    exitCode = code;
    throw new Error(`process.exit ${code}`);
  };
  try {
    fn();
  } catch (error) {
    if (!String(error.message).startsWith('process.exit')) throw error;
  } finally {
    console.error = originalError;
    process.exit = originalExit;
  }
  return { exitCode, output: JSON.parse(lines.join('\n')) };
}

function runCli(argv) {
  const originalArgv = process.argv;
  const originalLog = console.log;
  const lines = [];
  console.log = (value) => lines.push(value);
  process.argv = [process.execPath, path.join(__dirname, '..', 'bin', 'raptor.js'), ...argv];
  try {
    const cli = require.resolve('../bin/raptor.js');
    delete require.cache[cli];
    require(cli);
  } finally {
    process.argv = originalArgv;
    console.log = originalLog;
  }
  return lines.join('\n');
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

test('route extraction detects Java Spring class prefixes and method mappings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raptor-routes-spring-'));
  const sourcePath = path.join(dir, 'backend', 'src', 'UserController.java');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, [
    'import org.springframework.web.bind.annotation.*;',
    '@RestController',
    '@RequestMapping("/api")',
    'public class UserController {',
    '  @GetMapping("/user")',
    '  public User getUser() { return null; }',
    '',
    '  @PostMapping(path = "/users")',
    '  public User createUser() { return null; }',
    '',
    '  @RequestMapping(value = "/roles", method = RequestMethod.PUT)',
    '  public void updateRoles() {}',
    '}',
  ].join('\n'), 'utf8');

  const result = extractRoutes(walkDir(dir), dir, [{ root: 'backend' }]);
  const routeKeys = result.routes.map(route => `${route.method} ${route.route}`);

  assert.deepEqual(routeKeys, ['GET /api/user', 'POST /api/users', 'PUT /api/roles']);
  assert.equal(result.routes[0].path, 'backend/src/UserController.java');
  assert.equal(result.routes[0].handler, 'getUser');
  assert.equal(result.routes[0].framework, 'spring');
  assert.equal(result.routes[0].workspace, 'backend');
  assert.equal(result.routes[0].confidence, 'high');
  assert.equal(result.routes[0].line, 5);
  assert.deepEqual(result.warnings, []);
});

test('route extraction keeps unresolved Java Spring routes as low confidence with warnings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raptor-routes-dynamic-'));
  const sourcePath = path.join(dir, 'src', 'DynamicController.java');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, [
    'import org.springframework.web.bind.annotation.*;',
    '@RestController',
    '@RequestMapping("${api.prefix}")',
    'public class DynamicController {',
    '  @GetMapping(USER_PATH)',
    '  public Object getDynamic() { return null; }',
    '}',
  ].join('\n'), 'utf8');

  const result = extractRoutes(walkDir(dir), dir);

  assert.equal(result.routes.length, 1);
  assert.equal(result.routes[0].method, 'GET');
  assert.equal(result.routes[0].route, '/');
  assert.equal(result.routes[0].confidence, 'low');
  assert.ok(result.warnings.some(warning => warning.includes('class-level @RequestMapping uses unresolved expression')));
  assert.ok(result.warnings.some(warning => warning.includes('@GetMapping uses unresolved expression')));
});

test('route extraction detects Express JavaScript and TypeScript routes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raptor-routes-express-'));
  const jsPath = path.join(dir, 'api', 'server.js');
  const tsPath = path.join(dir, 'api', 'routes.ts');
  fs.mkdirSync(path.dirname(jsPath), { recursive: true });
  fs.writeFileSync(jsPath, [
    'const express = require("express");',
    'const app = express();',
    'function listUsers(req, res) { res.send([]); }',
    'app.get("/users", listUsers);',
    'app.post("/users", function createUser(req, res) { res.send({}); });',
  ].join('\n'), 'utf8');
  fs.writeFileSync(tsPath, [
    'const router = require("express").Router();',
    'router.delete("/users/:id", removeUser);',
  ].join('\n'), 'utf8');

  const result = extractRoutes(walkDir(dir), dir, [{ root: 'api' }]);
  const routeKeys = result.routes.map(route => `${route.method} ${route.route}`).sort();

  assert.deepEqual(routeKeys, ['DELETE /users/:id', 'GET /users', 'POST /users']);
  const getUsers = result.routes.find(route => route.method === 'GET' && route.route === '/users');
  const createUser = result.routes.find(route => route.method === 'POST' && route.route === '/users');
  assert.equal(getUsers.framework, 'express');
  assert.equal(getUsers.workspace, 'api');
  assert.equal(getUsers.confidence, 'high');
  assert.equal(createUser.handler, 'createUser');
  assert.deepEqual(result.warnings, []);
});

test('route extraction keeps unresolved Express routes as low confidence with warnings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raptor-routes-express-dynamic-'));
  const sourcePath = path.join(dir, 'src', 'server.js');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, [
    'const pathPrefix = "/api";',
    'app.get(pathPrefix + "/users", listUsers);',
  ].join('\n'), 'utf8');

  const result = extractRoutes(walkDir(dir), dir);

  assert.equal(result.routes.length, 1);
  assert.equal(result.routes[0].method, 'GET');
  assert.equal(result.routes[0].route, '/users');
  assert.equal(result.routes[0].confidence, 'low');
  assert.ok(result.warnings.some(warning => warning.includes('Express get route uses unresolved expression')));
});

test('route extraction detects FastAPI and Flask-style Python routes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raptor-routes-python-'));
  const sourcePath = path.join(dir, 'service', 'api.py');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, [
    'from fastapi import APIRouter',
    'router = APIRouter()',
    '@router.get("/users")',
    'def list_users():',
    '    return []',
    '',
    '@router.post("/users")',
    'async def create_user():',
    '    return {}',
    '',
    '@app.route("/roles", methods=["GET", "POST"])',
    'def roles():',
    '    return []',
  ].join('\n'), 'utf8');

  const result = extractRoutes(walkDir(dir), dir, [{ root: 'service' }]);
  const routeKeys = result.routes.map(route => `${route.method} ${route.route}`);

  assert.deepEqual(routeKeys, ['GET /users', 'POST /users', 'GET /roles', 'POST /roles']);
  assert.equal(result.routes[0].framework, 'python');
  assert.equal(result.routes[0].workspace, 'service');
  assert.equal(result.routes[0].handler, 'list_users');
  assert.equal(result.routes[1].handler, 'create_user');
  assert.equal(result.routes[0].confidence, 'high');
  assert.deepEqual(result.warnings, []);
});

test('wiki build creates pages, indexes, manifest, and llms exports', () => {
  const dir = tempRepo();
  const result = capture(() => wiki(['build', dir, '--json']));
  assert.equal(result.ok, true);
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'wiki', 'overview.md')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'wiki', 'workspaces.md')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'wiki', 'routes.md')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'index', 'chunks.jsonl')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'index', 'symbols.jsonl')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'index', 'routes.jsonl')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'index', 'links.json')));
  assert.ok(fs.existsSync(path.join(dir, '.raptor', 'manifest.json')));
  assert.ok(fs.existsSync(path.join(dir, 'llms.txt')));
  assert.ok(fs.existsSync(path.join(dir, 'llms-full.txt')));
  assert.equal(result.result.index.routes, 1);
  const routes = fs.readFileSync(path.join(dir, '.raptor', 'index', 'routes.jsonl'), 'utf8')
    .trim()
    .split(/\r?\n/)
    .map(line => JSON.parse(line));
  assert.deepEqual(routes.map(route => `${route.method} ${route.route}`), ['GET /api/user']);

  const routesPage = fs.readFileSync(path.join(dir, '.raptor', 'wiki', 'routes.md'), 'utf8');
  assert.ok(routesPage.includes('# Routes'));
  assert.ok(routesPage.includes('`GET /api/user`'));
  assert.ok(routesPage.includes('[backend/src/UserController.java](../../backend/src/UserController.java):5'));
  assert.ok(fs.readFileSync(path.join(dir, 'llms.txt'), 'utf8').includes('[Routes](./.raptor/wiki/routes.md)'));
});

test('wiki build renders routes page when no routes are detected', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raptor-no-routes-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'plain.txt'), 'hello\n', 'utf8');

  const result = capture(() => wiki(['build', dir, '--json']));
  const routesPage = fs.readFileSync(path.join(dir, '.raptor', 'wiki', 'routes.md'), 'utf8');

  assert.equal(result.ok, true);
  assert.equal(result.result.index.routes, 0);
  assert.ok(routesPage.includes('Detected 0 route(s).'));
  assert.ok(routesPage.includes('No routes detected.'));
});

test('wiki build detects deeply nested Spring controllers', () => {
  const dir = deepSpringRepo();
  const result = capture(() => wiki(['build', dir, '--json']));
  const routesText = fs.readFileSync(path.join(dir, '.raptor', 'index', 'routes.jsonl'), 'utf8').trim();
  const routes = routesText.split(/\r?\n/).map(line => JSON.parse(line));
  const relPath = 'documentale/repository/src/main/java/com/eng/documentale/repository/controller/UserController.java';
  const routesPage = fs.readFileSync(path.join(dir, '.raptor', 'wiki', 'routes.md'), 'utf8');

  assert.equal(result.ok, true);
  assert.equal(result.result.index.routes, 1);
  assert.equal(routes[0].method, 'GET');
  assert.equal(routes[0].route, '/user');
  assert.equal(routes[0].path, relPath);
  assert.ok(routesPage.includes(`[${relPath}](../../${relPath}):5`));
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

test('wiki validate reports stale and missing route sources', () => {
  const staleDir = tempRepo();
  capture(() => wiki(['build', staleDir, '--json']));
  fs.appendFileSync(path.join(staleDir, 'backend', 'src', 'UserController.java'), '\n// changed\n', 'utf8');
  const staleResult = capture(() => wiki(['validate', staleDir, '--json']));
  const staleRoutesPage = staleResult.result.pages.find(page => page.page === 'routes.md');

  assert.equal(staleRoutesPage.stale, true);
  assert.ok(staleRoutesPage.warnings.some(warning => warning.includes('backend/src/UserController.java')));

  const missingDir = tempRepo();
  capture(() => wiki(['build', missingDir, '--json']));
  fs.unlinkSync(path.join(missingDir, 'backend', 'src', 'UserController.java'));
  const missingResult = capture(() => wiki(['validate', missingDir, '--json']));
  const missingRoutesPage = missingResult.result.pages.find(page => page.page === 'routes.md');

  assert.ok(missingRoutesPage.errors.some(error => error.includes('missing sources')));
  assert.ok(missingResult.result.errors.some(error => error.includes('backend/src/UserController.java')));
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

test('query surfaces route evidence for procedural account questions', () => {
  const dir = tempRepo();
  capture(() => wiki(['build', dir, '--json']));
  const result = capture(() => query(['Come si crea un utenza?', dir, '--json']));

  assert.equal(result.ok, true);
  assert.equal(result.result.results[0].page, 'routes.md');
  assert.ok(result.result.routes.some(route => (
    route.method === 'GET'
    && route.route === '/api/user'
    && route.path === 'backend/src/UserController.java'
  )));
  assert.ok(result.result.results[0].sources.includes('backend/src/UserController.java'));
  assert.ok(result.result.warnings[0].includes('routes.md'));

  const text = captureText(() => query(['Come si crea un utenza?', dir]));
  assert.ok(text.includes('Answer: GET /api/user -> backend/src/UserController.java:5 (spring, high confidence)'));
  assert.ok(text.indexOf('- backend/src/UserController.java') < text.indexOf('Warnings:'));
});

test('wiki review marks pages reviewed and refreshes query chunk warnings', () => {
  const dir = nestedFrontendRepo();
  capture(() => wiki(['build', dir, '--json']));

  const reviewResult = capture(() => wiki(['review', '--all', dir, '--json']));
  assert.equal(reviewResult.ok, true);
  assert.ok(reviewResult.result.reviewed.includes('entrypoints.md'));
  assert.equal(reviewResult.result.skipped.length, 0);

  const status = capture(() => wiki(['status', dir, '--json']));
  assert.deepEqual(status.result.draft, []);
  assert.ok(status.result.reviewed.includes('entrypoints.md'));
  assert.ok(status.result.reviewed.includes('workspaces.md'));

  const queryResult = capture(() => query(['where is the app started?', dir, '--json']));
  assert.equal(queryResult.ok, true);
  assert.deepEqual(queryResult.result.warnings, []);
  assert.equal(queryResult.result.results[0].status, 'reviewed');
});

test('query without json prints a human-readable answer with sources', () => {
  const dir = nestedFrontendRepo();
  capture(() => wiki(['build', dir, '--json']));
  capture(() => wiki(['review', '--all', dir, '--json']));

  const text = captureText(() => query(['where is the app started?', dir]));

  assert.ok(text.includes('Question: where is the app started?'));
  assert.ok(text.includes('Best match: entrypoints.md / Detected Entrypoints (reviewed)'));
  assert.ok(text.includes('Answer: frontend/gui/src/main.tsx'));
  assert.ok(text.includes('Sources:'));
  assert.ok(!text.includes('Results include non-reviewed pages'));
});

test('query expands Italian procedural account questions', () => {
  const dir = tempRepo();
  fs.mkdirSync(path.join(dir, 'src', 'users'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'src', 'users', 'create-user.js'),
    'function createUser(input) { return { id: input.id }; }\nmodule.exports = { createUser };\n',
    'utf8',
  );
  capture(() => wiki(['build', dir, '--json']));

  const result = capture(() => query(['Come si crea un utenza?', dir, '--json']));

  assert.equal(result.ok, true);
  assert.ok(result.result.symbols.some(symbol => symbol.path === 'src/users/create-user.js' && symbol.name === 'createUser'));
  assert.ok(result.result.results.some(row => row.excerpt.includes('createUser') || row.sources.includes('src/users/create-user.js')));

  const text = captureText(() => query(['Come si crea un utenza?', dir]));
  assert.ok(text.includes('Answer: src/users/create-user.js (function createUser)'));
  assert.ok(text.includes('Route evidence: GET /api/user -> backend/src/UserController.java:5 (spring, high confidence)'));
  assert.ok(text.indexOf('Route evidence:') < text.indexOf('Sources:'));
});

test('query sources do not use paths truncated by excerpts', () => {
  const dir = tempRepo();
  fs.mkdirSync(path.join(dir, 'src', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), { recursive: true });
  const relPath = 'src/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/create-user.js';
  fs.writeFileSync(
    path.join(dir, relPath),
    'function createUser(input) { return { id: input.id }; }\nmodule.exports = { createUser };\n',
    'utf8',
  );
  capture(() => wiki(['build', dir, '--json']));

  const result = capture(() => query(['Come si crea un utenza?', dir, '--json']));
  const sourcePaths = result.result.results.flatMap(row => row.sources);

  assert.ok(sourcePaths.includes(relPath));
  assert.ok(!sourcePaths.some(source => source === 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/create-user.js'));
});

test('answer-pack returns route-first bounded evidence bundle', () => {
  const dir = tempRepo();
  capture(() => wiki(['build', dir, '--json']));
  const result = capture(() => answerPack(['Come si crea un utenza?', dir, '--json']));

  assert.equal(result.ok, true);
  assert.equal(result.result.question, 'Come si crea un utenza?');
  assert.equal(result.result.path, dir);
  assert.equal(result.result.confidence, 'high');
  assert.equal(result.result.routes[0].path, 'backend/src/UserController.java');
  assert.equal(result.result.routes[0].route, '/api/user');
  assert.equal(result.result.sources[0].path, 'backend/src/UserController.java');
  assert.equal(result.result.sources[0].snippets.length, 1);
  assert.ok(result.result.sources[0].snippets[0].text.includes('@GetMapping("/user")'));
  assert.ok(result.result.sources[0].snippets[0].text.length <= 1200);
  assert.ok(result.result.wiki_results.some(row => row.page === 'routes.md'));
  assert.ok(result.result.warnings[0].includes('non-reviewed'));
});

test('answer-pack reports low confidence when direct evidence is missing', () => {
  const dir = tempRepo();
  capture(() => wiki(['build', dir, '--json']));
  const result = capture(() => answerPack(['zzzz nonexistent workflow', dir, '--json']));

  assert.equal(result.ok, true);
  assert.equal(result.result.confidence, 'low');
  assert.deepEqual(result.result.routes, []);
  assert.deepEqual(result.result.symbols, []);
  assert.ok(result.result.warnings.some(warning => warning.includes('Insufficient direct route or symbol evidence')));
});

test('answer-pack reports missing index with build instruction', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raptor-answer-no-index-'));
  const result = captureError(() => answerPack(['where is user created?', dir, '--json']));

  assert.equal(result.exitCode, 1);
  assert.equal(result.output.ok, false);
  assert.ok(result.output.error.includes('Run "raptor wiki build" first'));
});

test('CLI exposes answer-pack command and returns JSON bundle', () => {
  const dir = tempRepo();
  capture(() => wiki(['build', dir, '--json']));

  const help = runCli(['help']);
  assert.ok(help.includes('answer-pack <question> [path] [--json]'));

  const raw = runCli(['answer-pack', 'Come si crea un utenza?', dir, '--json']);
  const result = JSON.parse(raw);

  assert.equal(result.ok, true);
  assert.equal(result.result.routes[0].path, 'backend/src/UserController.java');
  assert.equal(result.result.sources[0].path, 'backend/src/UserController.java');
});

test('raptor skill instructs agents to use answer-pack for procedural questions', () => {
  const skill = fs.readFileSync(path.join(__dirname, '..', 'skill', 'raptor', 'SKILL.md'), 'utf8');

  assert.ok(skill.includes('raptor answer-pack "<question>" "<target-path>" --json'));
  assert.ok(skill.includes('before manual grep-style exploration'));
  assert.ok(skill.includes('If `result.confidence` is `low`, state the limitation before proposing a workflow'));
  assert.ok(skill.includes('If `result.routes[]` is non-empty, cite route files in `File verificati`'));
});

test('query tokenizer removes generic question words', () => {
  assert.deepEqual(tokenize('where is the CLI entrypoint?'), ['cli', 'entrypoint']);
  assert.deepEqual(tokenize('Come si crea un utenza?'), ['crea', 'utenza']);
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
