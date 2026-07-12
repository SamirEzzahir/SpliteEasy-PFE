// lib/api/econome.ts — money-jar (6-jar) endpoints

import { api } from "./client";
import type {
  ApiIncomeLog,
  ApiJarBalance,
  ApiJarStrategy,
  ApiJarTransaction,
  JarCode,
} from "./types";

export interface CreateStrategyPayload {
  name: string;
  necessities_pct: number;
  financial_freedom_pct: number;
  education_pct: number;
  long_term_savings_pct: number;
  play_pct: number;
  give_pct: number;
  is_default?: boolean;
}

export interface DistributePayload {
  amount: number;
  source_name?: string;
  strategy_id?: number;
}

export interface SpendPayload {
  jar_type: JarCode;
  amount: number;
  description?: string;
}

export const economeApi = {
  async strategies(): Promise<ApiJarStrategy[]> {
    const r = await api.get<ApiJarStrategy[]>("/econome/strategies");
    return r.data;
  },
  async createStrategy(p: CreateStrategyPayload): Promise<ApiJarStrategy> {
    const r = await api.post<ApiJarStrategy>("/econome/strategies", p);
    return r.data;
  },
  async updateStrategy(id: number, p: Partial<CreateStrategyPayload>): Promise<ApiJarStrategy> {
    const r = await api.put<ApiJarStrategy>(`/econome/strategies/${id}`, p);
    return r.data;
  },
  async deleteStrategy(id: number): Promise<void> {
    await api.delete(`/econome/strategies/${id}`);
  },
  async distribute(p: DistributePayload): Promise<ApiIncomeLog> {
    const r = await api.post<ApiIncomeLog>("/econome/distribute", p);
    return r.data;
  },
  async spend(p: SpendPayload): Promise<ApiJarTransaction> {
    const r = await api.post<ApiJarTransaction>("/econome/spend", p);
    return r.data;
  },
  async balances(): Promise<ApiJarBalance[]> {
    const r = await api.get<ApiJarBalance[]>("/econome/balances");
    return r.data;
  },
  async ledger(): Promise<ApiJarTransaction[]> {
    const r = await api.get<ApiJarTransaction[]>("/econome/ledger");
    return r.data;
  },
  async transfer(from: JarCode, to: JarCode, amount: number): Promise<void> {
    await api.post("/econome/transfer", { from_jar: from, to_jar: to, amount });
  },
  async incomeLogs(): Promise<ApiIncomeLog[]> {
    const r = await api.get<ApiIncomeLog[]>("/econome/ledger");
    return r.data;
  },
};
