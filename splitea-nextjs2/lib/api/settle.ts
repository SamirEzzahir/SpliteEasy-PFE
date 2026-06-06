// lib/api/settle.ts

import { api } from "./client";
import type { ApiBalanceEntry, ApiGlobalBalance, ApiSettlement } from "./types";

export const settleApi = {
  // Group-level
  async groupBalances(groupId: number): Promise<ApiBalanceEntry[]> {
    const r = await api.get<ApiBalanceEntry[]>(`/settle/${groupId}/balances`);
    return r.data;
  },
  async groupSuggested(groupId: number): Promise<{
    from_user_id: number;
    to_user_id: number;
    amount: number;
  }[]> {
    const r = await api.get(`/settle/${groupId}/suggested`);
    return r.data as any;
  },
  async recordGroup(payload: {
    group_id: number;
    from_user_id: number;
    to_user_id: number;
    amount: number;
    description?: string;
  }): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/${payload.group_id}/record`, payload);
    return r.data;
  },

  // Global
  async globalBalances(): Promise<ApiGlobalBalance[]> {
    const r = await api.get<ApiGlobalBalance[]>("/settle/global/balances");
    return r.data;
  },
  async recordGlobal(payload: {
    from_user_id: number;
    to_user_id: number;
    amount: number;
    description?: string;
  }): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>("/settle/global/record", payload);
    return r.data;
  },
  async acceptGlobal(id: number): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/global/accept/${id}`);
    return r.data;
  },
  async rejectGlobal(id: number): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/global/reject/${id}`);
    return r.data;
  },
  async globalHistory(): Promise<ApiSettlement[]> {
    const r = await api.get<ApiSettlement[]>("/settle/global/history");
    return r.data;
  },
};
