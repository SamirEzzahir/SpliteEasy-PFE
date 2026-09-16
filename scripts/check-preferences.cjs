/* Run with: node scripts/check-preferences.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const ts = require('../frontend/node_modules/typescript');

if (!process.argv.includes('--timezone-check')) {
  for (const zone of ['UTC', 'Africa/Casablanca', 'America/Los_Angeles', 'Pacific/Auckland']) {
    const result = spawnSync(process.execPath, [__filename, '--timezone-check'], {
      env: { ...process.env, TZ: zone }, encoding: 'utf8',
    });
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `Preferences failed in ${zone}`);
  }
  process.exit(0);
}

function app(storage = new Map(), browser = true, blockedStorage = false) {
  const modules = new Map();
  const context = vm.createContext({ Date, ...(browser ? { window: {} } : {}), localStorage: {
    getItem(key) { if (blockedStorage) throw Error('Storage disabled'); return storage.get(key) ?? null; },
    setItem(key, value) { if (blockedStorage) throw Error('Storage disabled'); storage.set(key, value); },
  } });
  function load(name) {
    if (modules.has(name)) return modules.get(name);
    const exports = {};
    modules.set(name, exports);
    const file = path.join(__dirname, '../frontend/lib', `${name}.ts`);
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInContext(`(function(exports, require) { ${compiled}\n})`, context)(exports, dep => load(dep.replace('./', '')));
    return exports;
  }
  return { ...load('preferences'), ...load('format') };
}

const storage = new Map([
  ['spliteasy.currency', 'USD'], // Legacy cache must not override the profile.
  ['spliteasy.dateFormat', 'mdy'], ['spliteasy.numberFormat', 'comma'],
]);
const p = app(storage);
assert.equal(p.fmt(1234.56), 'MAD 1,234.56');
p.loadLocalPreferences();
p.setPreferredCurrency('EUR');
assert.equal(p.fmt(1234.56), '€1.234,56');
assert.equal(p.fmt(1234.56, 'MAD'), 'MAD 1.234,56', 'Recorded currency remains unchanged');
assert.equal(p.fmtDate('2026-09-17'), '09/17/2026');

let updates = 0;
const unsubscribe = p.subscribePreferences(() => updates++);
for (const [style, expected] of [['dot', '1,234.56'], ['comma', '1.234,56'], ['space', '1 234,56']]) {
  p.setDisplayPreference('numberFormat', style);
  assert.equal(p.fmtNumber(1234.56), expected);
  assert.equal(p.fmt(-1234.56, 'MAD'), `MAD -${expected}`);
}
assert.equal(updates, 3, 'Each change immediately notifies mounted screens');
const stable = p.getPreferences();
p.setDisplayPreference('numberFormat', 'space');
assert.equal(p.getPreferences(), stable, 'Unchanged preferences keep a stable snapshot');
assert.equal(updates, 3);
unsubscribe();
for (const [style, expected] of [['dmy', '17/09/2026'], ['mdy', '09/17/2026'], ['iso', '2026-09-17']]) {
  p.setDisplayPreference('dateFormat', style);
  assert.equal(p.fmtDate('2026-09-17'), expected, 'Date-only fields never shift across timezones');
}
assert.equal(updates, 3, 'Unmounted screens are unsubscribed');
assert.equal(p.fmtNumber(0, { minimumFractionDigits: 2 }), '0,00');
assert.equal(p.fmt0(1234.56, 'EUR'), '€1 235');
assert.equal(p.fmtDate(null), '—');
assert.equal(p.fmtDate('invalid'), '—');

for (const iso of ['2026-09-16T23:30:00Z', '2026-09-17T00:30:00Z']) {
  const local = new Date(iso);
  const expected = `${local.getFullYear()}-${String(local.getMonth()+1).padStart(2,'0')}-${String(local.getDate()).padStart(2,'0')}`;
  assert.equal(p.fmtDate(iso), expected);
  assert.equal(p.fmtDate(iso.slice(0, -1)), expected, 'Naive API timestamps are UTC');
  assert.ok(p.fmtDateTime(iso).startsWith(`${expected} · `));
}
assert.equal(p.fmtDate('2026-09-17T00:30:00+01:00'), p.fmtDate('2026-09-16T23:30:00Z'));

const reloaded = app(storage);
reloaded.loadLocalPreferences();
reloaded.setPreferredCurrency('GBP');
assert.equal(reloaded.fmt(1234.56), '£1 234,56', 'Reload restores format choices and uses the current profile currency');
assert.equal(reloaded.fmtDate('2026-09-17'), '2026-09-17');
reloaded.setPreferredCurrency(null);
assert.equal(reloaded.fmt(1), 'MAD 1,00', 'Sign-out resets the currency fallback');
storage.set('spliteasy.dateFormat', 'invalid');
storage.set('spliteasy.numberFormat', 'invalid');
reloaded.loadLocalPreferences();
assert.equal(reloaded.fmtDate('2026-09-17'), '17/09/2026');
assert.equal(reloaded.fmt(1), 'MAD 1.00');

const restricted = app(new Map(), true, true);
restricted.loadLocalPreferences();
restricted.setDisplayPreference('numberFormat', 'comma');
assert.equal(restricted.fmt(1234.56), 'MAD 1.234,56', 'Preferences still apply when browser storage is disabled');
const server = app(storage, false);
server.setPreferredCurrency('EUR');
assert.equal(server.fmt(1), 'MAD 1.00', 'Server formatting never leaks another session’s preferences');
assert.equal(server.getServerPreferences(), server.DEFAULT_PREFERENCES);
console.log(`Preference checks passed in ${process.env.TZ}`);
