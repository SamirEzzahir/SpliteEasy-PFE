/* Run with: node scripts/check-group-summary.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../frontend/node_modules/typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../frontend/lib/group-summary.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exported = {};
new Function('exports', compiled)(exported);
const { summarizeGroups } = exported;

// The reported MAD 171 must retain its currency independently of preferences.
assert.deepEqual(summarizeGroups([{ currency: 'MAD', total: 171, balance: 40 }]), {
  active: 1, currencies: [{ currency: 'MAD', total: 171, owed: 40, owe: 0 }],
});

// Do not add dollars to dirhams or cancel a dollar debt against a MAD credit.
const groups = [
  { currency: 'MAD', total: 171, balance: 40 },
  { currency: 'USD', total: 20, balance: -10 },
  { currency: 'MAD', total: 29, balance: -5 },
  { currency: 'USD', total: 30, balance: 15 },
];
const snapshot = JSON.stringify(groups);
assert.deepEqual(summarizeGroups(groups), {
  active: 4, currencies: [
    { currency: 'MAD', total: 200, owed: 40, owe: 5 },
    { currency: 'USD', total: 50, owed: 15, owe: 10 },
  ],
});
assert.equal(JSON.stringify(groups), snapshot);
assert.deepEqual(summarizeGroups([]), { active: 0, currencies: [] });
assert.deepEqual(summarizeGroups([{ total: 171, balance: 0 }, { currency: 'mad', total: 0, balance: 0 }]).currencies,
  [{ currency: 'MAD', total: 171, owed: 0, owe: 0 }]);
console.log('PASS: group spending and balances keep original currencies, aggregate matching currencies and handle empty/legacy groups.');
