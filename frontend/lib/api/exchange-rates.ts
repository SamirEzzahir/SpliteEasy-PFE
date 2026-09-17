import { api } from "./client";

export interface ExchangeRateSnapshot {
  base_currency: string;
  rates: Record<string, number>;
  updated_at: string;
  next_update_at: string;
  provider: string;
  provider_url: string;
  update_frequency: string;
  stale: boolean;
  refresh_after_seconds: number;
}

export async function fetchExchangeRates(signal: AbortSignal): Promise<ExchangeRateSnapshot> {
  const response = await api.get<ExchangeRateSnapshot>("/exchange-rates/latest", { signal, timeout: 12000 });
  return response.data;
}
