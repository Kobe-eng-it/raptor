'use strict';

const path = require('path');
const { hasGitRepo, output, outputError } = require('./util');
const { listChangedFiles } = require('./git');

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
    output({ baseBranch: 'HEAD', ...listChangedFiles(targetPath) }, json);
  } catch (err) {
    outputError(`Git error: ${err.message}`, json);
  }
}

module.exports = { diff };
