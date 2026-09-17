const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
const { spawnSync } = require('node:child_process');
if (!process.argv.includes('--child')) {
  for (const TZ of ['UTC', 'Africa/Casablanca', 'America/Los_Angeles', 'Pacific/Auckland']) {
    const r = spawnSync(process.execPath, [__filename, '--child'], { env: { ...process.env, TZ }, encoding: 'utf8' });
    process.stdout.write(r.stdout); process.stderr.write(r.stderr);
    assert.equal(r.status, 0);
  }
  process.exit(0);
}
const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../frontend/lib', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('exports', 'require', code)(exports, dep => load(dep.replace('./', '')));
  modules.set(name, exports); return exports;
}
const { expenseRange, inExpenseRange } = load('expense-range');
const now = new Date(2026, 0, 15, 12);
for (const [preset, first, last] of [
  ['thisMonth', new Date(2026, 0, 1), new Date(2026, 1, 1)],
  ['lastMonth', new Date(2025, 11, 1), new Date(2026, 0, 1)],
  ['last3Months', new Date(2025, 10, 1), new Date(2026, 1, 1)],
  ['thisYear', new Date(2026, 0, 1), new Date(2027, 0, 1)],
  ['lastYear', new Date(2025, 0, 1), new Date(2026, 0, 1)],
]) {
  const range = expenseRange(preset, '', '', now);
  assert.equal(range.from, +first); assert.equal(range.until, +last);
  assert(inExpenseRange(first.toISOString(), range));
  assert(!inExpenseRange(new Date(+first - 1).toISOString(), range));
  assert(inExpenseRange(new Date(+last - 1).toISOString(), range));
  assert(!inExpenseRange(last.toISOString(), range));
}
const custom = expenseRange('custom', '2026-03-08', '2026-03-08');
assert(inExpenseRange(new Date(2026, 2, 8, 23, 59, 59).toISOString(), custom));
assert(!inExpenseRange(new Date(2026, 2, 9).toISOString(), custom));
assert(expenseRange('custom', '2026-03-09', '2026-03-08').error);
assert(expenseRange('custom', '', '').error);
assert(!inExpenseRange('invalid', custom));
assert(inExpenseRange(undefined, expenseRange('all')));
const offsetRange = expenseRange('custom', '2026-09-17', '2026-09-17');
assert.equal(inExpenseRange('2026-09-17T00:30:00+01:00', offsetRange), inExpenseRange('2026-09-16T23:30:00Z', offsetRange));
console.log('Expense range checks passed in ' + process.env.TZ);
