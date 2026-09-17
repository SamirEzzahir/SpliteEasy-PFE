/* Run with: node scripts/check-group-balances.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
const source = fs.readFileSync(path.join(__dirname, '../frontend/lib/group-balance.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exported = {};
new Function('exports', code)(exported);
const { groupBalanceSnapshot: snapshot, groupBalanceLabel: label } = exported;
const entry = (user_id, net) => ({ user_id, net });

// Server balances incorporate splits and only accepted repayments.
const unpaid = [entry('me', 50), entry('friend', -50)];
assert.deepEqual(snapshot(unpaid, 'me'), { balance: 50, outstanding: 50, balanceUnavailable: false });
assert.equal(label(snapshot(unpaid, 'me')), 'You are owed');
assert.equal(label(snapshot(unpaid, 'friend')), 'You owe');
assert.equal(snapshot([entry('me', 20), entry('friend', -20)], 'me').outstanding, 20);
assert.equal(label(snapshot([entry('me', 0), entry('friend', 0)], 'me')), 'Settled');

// A zero personal balance does not mean that everyone in the group is settled.
const others = snapshot([entry('me', 0), entry('a', 30), entry('b', -30)], 'me');
assert.equal(others.outstanding, 30);
assert.equal(label(others), 'Others have balances');
assert.equal(label(snapshot([entry('a', 30), entry('b', -30)], 'me')), 'Others have balances');
assert.equal(label(snapshot([], 'me')), 'Settled');

// Network and malformed-response errors must never become "Settled".
assert.equal(label(snapshot(null, 'me')), 'Balance unavailable');
assert.equal(label(snapshot([{ user_id: 'me' }], 'me')), 'Balance unavailable');
assert.equal(label(snapshot([entry('me', NaN)], 'me')), 'Balance unavailable');
assert.equal(snapshot([{ user_id: 'me', net: 0, balance: 99 }], 'me').balance, 0);
assert.equal(snapshot([{ user_id: 'me', balance: -12 }], 'me').balance, -12);
assert.equal(label(snapshot([entry('me', 0.000000001)], 'me')), 'Settled');
assert.equal(snapshot([entry('me', 0.1), entry('a', 0.2), entry('b', -0.3)], 'me').outstanding, 0.3);
console.log('PASS: owed, owe, partial/full repayment, other members, unavailable balances and rounding.');
