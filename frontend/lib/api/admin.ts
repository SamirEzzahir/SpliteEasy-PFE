// lib/api/admin.ts — typed client for the admin panel API (/admin/*).
// Mirrors backend/schemas/admin.py. Every list endpoint returns Paginated<T>.

import { api } from "./client";
import type { Ticket, TicketDetail, TicketReply, TicketListParams } from "./support";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AdminRole {
  id: number;
  name: string;
  permissions: string; // JSON string array
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  gender?: string | null;
  profile_photo?: string | null;
  is_active: boolean;
  status: "active" | "suspended" | "banned";
  status_reason?: string | null;
  email_verified: boolean;
  last_login_at?: string | null;
  created_at?: string | null;
  role_id?: number | null;
  role?: AdminRole | null;
  preferred_currency?: string | null;
}

export interface AdminUserDetail extends AdminUser {
  groups_count: number;
  owned_groups_count: number;
  expenses_count: number;
  settlements_count: number;
}

export interface AdminGroup {
  id: number;
  title: string;
  type?: string | null;
  currency?: string | null;
  owner_id?: number | null;
  owner_username?: string | null;
  members_count: number;
  expenses_count: number;
  created_at?: string | null;
}

export interface AdminExpense {
  id: number;
  group_id: number;
  group_title?: string | null;
  payer_id?: number | null;
  payer_username?: string | null;
  description?: string | null;
  amount: number;
  currency?: string | null;
  category?: string | null;
  created_at?: string | null;
}

export interface AdminSettlement {
  id: number;
  group_id?: number | null;
  from_user_id: number;
  from_username?: string | null;
  to_user_id: number;
  to_username?: string | null;
  amount: number;
  status: "pending" | "accepted" | "rejected";
  created_at?: string | null;
}

export interface AuditLog {
  id: number;
  admin_id?: number | null;
  admin_username?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: number | null;
  details?: string | null;
  ip?: string | null;
  created_at: string;
}

export interface DayCount {
  label: string;
  value: number;
}

export interface DashboardStats {
  total_users: number;
  active_users: number;
  suspended_users: number;
  banned_users: number;
  new_users_7d: number;
  total_groups: number;
  total_expenses: number;
  total_settlements: number;
  pending_settlements: number;
  pending_support: number;
  signups_last_14d: DayCount[];
  expenses_last_14d: DayCount[];
}

export interface PermissionInfo {
  key: string;
  label: string;
  group: string;
}

export interface PlatformSettings {
  app_name: string;
  app_description: string;
  logo_url: string;
  favicon_url: string;
  default_language: string;
  default_timezone: string;
  registration_enabled: boolean;
  email_verification_enabled: boolean;
  session_timeout_minutes: number;
  password_min_length: number;
  maintenance_mode: boolean;
  maintenance_message: string;
  maintenance_allow_admins: boolean;
  upload_max_mb: number;
  upload_allowed_types: string;
  feature_chat: boolean;
  feature_notifications: boolean;
  feature_budget: boolean;
  feature_reports: boolean;
  feature_support: boolean;
}

