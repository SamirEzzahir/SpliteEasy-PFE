import { api } from "./client";

export const MONEY_CURRENCIES = ["MAD", "EUR", "USD", "GBP", "CAD", "CHF", "AED", "SAR", "TND", "DZD"];
export interface WalletType { id: string; name: string; user_id: string | null; archived_at: string | null; }
export interface Wallet { id: string; name: string; category: string; wallet_type_id: string; user_id: string; balance: string; currency: string | null; archived_at: string | null; needs_currency: boolean; }
export interface MoneyEvent { id: string; kind: string; description: string; amount: string; currency: string; personal_share: string | null; date: string; created_at: string; source_type: string | null; source_id: string | null; reversed_at: string | null; reversal_of: string | null; entries: {wallet_id: string; wallet_name: string; amount: string; balance_after: string}[]; }
export interface MoneySummary { currency: string; month: string; balance: string; income: string; spending: string; shared_net: string; owed_to_you: string; you_owe: string; }
export interface Budget { id: string; name: string; percent: number; currency: string; balance: string; allocated: string; spent: string; }
export interface WalletSettlement { id: string; scope: string; amount: string; currency: string; direction: "received" | "paid"; person: string; date: string; }
export interface MoneyActivity { items: MoneyEvent[]; total: number; page: number; limit: number; }
export interface WalletInput { name: string; wallet_type_id: string; currency: string; balance: string; idempotency_key: string; }

export const walletsApi = {
  list: async (includeArchived = false) => (await api.get<Wallet[]>("/wallets", {params:{include_archived:includeArchived}})).data,
  types: async () => (await api.get<WalletType[]>("/wallet-types")).data,
  createType: async (name: string) => (await api.post<WalletType>("/wallet-types", {name})).data,
  renameType: async (id: string, name: string) => (await api.put<WalletType>(`/wallet-types/${id}`, {name})).data,
  archiveType: async (id: string) => { await api.delete(`/wallet-types/${id}`); },
  create: async (data: WalletInput) => (await api.post<Wallet>("/wallets", data)).data,
  update: async (id: string, data: {name?: string; wallet_type_id?: string; currency?: string; archived?: boolean}) => (await api.put<Wallet>(`/wallets/${id}`, data)).data,
  adjustment: async (id: string, data: {balance: string; description: string; idempotency_key: string}) => (await api.post<MoneyEvent>(`/wallets/${id}/adjustments`, data)).data,
};

export const moneyApi = {
  summary: async (currency: string, month?: string) => (await api.get<MoneySummary>("/money/summary", {params:{currency,month}})).data,
  activity: async (params: {currency?: string; wallet_id?: string; kind?: string; month?: string; page?: number; limit?: number}) => (await api.get<MoneyActivity>("/money/activity", {params})).data,
  budgets: async (currency: string) => (await api.get<Budget[]>("/money/budgets", {params:{currency}})).data,
  settlements: async (currency: string) => (await api.get<WalletSettlement[]>("/money/settlements", {params:{currency}})).data,
  record: async (kind: "income" | "spending" | "transfer" | "budgets/transfer", data: Record<string, unknown>) => (await api.post<MoneyEvent>(`/money/${kind}`, data)).data,
  receive: async (settlement: WalletSettlement, walletId: string, key: string) => (await api.post<MoneyEvent>(`/money/settlements/${settlement.scope}/${settlement.id}/record`, {wallet_id:walletId,idempotency_key:key})).data,
  reverse: async (event: MoneyEvent) => { if(event.source_type === "income" && event.source_id) await api.delete(`/incomes/${event.source_id}`); else await api.post(`/money/events/${event.id}/reverse`); },
  allocate: async (eventId: string, strategyId?: string) => { await api.post("/money/budgets/allocate", {event_id:eventId,strategy_id:strategyId}); },
};

export function moneyChanged() { window.dispatchEvent(new Event("money:changed")); }
