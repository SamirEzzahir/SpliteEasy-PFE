/* Run with: node scripts/check-expense-splits.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../frontend/node_modules/typescript');
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(`${__dirname}/../frontend/${file}`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  new Function('exports', code)(exports);
  return exports;
}
const { mapExpense } = load('lib/api/mappers.ts');
const { expenseShare, allocateShares } = load('lib/expense-split.ts');
for (const [apiType, uiType, shares] of [
  ['percentage', 'percentage', [70, 30]],
  ['share', 'custom', [80, 20]],
  ['share', 'custom', [0, 100]],
]) {
  const expense = mapExpense({ id: 'expense', group_id: 'group', payer_id: 'a',
    description: 'Dinner', amount: 100, currency: 'MAD', created_at: '2026-09-17T10:00:00Z',
    split_type: apiType, splits: shares.map((share_amount, i) => ({ user_id: ['a', 'b'][i], share_amount })) });
  assert.equal(expense.splitType, uiType);
  assert.equal(expenseShare(expense, 'a'), shares[0]);
  assert.equal(expenseShare(expense, 'b'), shares[1]);
  assert.equal(expenseShare(expense, 'payer-outside-split'), 0);
}
const legacy = { amount: 10, splitIds: ['a', 'b', 'c'] };
assert.deepEqual(['a', 'b', 'c'].map(id => expenseShare(legacy, id)), [3.34, 3.33, 3.33]);
assert.equal(expenseShare({ amount: 10, splitIds: [] }, 'a', ['a', 'b']), 5);
assert.deepEqual(allocateShares(100, ['a', 'b'], { a: 70, b: 30 }), { a: 70, b: 30 });
console.log('PASS: saved split methods, unequal/zero shares, excluded payer and cent allocation.');
