'use strict';

const fs = require('fs');
const path = require('path');

const MANIFESTS = new Set(['package.json', 'pyproject.toml', 'setup.py', 'go.mod']);
const FRONTEND_CONFIGS = [
  'vite.config.js', 'vite.config.ts', 'vite.config.mjs',
  'next.config.js', 'next.config.ts', 'next.config.mjs',
  'astro.config.mjs', 'astro.config.ts',
  'svelte.config.js', 'vue.config.js',
];
const FRONTEND_ENTRYPOINTS = [
  'src/main.ts', 'src/main.tsx', 'src/main.js', 'src/main.jsx',
  'src/index.ts', 'src/index.tsx', 'src/index.js', 'src/index.jsx',
  'src/App.tsx', 'src/App.jsx',
];
const PYTHON_ENTRYPOINTS = ['main.py', 'app.py', 'manage.py'];
const GO_ENTRYPOINTS = ['main.go'];

function slash(value) {
  return value.replace(/\\/g, '/');
}

function rel(rootPath, filePath) {
  return slash(path.relative(rootPath, filePath));
}

function dirOf(relPath) {
  const dir = slash(path.dirname(relPath));
  return dir === '.' ? '' : dir;
}

function joinRel(...parts) {
  return slash(path.posix.join(...parts.filter(part => part !== '')));
}

function existsRel(fileSet, rootPath, workspaceRoot, candidate) {
  const full = joinRel(workspaceRoot, candidate);
  if (fileSet.has(full)) return full;
  return fs.existsSync(path.join(rootPath, full)) ? full : null;
}

function readPackageJson(rootPath, manifest) {
  const full = path.join(rootPath, manifest);
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(full, 'utf8')) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function readGoModuleName(rootPath, manifest) {
  try {
    const content = fs.readFileSync(path.join(rootPath, manifest), 'utf8');
    return content.match(/^module\s+(.+)$/m)?.[1] || null;
  } catch {
    return null;
  }
}

function readPyProjectName(rootPath, manifest) {
  try {
    const content = fs.readFileSync(path.join(rootPath, manifest), 'utf8');
    return content.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1] || null;
  } catch {
    return null;
  }
}

function addEntrypoint(entrypoints, seen, pathValue, source, kind, reason) {
  if (!pathValue || seen.has(pathValue)) return;
  seen.add(pathValue);
  entrypoints.push({ path: pathValue, source, kind, reason });
}

function addSkipped(skippedEntrypoints, candidate, source, reason) {
  if (!candidate) return;
  skippedEntrypoints.push({ path: candidate, source, reason });
}

function normalizeExportValue(value) {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(normalizeExportValue);
  }
  return [];
}

function stripRelativePrefix(value) {
  return String(value).replace(/^[.][/\\]/, '');
}

function detectPackageEntrypoints(rootPath, pkg, workspace, fileSet, entrypoints, skippedEntrypoints, seen) {
  const fields = [
    ['main', pkg.main],
    ['module', pkg.module],
    ['exports', pkg.exports],
  ];

  for (const [field, raw] of fields) {
    for (const value of normalizeExportValue(raw)) {
      const candidate = stripRelativePrefix(value);
      const existing = existsRel(fileSet, rootPath, workspace.root, candidate);
      if (existing) addEntrypoint(entrypoints, seen, existing, `package.${field}`, 'javascript', `package.json ${field} points to ${candidate}`);
      else addSkipped(skippedEntrypoints, joinRel(workspace.root, candidate), `package.${field}`, 'referenced file does not exist');
    }
  }

  const bin = pkg.bin;
  const bins = typeof bin === 'string' ? [bin] : Object.values(bin || {});
  for (const value of bins) {
    const candidate = stripRelativePrefix(value);
    const existing = existsRel(fileSet, rootPath, workspace.root, candidate);
    if (existing) addEntrypoint(entrypoints, seen, existing, 'package.bin', 'cli', `package.json bin points to ${candidate}`);
    else addSkipped(skippedEntrypoints, joinRel(workspace.root, candidate), 'package.bin', 'referenced file does not exist');
  }

  const scripts = pkg.scripts || {};
  for (const name of ['dev', 'start', 'serve']) {
    if (!scripts[name]) continue;
    for (const candidate of candidatesFromScript(String(scripts[name]))) {
      const existing = existsRel(fileSet, rootPath, workspace.root, candidate);
      if (existing) addEntrypoint(entrypoints, seen, existing, `script.${name}`, 'javascript', `package.json ${name} script references ${candidate}`);
      else addSkipped(skippedEntrypoints, joinRel(workspace.root, candidate), `script.${name}`, 'referenced file does not exist');
    }
    for (const candidate of FRONTEND_ENTRYPOINTS) {
      const existing = existsRel(fileSet, rootPath, workspace.root, candidate);
      if (existing) addEntrypoint(entrypoints, seen, existing, `script.${name}`, 'frontend', `package.json ${name} script and conventional ${candidate}`);
    }
  }
}

