'use strict';

const fs = require('fs');
const path = require('path');
const { output, outputError } = require('./util');

// Allowed output paths (relative to project root)
const ALLOWED_OUTPUT_PATHS = new Set([
  'README.md',
  'llms.txt',
  path.join('docs', 'ARCHITECTURE.md'),
  path.join('docs', 'api.md'),
  path.join('docs', 'docstrings.md'),
  path.join('docs', 'OPERATIONS.md'),
  path.join('docs', 'SECURITY.md'),
  path.join('docs', 'CONTRIBUTING.md'),
]);

const START_MARKER = (id) => `<!-- raptor:start:${id} -->`;
const END_MARKER   = (id) => `<!-- raptor:end:${id} -->`;
const SECTION_RE   = /<!-- raptor:start:([a-z0-9-]+) -->([\s\S]*?)<!-- raptor:end:\1 -->/g;

function mergeContent(existing, incoming) {
  // Extract all sections from incoming
  const incomingSections = {};
  let m;
  const re = new RegExp(SECTION_RE.source, 'g');
  while ((m = re.exec(incoming)) !== null) {
    incomingSections[m[1]] = m[0]; // full block including markers
  }

  // Replace matching sections in existing; track which incoming sections were applied
  const applied = new Set();
  let merged = existing.replace(SECTION_RE, (match, id) => {
    if (incomingSections[id]) {
      applied.add(id);
      return incomingSections[id];
    }
    return match; // preserve existing section if not in incoming
  });

  // Append new sections that didn't exist in the existing file
  const newSections = [];
  for (const [id, block] of Object.entries(incomingSections)) {
    if (!applied.has(id)) newSections.push(block);
  }
  if (newSections.length > 0) {
    merged = merged.trimEnd() + '\n\n' + newSections.join('\n\n') + '\n';
  }

  return { content: merged, sectionsUpdated: [...applied], sectionsAdded: newSections.map(b => {
    const m2 = b.match(/<!-- raptor:start:([a-z0-9-]+) -->/);
    return m2 ? m2[1] : 'unknown';
  })};
}

function write(argv) {
  const json = argv.includes('--json');
  const merge = argv.includes('--merge');

  const fileIdx = argv.indexOf('--file');
  if (fileIdx === -1 || !argv[fileIdx + 1]) {
    return outputError('--file <path> is required', json);
  }

  const filePath = argv[fileIdx + 1];

  // Security: normalize and check against whitelist
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedAllowed = [...ALLOWED_OUTPUT_PATHS].map(p => p.replace(/\\/g, '/'));
  if (!normalizedAllowed.includes(normalizedPath)) {
    return outputError(
      `Path "${filePath}" is not an allowed output path. Allowed: ${normalizedAllowed.join(', ')}`,
      json
    );
  }

  // Read content from stdin
  let content;
  try {
    content = fs.readFileSync(process.stdin.fd, 'utf8');
  } catch {
    return outputError('Failed to read content from stdin', json);
  }

  if (!content.trim()) {
    return outputError('Content from stdin is empty', json);
  }

  // Ensure docs/ directory exists
  const dir = path.dirname(filePath);
  if (dir && dir !== '.') {
    fs.mkdirSync(dir, { recursive: true });
  }

  const exists = fs.existsSync(filePath);

  if (merge && exists) {
    const existing = fs.readFileSync(filePath, 'utf8');
    const { content: merged, sectionsUpdated, sectionsAdded } = mergeContent(existing, content);
    fs.writeFileSync(filePath, merged, 'utf8');
    output({ path: filePath, action: 'updated', merged: true, sectionsUpdated, sectionsAdded }, json);
  } else {
    // On overwrite, backup if file existed and has no raptor markers
    if (exists) {
      const existing = fs.readFileSync(filePath, 'utf8');
      if (!existing.includes('<!-- raptor:start:')) {
        const backupPath = filePath + '.raptor-backup';
        fs.writeFileSync(backupPath, existing, 'utf8');
      }
    }
    fs.writeFileSync(filePath, content, 'utf8');
    output({ path: filePath, action: exists ? 'overwritten' : 'created', merged: false }, json);
  }
}

module.exports = { write };
