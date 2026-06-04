'use strict';

const fs = require('fs');
const path = require('path');
const { hasGitRepo: gitHasRepo } = require('./git');

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  'coverage', '.nyc_output', 'vendor', '.cache', '__pycache__', '.venv',
  'venv', '.tox', 'target', '.gradle', 'bin', 'obj', '.idea', '.vscode',
  'tmp', 'temp', 'logs',
]);

const IGNORE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
  '.mp4', '.mp3', '.wav', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.class', '.pyc', '.pyo',
  '.lock', '.sum',
]);

const LANG_MAP = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.cs': 'C#',
  '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++',
  '.c': 'C',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.swift': 'Swift',
  '.dart': 'Dart',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.html': 'HTML', '.htm': 'HTML',
  '.css': 'CSS', '.scss': 'SCSS', '.sass': 'SASS', '.less': 'Less',
  '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell',
  '.ps1': 'PowerShell',
  '.yaml': 'YAML', '.yml': 'YAML',
  '.json': 'JSON',
  '.toml': 'TOML',
  '.md': 'Markdown',
  '.sql': 'SQL',
  '.graphql': 'GraphQL', '.gql': 'GraphQL',
  '.proto': 'Protobuf',
  '.tf': 'Terraform', '.tfvars': 'Terraform',
};

const FRAMEWORK_HINTS = {
  'next.config.js': 'Next.js', 'next.config.ts': 'Next.js', 'next.config.mjs': 'Next.js',
  'nuxt.config.js': 'Nuxt.js', 'nuxt.config.ts': 'Nuxt.js',
  'angular.json': 'Angular',
  'vue.config.js': 'Vue',
  'svelte.config.js': 'SvelteKit',
  'astro.config.mjs': 'Astro', 'astro.config.ts': 'Astro',
  'remix.config.js': 'Remix',
  'vite.config.ts': 'Vite', 'vite.config.js': 'Vite',
  'nest-cli.json': 'NestJS',
  'fastapi': 'FastAPI',
  'manage.py': 'Django',
  'app.py': 'Flask',
  'main.go': 'Go',
  'Cargo.toml': 'Rust/Cargo',
  'pom.xml': 'Maven/Java',
  'build.gradle': 'Gradle',
};

function walkDir(dir, maxDepth = 8, depth = 0) {
  const results = [];
  if (depth > maxDepth) return results;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const nestedPath of walkDir(fullPath, maxDepth, depth + 1)) {
        results.push(nestedPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!IGNORE_EXTS.has(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function detectLanguages(files, rootPath) {
  const counts = {};
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    const lang = LANG_MAP[ext];
    if (lang) counts[lang] = (counts[lang] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, fileCount]) => ({
      name,
      files: fileCount,
      percentage: Math.round((fileCount / total) * 100),
    }));
}

function detectFramework(rootPath) {
  for (const [filename, framework] of Object.entries(FRAMEWORK_HINTS)) {
    if (fs.existsSync(path.join(rootPath, filename))) return framework;
  }
  // check package.json deps
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootPath, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['next']) return 'Next.js';
    if (deps['nuxt']) return 'Nuxt.js';
    if (deps['@angular/core']) return 'Angular';
    if (deps['vue']) return 'Vue';
    if (deps['svelte']) return 'SvelteKit';
    if (deps['express']) return 'Express';
    if (deps['fastify']) return 'Fastify';
    if (deps['@nestjs/core']) return 'NestJS';
    if (deps['react']) return 'React';
  } catch {}
  return null;
}

function getPackageInfo(rootPath) {
  const candidates = ['package.json', 'go.mod', 'Cargo.toml', 'pyproject.toml', 'setup.py', 'pom.xml'];
  for (const c of candidates) {
    const full = path.join(rootPath, c);
    if (!fs.existsSync(full)) continue;
    try {
      if (c === 'package.json') {
        const p = JSON.parse(fs.readFileSync(full, 'utf8'));
        return { name: p.name, version: p.version, description: p.description, source: 'package.json' };
      }
      if (c === 'go.mod') {
        const content = fs.readFileSync(full, 'utf8');
        const moduleMatch = content.match(/^module\s+(.+)/m);
        return { name: moduleMatch ? moduleMatch[1] : null, source: 'go.mod' };
      }
      if (c === 'Cargo.toml') {
        const content = fs.readFileSync(full, 'utf8');
        const nameMatch = content.match(/^name\s*=\s*"(.+)"/m);
        const versionMatch = content.match(/^version\s*=\s*"(.+)"/m);
        return { name: nameMatch?.[1], version: versionMatch?.[1], source: 'Cargo.toml' };
      }
    } catch {}
  }
  return { name: path.basename(rootPath), source: null };
}

function getEntryPoints(files, rootPath) {
  const candidates = [
    'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js', 'src/app.ts', 'src/app.js',
    'bin/raptor.js', 'bin/index.js', 'cli.js',
    'index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js',
    'main.go', 'main.py', 'app.py', 'manage.py', 'server.py',
    'src/main.rs', 'main.rs',
    'cmd/main.go',
  ];
  const result = [];
  for (const c of candidates) {
    const full = path.join(rootPath, c);
    if (fs.existsSync(full)) result.push(c);
  }
  return result;
}

function checkExistingDocs(rootPath) {
  const targets = {
    readme:       { path: 'README.md' },
    architecture: { path: path.join('docs', 'ARCHITECTURE.md') },
    api:          { path: path.join('docs', 'api.md') },
    docstrings:   { path: path.join('docs', 'docstrings.md') },
    operations:   { path: path.join('docs', 'OPERATIONS.md') },
    security:     { path: path.join('docs', 'SECURITY.md') },
    contributing: { path: path.join('docs', 'CONTRIBUTING.md') },
    llmsTxt:      { path: 'llms.txt' },
  };
  const result = {};
  for (const [key, { path: relPath }] of Object.entries(targets)) {
    const full = path.join(rootPath, relPath);
    result[key] = {
      path: relPath,
      exists: fs.existsSync(full),
      hasRaptorMarkers: false,
    };
    if (result[key].exists) {
      try {
        const content = fs.readFileSync(full, 'utf8');
        result[key].hasRaptorMarkers = content.includes('<!-- raptor:start:');
      } catch {}
    }
  }
  return result;
}

function hasGitRepo(rootPath) {
  return gitHasRepo(rootPath);
}

function output(data, json) {
  if (json) {
    console.log(JSON.stringify({ schema_version: 'v0.1.0', ok: true, result: data }, null, 2));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function outputError(message, json) {
  if (json) {
    console.error(JSON.stringify({ schema_version: 'v0.1.0', ok: false, error: message }, null, 2));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(1);
}

module.exports = {
  walkDir, detectLanguages, detectFramework, getPackageInfo,
  getEntryPoints, checkExistingDocs, hasGitRepo,
  output, outputError, LANG_MAP,
};
