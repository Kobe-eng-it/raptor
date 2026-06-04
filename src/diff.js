'use strict';

const path = require('path');
const { execSync } = require('child_process');
const { hasGitRepo, output, outputError } = require('./util');

function diff(argv) {
  const json = argv.includes('--json');
  const pathArg = argv.find(a => !a.startsWith('--'));
  const targetPath = pathArg ? path.resolve(pathArg) : process.cwd();

  if (!hasGitRepo(targetPath)) {
    return output({
      hasGit: false,
      changedFiles: [],
      newFiles: [],
      deletedFiles: [],
      renamedFiles: [],
      note: 'No git repository found. Full regeneration mode will be used.',
    }, json);
  }

  try {
    const run = (cmd) => execSync(cmd, { cwd: targetPath, stdio: 'pipe' }).toString().trim();

    // Files modified (tracked, not deleted)
    const modifiedRaw = run('git diff --name-only HEAD').split('\n').filter(Boolean);

    // Untracked new files
    const untrackedRaw = run('git ls-files --others --exclude-standard').split('\n').filter(Boolean);

    // Deleted files
    const deletedRaw = run('git diff --name-only --diff-filter=D HEAD').split('\n').filter(Boolean);

    // Renamed files
    const renamedRaw = run('git diff --name-status HEAD')
      .split('\n')
      .filter(l => l.startsWith('R'))
      .map(l => {
        const parts = l.split('\t');
        return { from: parts[1], to: parts[2] };
      });

    const deletedSet = new Set(deletedRaw);
    const changedFiles = modifiedRaw.filter(f => !deletedSet.has(f));

    output({
      hasGit: true,
      baseBranch: 'HEAD',
      changedFiles,
      newFiles: untrackedRaw,
      deletedFiles: deletedRaw,
      renamedFiles: renamedRaw,
    }, json);
  } catch (err) {
    outputError(`Git error: ${err.message}`, json);
  }
}

module.exports = { diff };
