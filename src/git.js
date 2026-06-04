'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runGit(args, cwd) {
  const candidates = process.platform === 'win32' ? ['git.exe', 'git'] : ['git'];
  let lastError = null;
  for (const command of candidates) {
    const result = spawnSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    if (result.status === 0) return (result.stdout || '').trim();
    lastError = result.error || new Error((result.stderr || result.stdout || 'git command failed').trim());
  }
  throw lastError;
}

function findGitDir(rootPath) {
  let current = path.resolve(rootPath);
  while (true) {
    const candidate = path.join(current, '.git');
    if (fs.existsSync(candidate)) {
      const stat = fs.statSync(candidate);
      if (stat.isDirectory()) return candidate;
      if (stat.isFile()) {
        const content = fs.readFileSync(candidate, 'utf8').trim();
        const match = content.match(/^gitdir:\s*(.+)$/i);
        if (match) return path.resolve(current, match[1]);
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function gitRootFromDir(gitDir) {
  if (!gitDir) return null;
  return path.basename(gitDir) === '.git' ? path.dirname(gitDir) : path.dirname(path.dirname(gitDir));
}

function readHeadCommitFromGitDir(gitDir) {
  if (!gitDir) return null;
  const headPath = path.join(gitDir, 'HEAD');
  if (!fs.existsSync(headPath)) return null;
  const head = fs.readFileSync(headPath, 'utf8').trim();
  if (/^[a-f0-9]{40}$/i.test(head)) return head;
  const match = head.match(/^ref:\s+(.+)$/);
  if (!match) return null;
  const refPath = path.join(gitDir, slashRef(match[1]));
  if (fs.existsSync(refPath)) return fs.readFileSync(refPath, 'utf8').trim() || null;
  const packedRefs = path.join(gitDir, 'packed-refs');
  if (!fs.existsSync(packedRefs)) return null;
  const refLine = fs.readFileSync(packedRefs, 'utf8')
    .split(/\r?\n/)
    .find(line => line.endsWith(` ${match[1]}`));
  return refLine ? refLine.split(' ')[0] : null;
}

function slashRef(ref) {
  return ref.split('/').join(path.sep);
}

function hasGitRepo(rootPath) {
  try {
    runGit(['rev-parse', '--git-dir'], rootPath);
    return true;
  } catch {
    return Boolean(findGitDir(rootPath));
  }
}

function getGitRoot(rootPath) {
  try {
    return runGit(['rev-parse', '--show-toplevel'], rootPath);
  } catch {
    return gitRootFromDir(findGitDir(rootPath));
  }
}

function getHeadCommit(rootPath) {
  try {
    return runGit(['rev-parse', 'HEAD'], rootPath);
  } catch {
    return readHeadCommitFromGitDir(findGitDir(rootPath));
  }
}

function listChangedFiles(rootPath) {
  if (!hasGitRepo(rootPath)) {
    return {
      hasGit: false,
      changedFiles: [],
      newFiles: [],
      deletedFiles: [],
      renamedFiles: [],
    };
  }

  const splitLines = (value) => value.split(/\r?\n/).filter(Boolean);
  const modifiedRaw = splitLines(runGit(['diff', '--name-only', 'HEAD'], rootPath));
  const untrackedRaw = splitLines(runGit(['ls-files', '--others', '--exclude-standard'], rootPath));
  const deletedRaw = splitLines(runGit(['diff', '--name-only', '--diff-filter=D', 'HEAD'], rootPath));
  const renamedRaw = splitLines(runGit(['diff', '--name-status', 'HEAD'], rootPath))
    .filter(line => line.startsWith('R'))
    .map(line => {
      const parts = line.split('\t');
      return { from: parts[1], to: parts[2] };
    });

  const deletedSet = new Set(deletedRaw);
  return {
    hasGit: true,
    changedFiles: modifiedRaw.filter(file => !deletedSet.has(file)),
    newFiles: untrackedRaw,
    deletedFiles: deletedRaw,
    renamedFiles: renamedRaw,
  };
}

module.exports = {
  runGit,
  hasGitRepo,
  getGitRoot,
  getHeadCommit,
  listChangedFiles,
};