export interface ModerationReport {
  id: number;
  reporter_id?: number | null;
  reporter_username?: string | null;
  target_type: string;
  target_id: number;
  target_username?: string | null;
  reason: string;
  description?: string | null;
  status: string;
  notes?: string | null;
  handled_by?: number | null;
  handled_by_username?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  type: string;
  visibility: string;
  delivery: string;
  publish_at?: string | null;
  expires_at?: string | null;
  is_published: boolean;
  created_by?: number | null;
  author_username?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface AnalyticsPoint { label: string; value: number; }
export interface AnalyticsResult {
  granularity: string;
  series: Record<string, AnalyticsPoint[]>;
  totals: Record<string, number>;
}

export interface SystemHealth {
  backend: string;
  database: string;
  websocket: { status: string; active_connections: number };
  app_version: string;
  build_version: string;
  uptime_seconds: number;
  cpu_percent: number | null;
  memory_percent: number | null;
  disk_percent: number | null;
  metrics_available: boolean;
}

export interface ListParams {
  page?: number;
  page_size?: number;
  q?: string;
  [key: string]: string | number | undefined;
}

export const adminApi = {
  // Dashboard
  async overview(): Promise<DashboardStats> {
    return (await api.get<DashboardStats>("/admin/stats/overview")).data;
  },
  async recentActivity(limit = 10): Promise<Paginated<AuditLog>> {
    return (await api.get<Paginated<AuditLog>>("/admin/stats/recent-activity", { params: { limit } })).data;
  },

  // Users
  async users(params: ListParams = {}): Promise<Paginated<AdminUser>> {
    return (await api.get<Paginated<AdminUser>>("/admin/users", { params })).data;
  },
  async user(id: number): Promise<AdminUserDetail> {
    return (await api.get<AdminUserDetail>(`/admin/users/${id}`)).data;
  },
  async updateUser(id: number, body: Partial<Pick<AdminUser, "username" | "email" | "first_name" | "last_name" | "phone" | "email_verified">>) {
    return (await api.put<AdminUser>(`/admin/users/${id}`, body)).data;
  },
  async setUserStatus(id: number, status: string, reason?: string) {
    return (await api.post(`/admin/users/${id}/status`, { status, reason })).data;
  },
  async setUserRole(id: number, role_id: number | null) {
    return (await api.post(`/admin/users/${id}/role`, { role_id })).data;
  },
  async resetPassword(id: number, new_password: string) {
    return (await api.post(`/admin/users/${id}/reset-password`, { new_password })).data;
  },
  async forceLogout(id: number) {
    return (await api.post(`/admin/users/${id}/force-logout`)).data;
  },
  async verifyEmail(id: number) {
    return (await api.post(`/admin/users/${id}/verify-email`)).data;
  },
  async deleteUser(id: number) {
    return (await api.delete(`/admin/users/${id}`)).data;
  },

  // Groups
  async groups(params: ListParams = {}): Promise<Paginated<AdminGroup>> {
    return (await api.get<Paginated<AdminGroup>>("/admin/groups", { params })).data;
  },
  async deleteGroup(id: number) {
    return (await api.delete(`/admin/groups/${id}`)).data;
  },
  async transferOwner(id: number, new_owner_id: number) {
    return (await api.post(`/admin/groups/${id}/transfer-owner`, { new_owner_id })).data;
  },

  // Expenses
  async expenses(params: ListParams = {}): Promise<Paginated<AdminExpense>> {
    return (await api.get<Paginated<AdminExpense>>("/admin/expenses", { params })).data;
  },
  async deleteExpense(id: number) {
    return (await api.delete(`/admin/expenses/${id}`)).data;
  },

  // Settlements
  async settlements(params: ListParams = {}): Promise<Paginated<AdminSettlement>> {
    return (await api.get<Paginated<AdminSettlement>>("/admin/settlements", { params })).data;
  },
  async cancelSettlement(id: number) {
    return (await api.post(`/admin/settlements/${id}/cancel`)).data;
  },

  // Support tickets
  async tickets(params: TicketListParams & { priority?: string; assigned_to_id?: number } = {}): Promise<Paginated<Ticket>> {
    return (await api.get<Paginated<Ticket>>("/admin/tickets", { params })).data;
  },
  async ticket(id: number): Promise<TicketDetail> {
    return (await api.get<TicketDetail>(`/admin/tickets/${id}`)).data;
  },
  async ticketReply(id: number, body: string): Promise<TicketReply> {
    return (await api.post<TicketReply>(`/admin/tickets/${id}/replies`, { body })).data;
  },
  async ticketStatus(id: number, status: string) {
    return (await api.post(`/admin/tickets/${id}/status`, { status })).data;
  },
  async ticketPriority(id: number, priority: string) {
    return (await api.post(`/admin/tickets/${id}/priority`, { priority })).data;
  },
  async ticketAssign(id: number, assignee_id: number | null) {
    return (await api.post(`/admin/tickets/${id}/assign`, { assignee_id })).data;
  },
  async ticketAssignees(): Promise<{ id: number; username: string }[]> {
    return (await api.get<{ id: number; username: string }[]>("/admin/tickets-assignees")).data;
  },

  // Roles & permissions
  async roles(): Promise<AdminRole[]> {
    return (await api.get<AdminRole[]>("/admin/roles")).data;
  },
  async permissions(): Promise<PermissionInfo[]> {
    return (await api.get<{ permissions: PermissionInfo[] }>("/admin/permissions")).data.permissions;
  },
  async createRole(name: string, permissions: string) {
    return (await api.post<AdminRole>("/admin/roles", { name, permissions })).data;
  },
  async updateRole(id: number, body: { name?: string; permissions?: string }) {
    return (await api.put<AdminRole>(`/admin/roles/${id}`, body)).data;
  },
  async deleteRole(id: number) {
    return (await api.delete(`/admin/roles/${id}`)).data;
  },

  // Audit logs
  async auditLogs(params: ListParams = {}): Promise<Paginated<AuditLog>> {
    return (await api.get<Paginated<AuditLog>>("/admin/audit-logs", { params })).data;
  },

  // Platform settings
  async settings(): Promise<PlatformSettings> {
    return (await api.get<PlatformSettings>("/admin/settings")).data;
  },
  async updateSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
    return (await api.put<PlatformSettings>("/admin/settings", patch)).data;
  },

