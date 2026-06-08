'use strict';

const fs = require('fs');
const path = require('path');
const { output, outputError } = require('./util');
const { tokenize } = require('./wiki');

const INDEX_DIR = path.join('.raptor', 'index');
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
const ROUTE_QUERY_TERMS = new Set([
  'api', 'apis', 'endpoint', 'endpoints', 'route', 'routes', 'controller', 'controllers',
  'backend', 'service', 'services', 'post', 'get', 'put', 'delete', 'patch',
]);
const ACCOUNT_QUERY_TERMS = new Set([
  'account', 'accounts', 'auth', 'authentication', 'profile', 'profiles', 'role', 'roles',
  'user', 'users', 'utenza', 'utenze', 'utente', 'utenti',
]);
const PROCEDURAL_QUERY_TERMS = new Set(['add', 'create', 'creation', 'new', 'register', 'signup']);
const MAX_SOURCE_FILES = 5;
const MAX_SNIPPET_LINES = 12;
const MAX_SNIPPET_CHARS = 1200;

function expandQueryTerms(terms) {
  const expanded = [];
  const seen = new Set();
  for (const term of terms) {
    const additions = [term, ...(QUERY_SYNONYMS[term] || [])];
    for (const addition of additions) {
      if (seen.has(addition) || QUERY_STOPWORDS.has(addition)) continue;
      seen.add(addition);
      expanded.push(addition);
    }
  }
  return expanded;
}

function loadJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function parseAnswerPackArgs(argv) {
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

function isRouteQuery(terms) {
  const hasRouteTerm = terms.some(term => ROUTE_QUERY_TERMS.has(term));
  const hasAccountTerm = terms.some(term => ACCOUNT_QUERY_TERMS.has(term));
  const hasProceduralTerm = terms.some(term => PROCEDURAL_QUERY_TERMS.has(term));
  return hasRouteTerm || (hasAccountTerm && hasProceduralTerm);
}

function scoreSymbol(symbol, terms) {
  const name = String(symbol.name || '').toLowerCase();
  const sourcePath = String(symbol.path || '').toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (name === term) score += 100;
    else if (name.startsWith(term)) score += 40;
    else if (name.includes(term)) score += 20;
    if (sourcePath.includes(term)) score += 5;
  }
  return score;
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

function scoreChunk(chunk, terms, routeRelated, hasRouteHits) {
  const textTokens = tokenize(chunk.text || '');
  let score = 0;
  for (const term of terms) {
    if (String(chunk.title || '').toLowerCase().includes(term)) score += 8;
    if (String(chunk.heading || '').toLowerCase().includes(term)) score += 6;
    if (String(chunk.page || '').toLowerCase().includes(term)) score += 10;
    score += textTokens.filter(token => token.includes(term)).length;
    if (routeRelated && chunk.page === 'routes.md' && textTokens.some(token => token.includes('/') && token.includes(term))) score += 20;
  }
  if (routeRelated && chunk.page === 'routes.md') score += hasRouteHits ? 45 : 20;
  if (routeRelated && chunk.page === 'symbols.md' && hasRouteHits) score -= 20;
  if (chunk.status !== 'reviewed') score -= 0.25;
  return score;
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

function insideRoot(rootPath, relPath) {
  const root = path.resolve(rootPath);
  const full = path.resolve(rootPath, relPath);
  return full === root || full.startsWith(`${root}${path.sep}`);
}

function selectSourcePaths(routes, symbols, wikiResults) {
  const paths = [];
  const seen = new Set();
  const add = (sourcePath) => {
    if (!sourcePath || seen.has(sourcePath)) return;
    seen.add(sourcePath);
    paths.push(sourcePath);
  };
  for (const route of routes) add(route.path);
  for (const symbol of symbols) add(symbol.path);
  for (const result of wikiResults) {
    for (const source of result.sources || []) add(source);
  }
  return paths.slice(0, MAX_SOURCE_FILES);
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

function buildSourceSnippet(rootPath, sourcePath, terms) {
  if (!insideRoot(rootPath, sourcePath)) return null;
  const fullPath = path.resolve(rootPath, sourcePath);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return null;

  const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
  const lowerLines = lines.map(line => line.toLowerCase());
  let matchIndex = lowerLines.findIndex(line => terms.some(term => line.includes(term)));
  if (matchIndex === -1) matchIndex = 0;
  const start = Math.max(0, matchIndex - 4);
  const end = Math.min(lines.length, start + MAX_SNIPPET_LINES);
  let text = lines.slice(start, end).join('\n');
  if (text.length > MAX_SNIPPET_CHARS) text = text.slice(0, MAX_SNIPPET_CHARS);
  return {
    path: sourcePath,
    snippets: [{
      line_start: start + 1,
      line_end: end,
      text,
    }],
  };
}

function confidenceFor(routes, symbols, wikiResults) {
  if (routes.some(route => route.confidence === 'high')) return 'high';
  if (routes.length || symbols.length || wikiResults.length) return 'medium';
  return 'low';
}

function answerPack(argv) {
  const { json, targetPath, question } = parseAnswerPackArgs(argv);
  if (!question) return outputError('answer-pack question is required', json);

  const chunksPath = path.join(targetPath, INDEX_DIR, 'chunks.jsonl');
  if (!fs.existsSync(chunksPath)) {
    return outputError('Raptor wiki index not found. Run "raptor wiki build" first.', json);
  }

  const terms = expandQueryTerms(tokenize(question));
  const chunks = loadJsonl(chunksPath);
  const symbols = loadJsonl(path.join(targetPath, INDEX_DIR, 'symbols.jsonl'));
  const routes = loadJsonl(path.join(targetPath, INDEX_DIR, 'routes.jsonl'));
  const routeRelated = isRouteQuery(terms);
  const routeHits = routes
    .map(route => ({ ...route, score: scoreRoute(route, terms, routeRelated) }))
    .filter(route => route.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const symbolHits = symbols
    .map(symbol => ({ ...symbol, score: scoreSymbol(symbol, terms) }))
    .filter(symbol => symbol.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const wikiResults = chunks
    .map(chunk => ({
      page: chunk.page,
      heading: chunk.heading,
      status: chunk.status,
      score: scoreChunk(chunk, terms, routeRelated, routeHits.length > 0),
      excerpt: snippet(chunk.text || '', terms),
      sources: extractSourcePaths(chunk.text || ''),
    }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const sourcePaths = selectSourcePaths(routeHits, symbolHits, wikiResults);
  const sources = sourcePaths
    .map(sourcePath => buildSourceSnippet(targetPath, sourcePath, terms))
    .filter(Boolean);
  const warnings = [];
  const staleOrDraft = [...new Set(wikiResults.filter(result => result.status !== 'reviewed').map(result => result.page))];
  if (staleOrDraft.length) warnings.push(`Results include non-reviewed pages: ${staleOrDraft.join(', ')}`);
  const confidence = confidenceFor(routeHits, symbolHits, wikiResults);
  if (confidence === 'low') warnings.push('Insufficient direct route or symbol evidence found.');

  output({
    question,
    path: targetPath,
    confidence,
    wiki_results: wikiResults,
    routes: routeHits,
    symbols: symbolHits,
    sources,
    warnings,
  }, json);
}

module.exports = {
  answerPack,
  buildSourceSnippet,
  expandQueryTerms,
};
