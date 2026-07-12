// lib/api/dashboard.ts

import { api } from "./client";
import type { ApiDashboardSummary } from "./types";

export const dashboardApi = {
  async summary(): Promise<ApiDashboardSummary> {
    const r = await api.get<ApiDashboardSummary>("/dashboard/summary");
    return r.data;
  },
};