  // Moderation
  async reports(params: ListParams & { status?: string; reason?: string; target_type?: string } = {}): Promise<Paginated<ModerationReport>> {
    return (await api.get<Paginated<ModerationReport>>("/admin/reports", { params })).data;
  },
  async report(id: number): Promise<ModerationReport> {
    return (await api.get<ModerationReport>(`/admin/reports/${id}`)).data;
  },
  async reportStatus(id: number, status: string) {
    return (await api.post(`/admin/reports/${id}/status`, { status })).data;
  },
  async reportNotes(id: number, notes: string) {
    return (await api.post(`/admin/reports/${id}/notes`, { notes })).data;
  },
  async warnReport(id: number, message?: string) {
    return (await api.post(`/admin/reports/${id}/warn`, { message })).data;
  },

  // Announcements
  async announcements(params: ListParams = {}): Promise<Paginated<Announcement>> {
    return (await api.get<Paginated<Announcement>>("/admin/announcements", { params })).data;
  },
  async createAnnouncement(body: Partial<Announcement> & { publish_now?: boolean }): Promise<Announcement> {
    return (await api.post<Announcement>("/admin/announcements", body)).data;
  },
  async updateAnnouncement(id: number, body: Partial<Announcement>): Promise<Announcement> {
    return (await api.put<Announcement>(`/admin/announcements/${id}`, body)).data;
  },
  async publishAnnouncement(id: number): Promise<Announcement> {
    return (await api.post<Announcement>(`/admin/announcements/${id}/publish`)).data;
  },
  async deleteAnnouncement(id: number) {
    return (await api.delete(`/admin/announcements/${id}`)).data;
  },

  // Analytics & health
  async analytics(params: { from?: string; to?: string; granularity?: string } = {}): Promise<AnalyticsResult> {
    return (await api.get<AnalyticsResult>("/admin/analytics", { params })).data;
  },
  async system(): Promise<SystemHealth> {
    return (await api.get<SystemHealth>("/admin/system")).data;
  },
};

// ── Permission helpers (shared by the guard + sidebar) ───────────────────────

/** Parse a role's JSON permission string into an array (tolerant of bad data). */
export function parsePermissions(role?: { permissions?: string } | null): string[] {
  if (!role?.permissions) return [];
  try {
    const parsed = JSON.parse(role.permissions);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** True if the permission set grants `perm` (or holds the "*" wildcard). */
export function hasPermission(perms: string[], perm: string): boolean {
  return perms.includes("*") || perms.includes(perm);
}

/** True if the user has any admin-panel access at all. */
export function isAdminUser(role?: { permissions?: string } | null): boolean {
  return parsePermissions(role).length > 0;
}
