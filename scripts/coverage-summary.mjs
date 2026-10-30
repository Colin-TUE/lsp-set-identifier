// Prints the vitest json-summary coverage report as a markdown table (for the GitHub step summary).
import { readFileSync } from 'node:fs';
import { cwd, stdout } from 'node:process';

const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
const cell = (m) => `${m.pct}% (${m.covered}/${m.total})`;
const row = (name, s) =>
  `| ${name} | ${cell(s.branches)} | ${cell(s.functions)} | ${cell(s.lines)} | ${cell(s.statements)} |`;

const files = Object.entries(summary).filter(([k]) => k !== 'total');
const lines = [
  '## Coverage',
  '',
  '| File | Branches | Functions | Lines | Statements |',
  '| --- | --- | --- | --- | --- |',
  row('**Total**', summary.total),
  ...files.map(([f, s]) => row(f.replace(`${cwd()}/`, ''), s)),
];
stdout.write(lines.join('\n') + '\n');
