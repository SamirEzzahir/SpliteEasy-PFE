// lib/format.ts — currency + chart helpers

import { getPreferences } from "./preferences";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", MAD: "MAD ", JPY: "¥",
  CAD: "CA$", AUD: "A$", CHF: "CHF ", CNY: "¥", INR: "₹",
  BRL: "R$", MXN: "MX$", SAR: "SR ", AED: "AED ", TRY: "₺",
  KWD: "KD ", QAR: "QR ", DZD: "DA ", TND: "DT ", EGP: "E£",
};

export function currencySymbol(code?: string | null): string {
  const currency = (code || getPreferences().currency).toUpperCase();
  return CURRENCY_SYMBOLS[currency] ?? currency + " ";
}

export function fmtNumber(n: number, options: Intl.NumberFormatOptions = {}): string {
  const locale = { dot: "en-US", comma: "de-DE", space: "fr-FR" }[getPreferences().numberFormat];
  return n.toLocaleString(locale, options).replace(/[\u00a0\u202f]/g, " ");
}

export const fmt = (n: number, currency?: string | null) =>
  currencySymbol(currency) + fmtNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt0 = (n: number, currency?: string | null) =>
  currencySymbol(currency) + fmtNumber(Math.round(n));

export function displayDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // Calendar dates (due dates, date inputs) are local; API datetimes without an offset are UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`);
  return new Date(/^\d{4}-\d{2}-\d{2}T/.test(value) && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? `${value}Z` : value);
}

export function fmtDate(value?: string | Date | null): string {
  if (!value) return "—";
  const date = displayDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).padStart(4, "0");
  switch (getPreferences().dateFormat) {
    case "mdy": return `${month}/${day}/${year}`;
    case "iso": return `${year}-${month}-${day}`;
    default: return `${day}/${month}/${year}`;
  }
}

export function fmtDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const date = displayDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${fmtDate(date)} · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export const arc = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};

export const todayStr = () => fmtDate(new Date());
