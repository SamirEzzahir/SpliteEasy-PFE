// lib/api/reports.ts — user-facing content reporting (POST /reports).

import { api } from "./client";

export interface CreateReportPayload {
  target_type: "user" | "group" | "expense" | "message";
  target_id: number;
  reason: "spam" | "abuse" | "fake_account" | "inappropriate" | "other";
  description?: string;
}

export const REPORT_REASON_OPTIONS = [
  { id: "spam", label: "Spam" },
  { id: "abuse", label: "Abuse" },
  { id: "fake_account", label: "Fake account" },
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "other", label: "Other" },
];

export const reportsApi = {
  async create(payload: CreateReportPayload) {
    return (await api.post("/reports", payload)).data;
  },
};
