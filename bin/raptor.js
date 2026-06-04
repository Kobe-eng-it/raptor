#!/usr/bin/env node
'use strict';

const VERSION = '0.1.0';

const command = process.argv[2];
const argv = process.argv.slice(3);

const COMMANDS = {
  analyze: () => require('../src/analyze').analyze(argv),
  diff:    () => require('../src/diff').diff(argv),
  write:   () => require('../src/write').write(argv),
  doctor:  () => require('../src/doctor').doctor(argv),
  version: () => {
    const json = argv.includes('--json');
    if (json) {
      console.log(JSON.stringify({ schema_version: 'v0.1.0', ok: true, result: { version: VERSION } }, null, 2));
    } else {
      console.log(`raptor v${VERSION}`);
    }
  },
  help: () => {
    console.log(`
raptor v${VERSION} — AI-driven codebase documentation generator

COMMANDS
  analyze [path] [--deep] [--json]   Analyze codebase structure, languages, symbols
  diff    [path] [--json]            Show git-tracked changes since last commit
  write   --file <path> [--merge]    Write doc content from stdin (--merge uses section markers)
  doctor  [--json]                   Check environment prerequisites
  version [--json]                   Print version

EXAMPLES
  raptor analyze --json
  raptor analyze --deep --json
  raptor diff --json
  echo "# My Doc" | raptor write --file README.md
  echo "..." | raptor write --file docs/ARCHITECTURE.md --merge
`);
  },
};

if (!command || command === '--help' || command === '-h') {
  COMMANDS.help();
  process.exit(0);
}

if (!COMMANDS[command]) {
  console.error(`Unknown command: ${command}. Run "raptor help" for usage.`);
  process.exit(1);
}

COMMANDS[command]();
