export interface CurrencyAmount {
  currency: string;
  amount: number;
}

/** Rates share one base. Keep full precision until formatting the final total. */
export function convertCurrencyTotal(amounts: CurrencyAmount[], target: string, rates: Record<string, number> = {}) {
  let total = 0;
  const missing = new Set<string>();
  const valid = (rate: number | undefined) => typeof rate === "number" && Number.isFinite(rate) && rate > 0;
  for (const { currency, amount } of amounts) {
    if (amount === 0) continue;
    if (currency === target) { total += amount; continue; }
    if (!valid(rates[currency])) missing.add(currency);
    if (!valid(rates[target])) missing.add(target);
    if (valid(rates[currency]) && valid(rates[target])) total += amount / rates[currency] * rates[target];
  }
  return { total: missing.size ? null : total, missing: Array.from(missing).sort() };
}
