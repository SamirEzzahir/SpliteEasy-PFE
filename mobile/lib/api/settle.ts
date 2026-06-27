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
    const r = await api.get(`/settle/${groupId}/settlements`);
    return r.data as {
      from_user_id: number;
      to_user_id: number;
      amount: number;
    }[];
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
    const r = await api.post<ApiSettlement>(`/settle/global/${id}/accept`);
    return r.data;
  },
  async rejectGlobal(id: number): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/global/${id}/reject`);
    return r.data;
  },
  async globalHistory(): Promise<ApiSettlement[]> {
    const r = await api.get<ApiSettlement[]>("/settle/global/history");
    return r.data;
  },

  // Group history / accept / reject
  async groupHistory(groupId: number): Promise<ApiSettlement[]> {
    const r = await api.get<ApiSettlement[]>(`/settle/${groupId}/history`);
    return r.data;
  },
  async acceptSettlement(id: number): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/${id}/accept`);
    return r.data;
  },
  async rejectSettlement(id: number, reason?: string): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/${id}/reject`, reason ? { message: reason } : undefined);
    return r.data;
  },
  async resendSettlement(id: number, amount: number, toUserId: number, message?: string): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/${id}/resend`, { to_user_id: toUserId, amount, message });
    return r.data;
  },
};
