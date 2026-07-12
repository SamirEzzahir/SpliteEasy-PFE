"use client";
// app/admin/settings/page.tsx — platform settings: general, auth, maintenance,
// upload, and feature flags. Edits require `manage_settings`.

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/Icon";
import Skeleton from "@/components/Skeleton";
import { usePerms } from "@/components/admin/usePerms";
import { usePublicSettings } from "@/lib/public-settings";
import { adminApi, type PlatformSettings } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 600 }}>{title}</h3>
      {desc && <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--ink-4)" }}>{desc}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)" }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{hint}</div>}
      </div>
      <button
        type="button"
        className={"switch switch-light" + (checked ? " on" : "")}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        aria-pressed={checked}
        aria-label={label}
        style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
      />
    </div>
  );
}

function TextField({ label, value, onChange, disabled, type = "text", placeholder }: { label: string; value: string | number; onChange: (v: string) => void; disabled?: boolean; type?: string; placeholder?: string }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} />
    </div>
  );
}

export default function AdminSettingsPage() {
  const { has } = usePerms();
  const canManage = has("manage_settings");
  const { refresh: refreshPublic } = usePublicSettings();

  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setSettings(await adminApi.settings()); }
    catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function set<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await adminApi.updateSettings(settings);
      await refreshPublic();
      toast.success("Settings saved");
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setSaving(false); }
  }

  if (loading || !settings) {
    return (
      <div>
        <PageHeader title="Settings" subtitle="Platform configuration" />
        <div className="card" style={{ padding: 20 }}>
          <Skeleton width="40%" height={18} />
          <Skeleton width="80%" height={14} style={{ marginTop: 12 }} />
          <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
        </div>
      </div>
    );
  }

  const ro = !canManage;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Platform configuration"
        actions={canManage ? (
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <Icon name="check" size={15} /> {saving ? "Saving…" : "Save changes"}
          </button>
        ) : undefined}
      />

      {!canManage && (
        <div className="card" style={{ padding: 14, marginBottom: 16, fontSize: 13, color: "var(--ink-3)" }}>
          You have read-only access to settings.
        </div>
      )}

      <Section title="General" desc="Application identity and locale.">
        <TextField label="Application name" value={settings.app_name} onChange={(v) => set("app_name", v)} disabled={ro} />
        <TextField label="Description" value={settings.app_description} onChange={(v) => set("app_description", v)} disabled={ro} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField label="Logo URL" value={settings.logo_url} onChange={(v) => set("logo_url", v)} disabled={ro} placeholder="https://…" />
          <TextField label="Favicon URL" value={settings.favicon_url} onChange={(v) => set("favicon_url", v)} disabled={ro} placeholder="https://…" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField label="Default language" value={settings.default_language} onChange={(v) => set("default_language", v)} disabled={ro} placeholder="en" />
          <TextField label="Default timezone" value={settings.default_timezone} onChange={(v) => set("default_timezone", v)} disabled={ro} placeholder="UTC" />
        </div>
      </Section>

      <Section title="Authentication" desc="Sign-up and session policy.">
        <Toggle label="Allow new registrations" hint="When off, the signup endpoint is blocked." checked={settings.registration_enabled} onChange={(v) => set("registration_enabled", v)} disabled={ro} />
        <Toggle label="Require email verification" hint="Stored now; enforced once email delivery is added." checked={settings.email_verification_enabled} onChange={(v) => set("email_verification_enabled", v)} disabled={ro} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField label="Session timeout (minutes)" type="number" value={settings.session_timeout_minutes} onChange={(v) => set("session_timeout_minutes", Number(v) || 0)} disabled={ro} />
          <TextField label="Minimum password length" type="number" value={settings.password_min_length} onChange={(v) => set("password_min_length", Number(v) || 0)} disabled={ro} />
        </div>
      </Section>

      <Section title="Maintenance" desc="Take the app offline for everyone except administrators.">
        <Toggle label="Maintenance mode" hint="Non-admin requests receive a 503 maintenance response." checked={settings.maintenance_mode} onChange={(v) => set("maintenance_mode", v)} disabled={ro} />
        <Toggle label="Allow administrators during maintenance" checked={settings.maintenance_allow_admins} onChange={(v) => set("maintenance_allow_admins", v)} disabled={ro} />
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Maintenance message</label>
          <textarea
            value={settings.maintenance_message}
            onChange={(e) => set("maintenance_message", e.target.value)}
            disabled={ro}
            rows={2}
            style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13.5, outline: "none", background: "var(--surface)", color: "var(--ink)", resize: "vertical", fontFamily: "inherit" }}
          />
        </div>
      </Section>

      <Section title="Uploads" desc="Limits applied once file uploads are available.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField label="Max upload size (MB)" type="number" value={settings.upload_max_mb} onChange={(v) => set("upload_max_mb", Number(v) || 0)} disabled={ro} />
          <TextField label="Allowed file types" value={settings.upload_allowed_types} onChange={(v) => set("upload_allowed_types", v)} disabled={ro} placeholder="jpg,png,pdf" />
        </div>
      </Section>

      <Section title="Feature flags" desc="Enable or disable platform features without code changes.">
        <Toggle label="Group chat" checked={settings.feature_chat} onChange={(v) => set("feature_chat", v)} disabled={ro} />
        <Toggle label="Notifications" checked={settings.feature_notifications} onChange={(v) => set("feature_notifications", v)} disabled={ro} />
        <Toggle label="Budget module (Économé)" checked={settings.feature_budget} onChange={(v) => set("feature_budget", v)} disabled={ro} />
        <Toggle label="Reports" checked={settings.feature_reports} onChange={(v) => set("feature_reports", v)} disabled={ro} />
        <Toggle label="Support center" checked={settings.feature_support} onChange={(v) => set("feature_support", v)} disabled={ro} />
      </Section>
    </div>
  );
}
