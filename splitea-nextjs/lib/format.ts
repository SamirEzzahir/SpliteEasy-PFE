// lib/format.ts — currency + chart helpers

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", MAD: "MAD ", JPY: "¥",
  CAD: "CA$", AUD: "A$", CHF: "CHF ", CNY: "¥", INR: "₹",
  BRL: "R$", MXN: "MX$", SAR: "SR ", AED: "AED ", TRY: "₺",
  KWD: "KD ", QAR: "QR ", DZD: "DA ", TND: "DT ", EGP: "E£",
};

export function currencySymbol(code?: string | null): string {
  if (!code) return "$";
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code.toUpperCase() + " ";
}

export const fmt = (n: number, currency?: string | null) =>
  currencySymbol(currency) + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt0 = (n: number, currency?: string | null) =>
  currencySymbol(currency) + Math.round(n).toLocaleString("en-US");

export const arc = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};

export const todayStr = () =>
  new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
