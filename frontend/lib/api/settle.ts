// lib/api/settle.ts

import { api } from "./client";
import type { ApiBalanceEntry, ApiGlobalBalance, ApiSettlement } from "./types";

export const settleApi = {
  // Group-level
  async groupBalances(groupId: string): Promise<ApiBalanceEntry[]> {
    const r = await api.get<ApiBalanceEntry[]>(`/settle/${groupId}/balances`);
    return r.data;
  },
  async groupSuggested(groupId: string): Promise<{
    from_user_id: string;
    to_user_id: string;
    amount: number;
  }[]> {
    const r = await api.get(`/settle/${groupId}/settlements`);
    return r.data as any;
  },
  async recordGroup(payload: {
    group_id: string;
    from_user_id: string;
    to_user_id: string;
    amount: number;
    description?: string;
  }): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/${payload.group_id}/record`, payload);
    return r.data;
  },

  // Global (cross-group, between friends)
  async globalBalances(): Promise<ApiGlobalBalance[]> {
    const r = await api.get<ApiGlobalBalance[]>("/settle/global/balances");
    return r.data;
  },
  // Simplified/suggested transfers from the current user's perspective.
  async globalSuggested(): Promise<ApiSettlement[]> {
    const r = await api.get<ApiSettlement[]>("/settle/global/settlements");
    return r.data;
  },
  async recordGlobal(payload: {
    currency?: string;
    to_user_id: string;
    amount: number;
    message?: string;
  }): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>("/settle/global/record", payload);
    return r.data;
  },
  async acceptGlobal(id: string): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/global/${id}/accept`);
    return r.data;
  },
  async rejectGlobal(id: string, reason?: string): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/global/${id}/reject`, { reason: reason ?? null });
    return r.data;
  },
  async resendGlobal(id: string, amount: number, toUserId: string, message?: string): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/global/${id}/resend`, { to_user_id: toUserId, amount, message });
    return r.data;
  },
  async globalHistory(): Promise<ApiSettlement[]> {
    const r = await api.get<ApiSettlement[]>("/settle/global/history");
    return r.data;
  },

  // Group history / accept / reject
  async groupHistory(groupId: string): Promise<ApiSettlement[]> {
    const r = await api.get<ApiSettlement[]>(`/settle/${groupId}/history`);
    return r.data;
  },
  async acceptSettlement(id: string): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/${id}/accept`);
    return r.data;
  },
  async rejectSettlement(id: string, reason?: string): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/${id}/reject`, reason ? { message: reason } : undefined);
    return r.data;
  },
  async resendSettlement(id: string, amount: number, toUserId: string, message?: string): Promise<ApiSettlement> {
    const r = await api.post<ApiSettlement>(`/settle/${id}/resend`, { to_user_id: toUserId, amount, message });
    return r.data;
  },
};
