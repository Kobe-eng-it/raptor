'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  walkDir, detectLanguages, detectFramework, getPackageInfo,
  getEntryPoints, checkExistingDocs, hasGitRepo, output, outputError,
} = require('./util');

const DEEP_FILES_LIMIT = 20;
const DEEP_FILE_SIZE_LIMIT = 32 * 1024; // 32KB per file

function extractSymbols(filePath) {
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); } catch { return []; }
  const ext = path.extname(filePath).toLowerCase();
  const symbols = [];

  if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
    // exported functions, classes, types, interfaces, consts
    const patterns = [
      /^export\s+(?:async\s+)?function\s+(\w+)/gm,
      /^export\s+class\s+(\w+)/gm,
      /^export\s+(?:type|interface|enum)\s+(\w+)/gm,
      /^export\s+(?:const|let|var)\s+(\w+)/gm,
      /^export\s+default\s+(?:function\s+)?(\w+)?/gm,
    ];
    for (const pattern of patterns) {
      let m;
      while ((m = pattern.exec(content)) !== null) {
        if (m[1]) symbols.push({ name: m[1], kind: 'export' });
      }
    }
  }

  if (ext === '.py') {
    const patterns = [
      /^def\s+(\w+)\s*\(/gm,
      /^class\s+(\w+)/gm,
    ];
    for (const pattern of patterns) {
      let m;
      while ((m = pattern.exec(content)) !== null) {
        symbols.push({ name: m[1], kind: 'def' });
      }
    }
  }

  if (ext === '.go') {
    const patterns = [
      /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/gm,
      /^type\s+(\w+)\s+/gm,
    ];
    for (const pattern of patterns) {
      let m;
      while ((m = pattern.exec(content)) !== null) {
        if (m[1] && /^[A-Z]/.test(m[1])) symbols.push({ name: m[1], kind: 'exported' });
      }
    }
  }

  if (['.ts', '.js'].includes(ext)) {
    // REST routes: router.get/post/put/delete/patch
    const routePattern = /(?:router|app|server)\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]+)['"`]/gm;
    let m;
    while ((m = routePattern.exec(content)) !== null) {
      symbols.push({ name: `${m[1].toUpperCase()} ${m[2]}`, kind: 'route' });
    }
  }

  return symbols;
}

function readDeepContent(files, rootPath) {
  // Pick the most interesting files: entry points, controllers, services, models
  const interesting = files.filter(f => {
    const rel = path.relative(rootPath, f).replace(/\\/g, '/');
    return (
      /\/(controller|service|handler|route|model|schema|api|store|hook|util|lib|core)\//i.test(rel) ||
      /\.(controller|service|handler|route|model|schema)\.[jt]sx?$/.test(rel) ||
      rel.match(/^(src\/)?index\.[jt]sx?$/) ||
      rel.match(/^(src\/)?main\.[jt]sx?$/) ||
      rel.match(/^(src\/)?app\.[jt]sx?$/)
    );
  }).slice(0, DEEP_FILES_LIMIT);

  const contents = {};
  for (const f of interesting) {
    const rel = path.relative(rootPath, f).replace(/\\/g, '/');
    try {
      const stat = fs.statSync(f);
      if (stat.size > DEEP_FILE_SIZE_LIMIT) {
        contents[rel] = '[truncated: file too large]';
        continue;
      }
      contents[rel] = fs.readFileSync(f, 'utf8');
    } catch {
      contents[rel] = '[unreadable]';
    }
  }
  return contents;
}

function analyze(argv) {
  const json = argv.includes('--json');
  const deep = argv.includes('--deep');
  const pathArg = argv.find(a => !a.startsWith('--'));
  const targetPath = pathArg ? path.resolve(pathArg) : process.cwd();

  if (!fs.existsSync(targetPath)) {
    return outputError(`Path does not exist: ${targetPath}`, json);
  }

  const files = walkDir(targetPath);
  const languages = detectLanguages(files, targetPath);
  const primaryLanguage = languages[0]?.name || null;
  const framework = detectFramework(targetPath);
  const packageInfo = getPackageInfo(targetPath);
  const entryPoints = getEntryPoints(files, targetPath);
  const existingDocs = checkExistingDocs(targetPath);
  const gitAvailable = hasGitRepo(targetPath);

  // Build relative file tree (cap at 500 files for readability)
  const relativeFiles = files
    .slice(0, 500)
    .map(f => path.relative(targetPath, f).replace(/\\/g, '/'));

  // Extract symbols from relevant files
  const symbolMap = {};
  const symbolFiles = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go'].includes(ext);
  }).slice(0, 100);

  for (const f of symbolFiles) {
    const syms = extractSymbols(f);
    if (syms.length > 0) {
      const rel = path.relative(targetPath, f).replace(/\\/g, '/');
      symbolMap[rel] = syms;
    }
  }

  const result = {
    path: targetPath,
    packageInfo,
    languages,
    primaryLanguage,
    framework,
    entryPoints,
    existingDocs,
    hasGit: gitAvailable,
    totalFiles: files.length,
    fileTree: relativeFiles,
    symbols: symbolMap,
  };

  if (deep) {
    result.deep = {
      keyFileContents: readDeepContent(files, targetPath),
    };
  }

  output(result, json);
}

module.exports = { analyze };
