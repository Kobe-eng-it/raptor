'use strict';

const fs = require('fs');
const path = require('path');

const ROUTE_EXTS = new Set(['.java', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py']);
const SPRING_METHODS = {
  RequestMapping: 'ANY',
  GetMapping: 'GET',
  PostMapping: 'POST',
  PutMapping: 'PUT',
  DeleteMapping: 'DELETE',
  PatchMapping: 'PATCH',
};
const EXPRESS_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch']);
const PYTHON_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch']);

function slash(value) {
  return value.replace(/\\/g, '/');
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function findWorkspace(relPath, workspaces = []) {
  let best = '';
  for (const workspace of workspaces) {
    const root = slash(workspace.root || '');
    if (!root) continue;
    if (relPath === root || relPath.startsWith(`${root}/`)) {
      if (root.length > best.length) best = root;
    }
  }
  return best;
}

function joinRoutes(prefix, route) {
  const cleanPrefix = normalizeRoutePath(prefix || '');
  const cleanRoute = normalizeRoutePath(route || '');
  if (!cleanPrefix) return cleanRoute || '/';
  if (!cleanRoute || cleanRoute === '/') return cleanPrefix;
  return `${cleanPrefix.replace(/\/$/, '')}/${cleanRoute.replace(/^\//, '')}`;
}

function normalizeRoutePath(value) {
  if (!value) return '';
  let route = String(value).trim();
  if (!route) return '';
  if (!route.startsWith('/')) route = `/${route}`;
  return route.replace(/\/+/g, '/');
}

function parseLiteralStrings(value) {
  const strings = [];
  const re = /["']([^"']*)["']/g;
  let match;
  while ((match = re.exec(value)) !== null) {
    strings.push(match[1]);
  }
  return strings;
}

function isDynamicRoutePath(routePath) {
  return /\$\{|[{}]/.test(routePath);
}

function parseSpringAnnotationArgs(rawArgs) {
  const result = {
    paths: [],
    method: null,
    dynamic: false,
  };
  const args = rawArgs.trim();
  if (!args) return result;

  const methodMatch = args.match(/method\s*=\s*RequestMethod\.([A-Z]+)/);
  if (methodMatch) result.method = methodMatch[1];

  const routeMatch = args.match(/(?:value|path)\s*=\s*(\{[^}]+\}|["'][^"']*["'])/);
  const routeSource = routeMatch ? routeMatch[1] : args;
  result.paths = parseLiteralStrings(routeSource);
  if (result.paths.some(isDynamicRoutePath)) {
    result.dynamic = true;
    result.paths = result.paths.filter(routePath => !isDynamicRoutePath(routePath));
  }

  const withoutStrings = routeSource.replace(/["'][^"']*["']/g, '').trim();
  if (!result.paths.length || /[A-Za-z_$][\w$.]*|\+/.test(withoutStrings)) {
    result.dynamic = true;
  }

  return result;
}

function functionNameAfter(content, index) {
  const tail = content.slice(index, index + 500);
  const namedFunction = tail.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (namedFunction) return namedFunction[1];
  const methodFunction = tail.match(/(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(?:[\w<>\[\],.?]+\s+)+([A-Za-z_$][\w$]*)\s*\(/);
  if (methodFunction) return methodFunction[1];
  const pythonFunction = tail.match(/(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/);
  return pythonFunction ? pythonFunction[1] : undefined;
}

function findClassPrefix(content) {
  const classRe = /@RequestMapping\s*(?:\(([^)]*)\))?[\s\S]*?(?:public\s+)?(?:abstract\s+)?class\s+[A-Za-z_$][\w$]*/g;
  let match;
  let best = null;
  while ((match = classRe.exec(content)) !== null) {
    const args = parseSpringAnnotationArgs(match[1] || '');
    best = {
      paths: args.paths,
      dynamic: args.dynamic,
      line: lineNumberAt(content, match.index),
      index: match.index,
    };
  }
  if (!best) return { paths: [''], dynamic: false, line: null };
  return {
    paths: best.paths.length ? best.paths : [''],
    dynamic: best.dynamic,
    line: best.line,
    index: best.index,
  };
}

function handlerAfter(content, index) {
  return functionNameAfter(content, index);
}

function pushRoute(routes, route, warningSink) {
  routes.push(route);
  if (route.warning) warningSink.push(route.warning);
}

function extractSpringRoutes(filePath, relPath, content, workspaces = []) {
  const routes = [];
  const warnings = [];
  const classPrefix = findClassPrefix(content);
  if (classPrefix.dynamic) {
    warnings.push(`${relPath}:${classPrefix.line || 1} class-level @RequestMapping uses unresolved expression`);
  }

  const annotationRe = /@(RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\s*(?:\(([^)]*)\))?/g;
  let match;
  while ((match = annotationRe.exec(content)) !== null) {
    const annotation = match[1];
    const args = parseSpringAnnotationArgs(match[2] || '');
    const line = lineNumberAt(content, match.index);
    if (annotation === 'RequestMapping' && classPrefix.index === match.index) continue;
    const method = args.method || SPRING_METHODS[annotation];
    const paths = args.paths.length ? args.paths : [''];
    const handler = handlerAfter(content, annotationRe.lastIndex);
    const workspace = findWorkspace(relPath, workspaces);
    const dynamic = classPrefix.dynamic || args.dynamic;
    if (dynamic) {
      warnings.push(`${relPath}:${line} @${annotation} uses unresolved expression`);
    }

    for (const prefix of classPrefix.paths) {
      for (const routePath of paths) {
        const route = joinRoutes(prefix, routePath);
        pushRoute(routes, {
          method,
          route,
          path: relPath,
          line,
          handler,
          framework: 'spring',
          workspace,
          confidence: dynamic ? 'low' : 'high',
          reason: annotation === 'RequestMapping'
            ? 'Spring @RequestMapping annotation'
            : `Spring @RequestMapping prefix plus @${annotation}`,
        }, warnings);
      }
    }
  }

  return { routes, warnings };
}

function extractExpressRoutes(filePath, relPath, content, workspaces = []) {
  const routes = [];
  const warnings = [];
  const workspace = findWorkspace(relPath, workspaces);
  const routeRe = /\b(?:app|router|server)\.(get|post|put|delete|patch)\s*\(\s*([^,\n)]+)/g;
  let match;
  while ((match = routeRe.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const line = lineNumberAt(content, match.index);
    const source = match[2].trim();
    const paths = parseLiteralStrings(source);
    const dynamic = !paths.length || /[A-Za-z_$][\w$.]*|\+|`/.test(source.replace(/["'][^"']*["']/g, ''));
    if (dynamic) {
      warnings.push(`${relPath}:${line} Express ${match[1]} route uses unresolved expression`);
    }
    const routePaths = paths.filter(routePath => !isDynamicRoutePath(routePath));
    if (paths.length !== routePaths.length) {
      warnings.push(`${relPath}:${line} Express ${match[1]} route uses unresolved template placeholder`);
    }

    for (const routePath of (routePaths.length ? routePaths : [''])) {
      routes.push({
        method,
        route: normalizeRoutePath(routePath) || '/',
        path: relPath,
        line,
        handler: functionNameAfter(content, routeRe.lastIndex),
        framework: 'express',
        workspace,
        confidence: dynamic || !routePaths.length ? 'low' : 'high',
        reason: `Express ${match[1]} route call`,
      });
    }
  }
  return { routes, warnings };
}

function parsePythonRouteMethods(args) {
  const methodsMatch = args.match(/methods\s*=\s*\[([^\]]+)\]/);
  if (!methodsMatch) return ['GET'];
  const methods = parseLiteralStrings(methodsMatch[1]).map(method => method.toUpperCase());
  return methods.length ? methods : ['GET'];
}

function extractPythonRoutes(filePath, relPath, content, workspaces = []) {
  const routes = [];
  const warnings = [];
  const workspace = findWorkspace(relPath, workspaces);
  const decoratorRe = /@(app|router|api)\.(get|post|put|delete|patch|route)\s*\(([^)]*)\)/g;
  let match;
  while ((match = decoratorRe.exec(content)) !== null) {
    const decoratorMethod = match[2];
    const args = match[3] || '';
    const line = lineNumberAt(content, match.index);
    const paths = parseLiteralStrings(args).filter(routePath => routePath.startsWith('/'));
    const routePaths = paths.filter(routePath => !isDynamicRoutePath(routePath));
    const methods = decoratorMethod === 'route'
      ? parsePythonRouteMethods(args)
      : [decoratorMethod.toUpperCase()];
    const withoutStrings = args.replace(/["'][^"']*["']/g, '').trim();
    const dynamic = !routePaths.length || /[A-Za-z_]\w*|\+/.test(withoutStrings.replace(/methods\s*=\s*\[[^\]]+\]/, ''));
    if (dynamic) {
      warnings.push(`${relPath}:${line} Python route decorator uses unresolved expression`);
    }

    for (const routePath of (routePaths.length ? routePaths : [''])) {
      for (const method of methods) {
        routes.push({
          method,
          route: normalizeRoutePath(routePath) || '/',
          path: relPath,
          line,
          handler: functionNameAfter(content, decoratorRe.lastIndex),
          framework: 'python',
          workspace,
          confidence: dynamic || !routePaths.length ? 'low' : 'high',
          reason: decoratorMethod === 'route'
            ? 'Python route decorator with methods'
            : `Python ${decoratorMethod} route decorator`,
        });
      }
    }
  }
  return { routes, warnings };
}

function extractRoutes(files, rootPath, workspaces = []) {
  const routes = [];
  const warnings = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!ROUTE_EXTS.has(ext)) continue;
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const relPath = slash(path.relative(rootPath, file));
    if (ext === '.java') {
      const result = extractSpringRoutes(file, relPath, content, workspaces);
      routes.push(...result.routes);
      warnings.push(...result.warnings);
    } else if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
      const result = extractExpressRoutes(file, relPath, content, workspaces);
      routes.push(...result.routes);
      warnings.push(...result.warnings);
    } else if (ext === '.py') {
      const result = extractPythonRoutes(file, relPath, content, workspaces);
      routes.push(...result.routes);
      warnings.push(...result.warnings);
    }
  }

  return { routes, warnings };
}

module.exports = {
  ROUTE_EXTS,
  extractExpressRoutes,
  extractPythonRoutes,
  extractRoutes,
  extractSpringRoutes,
};
