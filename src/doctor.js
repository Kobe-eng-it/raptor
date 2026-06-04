'use strict';

const { execSync } = require('child_process');
const { output } = require('./util');

function checkTool(command, versionFlag = '--version') {
  try {
    const out = execSync(`${command} ${versionFlag}`, { stdio: 'pipe' }).toString().trim();
    const version = out.split('\n')[0].replace(/[^\d.]/g, '').split('.').slice(0, 3).join('.');
    return { ok: true, version: version || out.split('\n')[0].substring(0, 30) };
  } catch {
    return { ok: false, version: null };
  }
}

function checkWritePermission(dir) {
  const fs = require('fs');
  const path = require('path');
  const testFile = path.join(dir, '.raptor-write-test');
  try {
    fs.writeFileSync(testFile, 'test', 'utf8');
    fs.unlinkSync(testFile);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function checkGitRepo(cwd) {
  try {
    const root = execSync('git rev-parse --show-toplevel', { cwd, stdio: 'pipe' })
      .toString().trim();
    return { ok: true, root };
  } catch {
    return { ok: false, root: null };
  }
}

function doctor(argv) {
  const json = argv.includes('--json');
  const cwd = process.cwd();

  const nodeCheck = checkTool('node');
  const gitCheck = checkTool('git', '--version');
  const gitRepoCheck = checkGitRepo(cwd);
  const writeCheck = checkWritePermission(cwd);

  // Node version: must be >= 18
  const nodeVersionNum = parseFloat(nodeCheck.version);
  if (nodeCheck.ok && nodeVersionNum < 18) {
    nodeCheck.ok = false;
    nodeCheck.warning = `Node.js >= 18 required, found ${nodeCheck.version}`;
  }

  const checks = {
    node:            { ...nodeCheck, required: true },
    git:             { ...gitCheck, required: false },
    gitRepo:         { ...gitRepoCheck, required: false },
    writePermission: { ...writeCheck, required: true },
  };

  const allOk = Object.values(checks).every(c => !c.required || c.ok);

  const notes = [];
  if (!checks.git.ok) notes.push('Git not found — incremental update unavailable, full regeneration will be used.');
  if (!checks.gitRepo.ok && checks.git.ok) notes.push('Not inside a git repo — incremental update unavailable.');
  if (!checks.writePermission.ok) notes.push('No write permission in current directory.');

  if (json) {
    const output = require('./util').output;
    output({ ok: allOk, checks, notes }, json);
  } else {
    console.log(allOk ? '✅ raptor doctor: all checks passed' : '❌ raptor doctor: some checks failed');
    for (const [name, check] of Object.entries(checks)) {
      const icon = check.ok ? '✅' : (check.required ? '❌' : '⚠️');
      const ver = check.version ? ` (${check.version})` : '';
      const root = check.root ? ` → ${check.root}` : '';
      console.log(`  ${icon} ${name}${ver}${root}`);
    }
    if (notes.length) {
      console.log('\nNotes:');
      notes.forEach(n => console.log(`  • ${n}`));
    }
  }
}

module.exports = { doctor };