function candidatesFromScript(script) {
  const candidates = [];
  const re = /(?:^|\s)([A-Za-z0-9_./-]+\.(?:js|jsx|ts|tsx|mjs|cjs|py|go))(?:\s|$)/g;
  let match;
  while ((match = re.exec(script)) !== null) {
    candidates.push(stripRelativePrefix(match[1]));
  }
  return candidates;
}

function detectFrontendEntrypoints(rootPath, workspace, fileSet, entrypoints, seen) {
  const hasConfig = FRONTEND_CONFIGS.some(config => fileSet.has(joinRel(workspace.root, config)));
  if (!hasConfig) return;
  for (const candidate of FRONTEND_ENTRYPOINTS) {
    const existing = existsRel(fileSet, rootPath, workspace.root, candidate);
    if (existing) addEntrypoint(entrypoints, seen, existing, 'frontend-config', 'frontend', `frontend config and conventional ${candidate}`);
  }
}

function detectPythonEntrypoints(rootPath, workspace, fileSet, entrypoints, seen) {
  for (const candidate of PYTHON_ENTRYPOINTS) {
    const existing = existsRel(fileSet, rootPath, workspace.root, candidate);
    if (existing) addEntrypoint(entrypoints, seen, existing, 'python-convention', 'python', `conventional ${candidate}`);
  }
}

function detectGoEntrypoints(rootPath, workspace, relFiles, fileSet, entrypoints, seen) {
  for (const candidate of GO_ENTRYPOINTS) {
    const existing = existsRel(fileSet, rootPath, workspace.root, candidate);
    if (existing) addEntrypoint(entrypoints, seen, existing, 'go-convention', 'go', `conventional ${candidate}`);
  }
  const prefix = joinRel(workspace.root, 'cmd');
  for (const file of relFiles) {
    if (file.startsWith(`${prefix}/`) && file.endsWith('/main.go')) {
      addEntrypoint(entrypoints, seen, file, 'go-convention', 'go', 'conventional cmd/*/main.go');
    }
  }
}

function languageForManifest(manifestType) {
  if (manifestType === 'package.json') return 'JavaScript';
  if (manifestType === 'pyproject.toml' || manifestType === 'setup.py') return 'Python';
  if (manifestType === 'go.mod') return 'Go';
  return null;
}

function hydrateWorkspace(rootPath, workspace, relFiles, fileSet) {
  const entrypoints = [];
  const skippedEntrypoints = [];
  const warnings = [];
  const seen = new Set();
  let name = null;

  if (workspace.manifestType === 'package.json') {
    const parsed = readPackageJson(rootPath, workspace.manifest);
    if (parsed.ok) {
      name = parsed.value.name || null;
      detectPackageEntrypoints(rootPath, parsed.value, workspace, fileSet, entrypoints, skippedEntrypoints, seen);
    } else {
      warnings.push(`Could not parse ${workspace.manifest}: ${parsed.error}`);
    }
  } else if (workspace.manifestType === 'go.mod') {
    name = readGoModuleName(rootPath, workspace.manifest);
  } else if (workspace.manifestType === 'pyproject.toml') {
    name = readPyProjectName(rootPath, workspace.manifest);
  }

  detectFrontendEntrypoints(rootPath, workspace, fileSet, entrypoints, seen);
  detectPythonEntrypoints(rootPath, workspace, fileSet, entrypoints, seen);
  detectGoEntrypoints(rootPath, workspace, relFiles, fileSet, entrypoints, seen);

  return {
    ...workspace,
    name,
    language: languageForManifest(workspace.manifestType),
    entrypoints,
    warnings,
    skippedEntrypoints,
  };
}

function discoverWorkspaces(files, rootPath) {
  const relFiles = files.map(file => slash(path.isAbsolute(file) ? rel(rootPath, file) : file));
  const fileSet = new Set(relFiles);
  const manifestMap = new Map();
  const warnings = [];

  for (const file of relFiles) {
    const base = path.posix.basename(file);
    if (!MANIFESTS.has(base)) continue;
    const root = dirOf(file);
    if (!manifestMap.has(root)) {
      manifestMap.set(root, { root, manifest: file, manifestType: base });
    }
  }

  if (!manifestMap.has('')) {
    manifestMap.set('', { root: '', manifest: null, manifestType: 'directory' });
  }

  const workspaces = [...manifestMap.values()]
    .sort((a, b) => a.root.localeCompare(b.root))
    .map(workspace => hydrateWorkspace(rootPath, workspace, relFiles, fileSet));

  for (const workspace of workspaces) {
    for (const warning of workspace.warnings) warnings.push(`${workspace.root || '.'}: ${warning}`);
  }

  return { workspaces, warnings };
}

module.exports = {
  discoverWorkspaces,
  candidatesFromScript,
};
