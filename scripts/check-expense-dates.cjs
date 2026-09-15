/* Run with: node scripts/check-expense-dates.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');

const zones = ['UTC', 'Africa/Casablanca', 'America/Los_Angeles', 'Pacific/Auckland'];
if (!process.argv.includes('--timezone-check')) {
  for (const zone of zones) {
    const result = spawnSync(process.execPath, [__filename, '--timezone-check'], {
      env: { ...process.env, TZ: zone }, encoding: 'utf8',
    });
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `Expense date checks failed in ${zone}`);
  }
  process.exit(0);
}

// Use the project's TypeScript compiler, without adding a test dependency or build files.
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'frontend/node_modules/typescript'));
const source = fs.readFileSync(path.join(root, 'frontend/lib/expense-date.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = { exports: {} };
vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, Date });
const { expenseDateInput, expenseTimestamp } = loaded.exports;

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseUtc(value) {
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`);
}

function clockOnDate(date, reference) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, reference.getHours(), reference.getMinutes(), reference.getSeconds(), reference.getMilliseconds());
}

const now = new Date();
assert.equal(expenseDateInput(), localDate(now), 'New expense defaults to the local calendar date');
const before = Date.now();
const created = expenseTimestamp(localDate(new Date(before)));
const after = Date.now();
assert.ok(Date.parse(created) >= before && Date.parse(created) <= after, 'New expense records the current instant');

const selectedDay = '2026-01-20';
const selectedBefore = new Date();
const selected = new Date(expenseTimestamp(selectedDay));
const selectedAfter = new Date();
assert.equal(localDate(selected), selectedDay, 'A selected date remains the selected local day');
assert.ok(
  selected >= clockOnDate(selectedDay, selectedBefore) && selected <= clockOnDate(selectedDay, selectedAfter),
  'A selected date uses the current clock time',
);

// Near UTC midnight, eastern and western zones must use their own calendar day.
for (const iso of ['2026-09-14T23:30:45.123Z', '2026-09-15T00:30:45.123Z']) {
  const expected = localDate(new Date(iso));
  assert.equal(expenseDateInput(iso), expected, 'UTC timestamp maps to the local day');
  assert.equal(expenseDateInput(iso.slice(0, -1)), expected, 'Timezone-less API timestamp means UTC');
}

for (const iso of [
  '2026-09-15T00:30:45.123456Z',
  '2026-09-15T00:30:45.123456',
  '2026-09-15T00:30:45.123456+01:00',
  '2026-09-15T00:30:45.123456-0430',
]) {
  const expected = parseUtc(iso);
  assert.equal(expenseDateInput(iso), localDate(expected), 'Explicit timezone offsets are respected');
  const unchanged = expenseTimestamp(localDate(expected), iso);
  assert.equal(parseUtc(unchanged).getTime(), expected.getTime(), 'An ordinary edit preserves the original instant');
  assert.ok(unchanged.includes('.123456'), 'An ordinary edit preserves sub-millisecond precision');
  const moved = parseUtc(expenseTimestamp('2026-10-20', iso));
  assert.equal(localDate(moved), '2026-10-20', 'Changing the date preserves the selected local day');
  assert.deepEqual(
    [moved.getHours(), moved.getMinutes(), moved.getSeconds()],
    [expected.getHours(), expected.getMinutes(), expected.getSeconds()],
    'Changing the date preserves the original local clock time',
  );
}

if (process.env.TZ === 'America/Los_Angeles') {
  const original = '2026-03-07T23:42:13.789Z'; // 15:42 before daylight saving time.
  assert.equal(expenseTimestamp('2026-03-08', original), '2026-03-08T22:42:13.789Z', 'Date changes account for the destination DST offset');
  for (const repeatedHour of ['2026-11-01T08:30:42.123456Z', '2026-11-01T09:30:42.123456Z']) {
    assert.equal(expenseTimestamp('2026-11-01', repeatedHour), repeatedHour, 'Editing either repeated 01:30 preserves its exact instant');
  }
}

console.log(`Expense timestamp checks passed in ${process.env.TZ}`);
