const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
const source = fs.readFileSync(path.join(__dirname, '../frontend/lib/currency-conversion.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exported = {};
new Function('exports', compiled)(exported);
const convert = exported.convertCurrencyTotal;
const amounts = [{ currency: 'MAD', amount: 171 }, { currency: 'USD', amount: 20 }, { currency: 'EUR', amount: 8 }];
const before = JSON.stringify(amounts);
const rates = { USD: 1, MAD: 10, EUR: 0.8 };
assert.equal(convert(amounts, 'MAD', rates).total, 471);
assert(Math.abs(convert(amounts, 'USD', rates).total - 47.1) < 1e-10);
assert(Math.abs(convert(amounts, 'EUR', rates).total - 37.68) < 1e-10);
assert.equal(JSON.stringify(amounts), before);
assert.equal(convert([{ currency: 'MAD', amount: 171 }], 'MAD').total, 171);
assert.equal(convert([], 'MAD').total, 0);
assert.equal(convert([{ currency: 'XYZ', amount: 0 }], 'MAD').total, 0);
assert.equal(convert(amounts, 'MAD', { USD: 1, MAD: 10 }).total, null);
assert.deepEqual(convert(amounts, 'MAD', { USD: 1, MAD: 10 }).missing, ['EUR']);
for (const bad of [0, -1, Infinity, NaN]) {
  assert.equal(convert(amounts, 'MAD', { ...rates, EUR: bad }).total, null);
}
assert.equal(convert([{ currency: 'USD', amount: -20 }], 'MAD', rates).total, -200);
assert.equal(convert(amounts, 'MAD', { ...rates, MAD: 11 }).total, 501);
console.log('PASS: cross-rates, preferred currency changes, changing quotes, missing rates and original amounts preserved.');
