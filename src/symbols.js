'use strict';

const fs = require('fs');
const path = require('path');

const SYMBOL_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go']);

function pushSymbol(symbols, name, kind, extra = {}) {
  if (!name) return;
  symbols.push({ name, kind, ...extra });
}

function extractJavaScriptSymbols(content, ext) {
  const symbols = [];
  const patterns = [
    { re: /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm, kind: 'function' },
    { re: /^export\s+class\s+([A-Za-z_$][\w$]*)/gm, kind: 'class' },
    { re: /^export\s+(?:type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm, kind: 'type' },
    { re: /^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm, kind: 'export' },
    { re: /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm, kind: 'function' },
    { re: /^class\s+([A-Za-z_$][\w$]*)/gm, kind: 'class' },
    { re: /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/gm, kind: 'function' },
  ];

  for (const { re, kind } of patterns) {
    let match;
    while ((match = re.exec(content)) !== null) {
      pushSymbol(symbols, match[1], kind);
    }
  }

  let match;
  const namedExport = /^export\s*\{([^}]+)\}/gm;
  while ((match = namedExport.exec(content)) !== null) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/i).pop();
      pushSymbol(symbols, name, 'export');
    }
  }

  const commonJs = /module\.exports(?:\.([A-Za-z_$][\w$]*))?\s*=\s*([A-Za-z_$][\w$]*)?/gm;
  while ((match = commonJs.exec(content)) !== null) {
    pushSymbol(symbols, match[1] || match[2] || 'module.exports', 'commonjs-export');
  }

  const exportsDot = /exports\.([A-Za-z_$][\w$]*)\s*=/gm;
  while ((match = exportsDot.exec(content)) !== null) {
    pushSymbol(symbols, match[1], 'commonjs-export');
  }

  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    const routePattern = /(?:router|app|server)\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]+)['"`]/gm;
    while ((match = routePattern.exec(content)) !== null) {
      pushSymbol(symbols, `${match[1].toUpperCase()} ${match[2]}`, 'route');
    }
  }

  return symbols;
}

function extractPythonSymbols(content) {
  const symbols = [];
  const patterns = [
    { re: /^def\s+([A-Za-z_]\w*)\s*\(/gm, kind: 'function' },
    { re: /^async\s+def\s+([A-Za-z_]\w*)\s*\(/gm, kind: 'function' },
    { re: /^class\s+([A-Za-z_]\w*)/gm, kind: 'class' },
  ];
  for (const { re, kind } of patterns) {
    let match;
    while ((match = re.exec(content)) !== null) {
      pushSymbol(symbols, match[1], kind);
    }
  }
  return symbols;
}

function extractGoSymbols(content) {
  const symbols = [];
  const patterns = [
    { re: /^func\s+(?:\([^)]+\)\s+)?([A-Za-z_]\w*)\s*\(/gm, kind: 'function' },
    { re: /^type\s+([A-Za-z_]\w*)\s+(?:struct|interface|func|\w+)/gm, kind: 'type' },
    { re: /^var\s+([A-Za-z_]\w*)/gm, kind: 'variable' },
    { re: /^const\s+([A-Za-z_]\w*)/gm, kind: 'constant' },
  ];
  for (const { re, kind } of patterns) {
    let match;
    while ((match = re.exec(content)) !== null) {
      pushSymbol(symbols, match[1], /^[A-Z]/.test(match[1]) ? `exported-${kind}` : kind);
    }
  }
  return symbols;
}

function dedupeSymbols(symbols) {
  const seen = new Set();
  return symbols.filter(symbol => {
    const key = `${symbol.kind}:${symbol.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractSymbols(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const ext = path.extname(filePath).toLowerCase();
  let symbols = [];
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    symbols = extractJavaScriptSymbols(content, ext);
  } else if (ext === '.py') {
    symbols = extractPythonSymbols(content);
  } else if (ext === '.go') {
    symbols = extractGoSymbols(content);
  }

  return dedupeSymbols(symbols);
}

function isSymbolFile(filePath) {
  return SYMBOL_EXTS.has(path.extname(filePath).toLowerCase());
}

module.exports = {
  SYMBOL_EXTS,
  extractSymbols,
  isSymbolFile,
};
