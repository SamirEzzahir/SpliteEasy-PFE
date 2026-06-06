"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { apiErrorMessage } from "@/lib/api/client";
import { usersApi } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthContext";

type ThemeChoice = "system" | "light" | "dark";
type LangId = "en" | "fr" | "ar" | "es" | "de";

const LANGUAGES: Array<{ id: LangId; code: string; name: string }> = [
  { id: "en", code: "GB", name: "English" },
  { id: "fr", code: "FR", name: "Francais" },
  { id: "ar", code: "MA", name: "Arabic" },
  { id: "es", code: "ES", name: "Espanol" },
  { id: "de", code: "DE", name: "Deutsch" },
];

function splitName(name: string): { first_name: string | null; last_name: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: null, last_name: null };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" ") || null,
  };
}

function displayName(user: ReturnType<typeof useAuth>["user"]): string {
  if (!user) return "";
  const full = user.full_name || [user.first_name, user.last_name].filter(Boolean).join(" ");
  return full.trim() || user.username;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function joinedDate(value?: string): string {
  if (!value) return "Joined recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Joined recently";
  return `Joined ${date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

export default function SettingsPage() {
  const { user, refresh, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeChoice>("light");
  const [lang, setLang] = useState<LangId>("en");
  const [currency, setCurrency] = useState("MAD");
  const [dateFormat, setDateFormat] = useState("dmy");
  const [numberFormat, setNumberFormat] = useState("dot");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const name = useMemo(() => displayName(user), [user]);
  const avatar = initials(name || username);

  useEffect(() => {
    if (!user) return;
    setFullName(displayName(user));
    setUsername(user.username || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    if (user.preferred_currency) setCurrency(user.preferred_currency);
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTheme = (localStorage.getItem("spliteasy.theme") as ThemeChoice | null) || "light";
    setTheme(storedTheme);
    setLang((localStorage.getItem("spliteasy.lang") as LangId | null) || "en");
    setCurrency(localStorage.getItem("spliteasy.currency") || "MAD");
    setDateFormat(localStorage.getItem("spliteasy.dateFormat") || "dmy");
    setNumberFormat(localStorage.getItem("spliteasy.numberFormat") || "dot");

    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ choice?: ThemeChoice }>).detail;
      if (detail?.choice) setTheme(detail.choice);
    };
    window.addEventListener("spliteasy:theme-change", onThemeChange);
    return () => window.removeEventListener("spliteasy:theme-change", onThemeChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    localStorage.setItem("spliteasy.theme", theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const effective = theme === "system" ? (mq.matches ? "dark" : "light") : theme;
      document.documentElement.setAttribute("data-theme", effective);
      window.dispatchEvent(new CustomEvent("spliteasy:theme-change", {
        detail: { choice: theme, effective },
      }));
    };
    apply();
    if (theme === "system") {
      mq.addEventListener?.("change", apply);
      return () => mq.removeEventListener?.("change", apply);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("spliteasy.lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("spliteasy.currency", currency);
    usersApi.updatePreferredCurrency(currency).catch(() => {});
  }, [currency]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("spliteasy.dateFormat", dateFormat);
  }, [dateFormat]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("spliteasy.numberFormat", numberFormat);
  }, [numberFormat]);

  const flashSaved = () => {
    setSavedFlash(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedFlash(false), 1800);
  };

  const resetForm = () => {
    if (!user) return;
    setFullName(displayName(user));
    setUsername(user.username || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setError(null);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const names = splitName(fullName);
      await usersApi.updateProfile(user.id, {
        username,
        email,
        phone: phone || null,
        ...names,
      });
      await refresh();
      setEditing(false);
      flashSaved();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;
    setPasswordMsg(null);
    if (newPw !== confirmPw) {
      setPasswordMsg({ ok: false, text: "Passwords do not match." });
      return;
    }
    if (newPw.length < 6) {
      setPasswordMsg({ ok: false, text: "Use at least 6 characters." });
      return;
    }
    setPasswordSaving(true);
    try {
      await usersApi.changePassword(user.id, { old_password: oldPw, new_password: newPw });
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      setPasswordMsg({ ok: true, text: "Password changed successfully." });
    } catch (e) {
      setPasswordMsg({ ok: false, text: apiErrorMessage(e) });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    const ok = window.confirm("Deactivate your account? You will be signed out.");
    if (!ok) return;
    try {
      await usersApi.deactivate(user.id);
      logout();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  if (!user) return null;

  return (
    <>
      <div className="page-head settings-head">
        <div>
          <h1>Settings</h1>
          <p>Manage your profile, security, and display preferences.</p>
        </div>
      </div>

      <div className="settings-eyebrow">Account</div>

      <section className="settings-card">
        <div className="settings-card-h">
          <h2>Profile Information</h2>
          <div className="settings-actions">
            <span className={"saved-pill" + (savedFlash ? " show" : "")}>
              <Icon name="check" size={13} /> Saved
            </span>
            {editing && (
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Icon name="check" size={13} /> {saving ? "Saving..." : "Save"}
              </button>
            )}
            <button
              className={editing ? "btn btn-secondary" : "btn btn-outline-primary"}
              onClick={() => {
                if (editing) resetForm();
                setEditing((value) => !value);
              }}
              disabled={saving}
            >
              <Icon name="edit" size={13} /> {editing ? "Cancel" : "Edit Profile"}
            </button>
          </div>
        </div>

        {error && <div className="settings-error"><Icon name="info" size={14} /> {error}</div>}

        <div className="settings-profile">
          <div className="profile-photo-block">
            <div className="profile-photo">
              {avatar}
              <button className="profile-photo-cam" aria-label="Change photo" disabled>
                <Icon name="camera" size={13} />
              </button>
            </div>
            <div className="profile-photo-hint">Photo upload is coming soon.</div>
            <div className="profile-meta-since">
              <Icon name="calendar" size={11} /> {joinedDate(user.created_at)}
            </div>
          </div>

          <div className="settings-fields">
            <label className="field">
              <span>Full Name</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={!editing} />
            </label>
            <label className="field">
              <span>Username</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} disabled={!editing} />
            </label>
            <label className="field">
              <span>Email Address</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!editing} />
            </label>
            <label className="field">
              <span>Phone Number</span>
              <div className="phone-row">
                <select disabled={!editing} defaultValue="+212" aria-label="Country code">
                  <option value="+212">MA +212</option>
                  <option value="+1">US +1</option>
                  <option value="+33">FR +33</option>
                  <option value="+44">GB +44</option>
                  <option value="+34">ES +34</option>
                </select>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!editing} />
              </div>
            </label>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-h">
          <h2>Preferences</h2>
          <span className="sub">How numbers and dates are shown</span>
        </div>
        <div className="pref-grid">
          <div className="pref-tile">
            <div className="ic"><Icon name="coin" size={18} /></div>
            <div className="lbl">Currency</div>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="MAD">MAD — Moroccan Dirham</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — Pound Sterling</option>
              <option value="SAR">SAR — Saudi Riyal</option>
              <option value="AED">AED — UAE Dirham</option>
              <option value="DZD">DZD — Algerian Dinar</option>
              <option value="TND">TND — Tunisian Dinar</option>
              <option value="EGP">EGP — Egyptian Pound</option>
              <option value="CAD">CAD — Canadian Dollar</option>
              <option value="AUD">AUD — Australian Dollar</option>
              <option value="JPY">JPY — Japanese Yen</option>
              <option value="CHF">CHF — Swiss Franc</option>
              <option value="INR">INR — Indian Rupee</option>
              <option value="BRL">BRL — Brazilian Real</option>
              <option value="TRY">TRY — Turkish Lira</option>
            </select>
          </div>
          <div className="pref-tile">
            <div className="ic"><Icon name="calendar" size={18} /></div>
            <div className="lbl">Date format</div>
            <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
              <option value="dmy">DD / MM / YYYY</option>
              <option value="mdy">MM / DD / YYYY</option>
              <option value="iso">YYYY-MM-DD</option>
            </select>
          </div>
          <div className="pref-tile">
            <div className="ic"><Icon name="hash" size={18} /></div>
            <div className="lbl">Number format</div>
            <select value={numberFormat} onChange={(e) => setNumberFormat(e.target.value)}>
              <option value="dot">1,234.56</option>
              <option value="comma">1.234,56</option>
              <option value="space">1 234,56</option>
            </select>
          </div>
        </div>
      </section>

      <div className="settings-eyebrow">Display</div>

      <section className="settings-card">
        <div className="settings-card-h">
          <h2>Appearance</h2>
          <span className="sub">Choose how SplitEasy looks</span>
        </div>
        <div className="theme-grid">
          {(["system", "light", "dark"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              className={"theme-card" + (theme === choice ? " active" : "")}
              onClick={() => setTheme(choice)}
            >
              <div className={"theme-preview theme-preview--" + choice}>
                <span className="bar" />
                <span className="block" />
                <span className="block sm" />
              </div>
              <div className="theme-lbl">
                <span className="nm">{choice[0].toUpperCase() + choice.slice(1)}</span>
                <span className="check" />
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-h">
          <h2>Language</h2>
          <span className="sub">App language and region</span>
        </div>
        <div className="lang-pills">
          {LANGUAGES.map((language) => (
            <button
              key={language.id}
              type="button"
              className={"lang-pill" + (lang === language.id ? " active" : "")}
              onClick={() => setLang(language.id)}
            >
              <span className="flag">{language.code}</span>
              <span className="nm">{language.name}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="settings-eyebrow">Security</div>

      <section className="settings-card">
        <div className="settings-card-h">
          <h2>Security</h2>
          <span className="sub">Protect access to your account</span>
        </div>
        <div className="sec-grid">
          <div className="sec-card">
            <div className="ic"><Icon name="lock" size={20} /></div>
            <div className="head">
              <span className="nm">Password</span>
              <span className="status-pill status-pill--muted">Protected</span>
            </div>
            <div className="ds">Use a strong password you do not reuse elsewhere.</div>
            <button className="btn btn-outline-primary" onClick={() => setShowPassword((value) => !value)}>
              Change password
            </button>
          </div>
          <div className="sec-card">
            <div className="ic"><Icon name="shield" size={20} /></div>
            <div className="head">
              <span className="nm">Two-Factor Authentication</span>
              <span className="status-pill status-pill--warn">
                <Icon name="alertTriangle" size={10} /> Not enabled
              </span>
            </div>
            <div className="ds">Add a code from your phone when you sign in.</div>
            <button className="btn btn-outline-primary" disabled>Set up 2FA</button>
          </div>
        </div>

        {showPassword && (
          <div className="password-panel">
            <label className="field">
              <span>Current password</span>
              <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
            </label>
            <label className="field">
              <span>New password</span>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </label>
            <button className="btn btn-primary" onClick={handleChangePassword} disabled={passwordSaving || !oldPw || !newPw}>
              {passwordSaving ? "Updating..." : "Update password"}
            </button>
            {passwordMsg && (
              <div className={"password-msg" + (passwordMsg.ok ? " ok" : " bad")}>
                {passwordMsg.text}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="signout-card">
        <div className="danger-row" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px", background: "var(--surface)", marginBottom: 0 }}>
          <div>
            <div className="nm">Sign out</div>
            <div className="ds">Sign out of your account on this device.</div>
          </div>
          <button className="btn" style={{ background: "var(--surface)", border: "1.5px solid var(--line)", color: "var(--ink)" }} onClick={logout}>
            <Icon name="settle" size={13} /> Sign out
          </button>
        </div>
      </section>

      <section className="danger-card">
        <div className="danger-card-h">
          <Icon name="alertTriangle" size={18} />
          <h2>Danger zone</h2>
        </div>
        <div className="danger-row">
          <div>
            <div className="nm">Deactivate account</div>
            <div className="ds">
              Disable sign-in for this account. Groups and balances are kept for existing members.
            </div>
          </div>
          <button className="btn btn-danger" onClick={handleDelete}>
            <Icon name="trash" size={13} /> Deactivate
          </button>
        </div>
      </section>

      <style jsx>{`
        :global(.settings-head){margin-bottom:6px}
        :global(.settings-eyebrow){
          display:flex;align-items:center;gap:10px;
          margin:24px 4px 12px;
          color:var(--ink-4);font-size:11px;font-weight:800;
          letter-spacing:1.2px;text-transform:uppercase;
        }
        :global(.settings-eyebrow)::after{content:"";height:1px;background:var(--line);flex:1}
        :global(.settings-card){
          background:#fff;border:1px solid var(--line);border-radius:16px;
          padding:22px;margin-bottom:14px;box-shadow:0 8px 24px rgba(15,23,42,.04);
        }
        :global(.settings-card-h){
          display:flex;align-items:center;justify-content:space-between;gap:16px;
          margin-bottom:18px;
        }
        :global(.settings-card-h h2){margin:0;font-size:17px;font-weight:700;color:var(--ink)}
        :global(.settings-card-h .sub){font-size:12px;color:var(--ink-3)}
        :global(.settings-actions){display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
        :global(.btn-outline-primary){
          background:#fff;color:var(--primary);border:1px solid rgba(91,78,240,.45);
          box-shadow:none;
        }
        :global(.btn-outline-primary:hover){background:var(--primary-soft);border-color:var(--primary)}
        :global(.btn:disabled){opacity:.55;cursor:not-allowed}
        :global(.settings-error){
          display:flex;align-items:center;gap:8px;margin-bottom:14px;
          padding:10px 12px;border-radius:10px;background:#fff1f2;
          color:#be123c;border:1px solid #fecdd3;font-size:13px;font-weight:600;
        }
        :global(.saved-pill){
          display:inline-flex;align-items:center;gap:6px;padding:6px 11px;
          border-radius:999px;background:var(--success-soft);color:#065f46;
          border:1px solid #bbf7d0;font-size:12px;font-weight:700;
          opacity:0;transform:translateY(-4px);transition:.2s;pointer-events:none;
        }
        :global(.saved-pill.show){opacity:1;transform:translateY(0)}
        :global(.settings-profile){display:grid;grid-template-columns:120px 1fr;gap:34px;align-items:start}
        :global(.profile-photo-block){display:flex;flex-direction:column;align-items:center;gap:8px;width:120px}
        :global(.profile-photo){
          position:relative;width:96px;height:96px;border-radius:50%;
          background:linear-gradient(135deg,#f8fafc,#f1f5f9);
          border:1px solid var(--line);display:grid;place-items:center;
          font-size:32px;font-weight:700;color:#27324a;
        }
        :global(.profile-photo-cam){
          position:absolute;right:2px;bottom:2px;width:30px;height:30px;
          border-radius:999px;background:#fff;border:1px solid var(--line);
          display:grid;place-items:center;color:var(--primary);
        }
        :global(.profile-photo-hint){font-size:11px;color:var(--ink-4);text-align:center;line-height:1.4}
        :global(.profile-meta-since){font-size:11.5px;color:var(--ink-3);display:flex;gap:5px;align-items:center;justify-content:center}
        :global(.settings-fields){display:grid;grid-template-columns:1fr 1fr;gap:16px}
        :global(.field){display:flex;flex-direction:column;gap:6px}
        :global(.field span){font-size:12px;font-weight:700;color:var(--ink)}
        :global(.field input),:global(.field select),:global(.pref-tile select){
          min-height:42px;padding:10px 12px;border:1px solid var(--line);
          border-radius:10px;background:#fff;color:var(--ink);font-size:13.5px;outline:none;
        }
        :global(.field input:focus),:global(.field select:focus),:global(.pref-tile select:focus){
          border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft);
        }
        :global(.field input:disabled),:global(.field select:disabled){
          background:#fff;color:var(--ink-2);border-color:var(--line-2);cursor:default;
        }
        :global(.phone-row){display:flex;gap:8px}
        :global(.phone-row select){width:112px}
        :global(.phone-row input){flex:1;min-width:0}
        :global(.pref-grid),:global(.theme-grid){display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        :global(.pref-tile){
          padding:16px;border:1px solid var(--line);border-radius:14px;
          display:flex;flex-direction:column;gap:8px;background:#fff;
        }
        :global(.pref-tile .ic),:global(.sec-card .ic){
          width:40px;height:40px;border-radius:11px;background:var(--primary-soft);
          color:var(--primary);display:grid;place-items:center;
        }
        :global(.pref-tile .lbl){font-size:12px;font-weight:700;color:var(--ink)}
        :global(.theme-card){
          padding:10px;border:1px solid var(--line);border-radius:14px;background:#fff;
          cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:10px;
          transition:.15s;font-family:inherit;color:var(--ink);
        }
        :global(.theme-card:hover){border-color:#cfd3dd}
        :global(.theme-card.active){border-color:var(--primary);box-shadow:0 0 0 3px rgba(91,78,240,.12)}
        :global(.theme-preview){height:120px;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;overflow:hidden}
        :global(.theme-preview .bar){height:8px;width:38px;border-radius:5px;background:currentColor;opacity:.7}
        :global(.theme-preview .block){height:24px;border-radius:6px;background:currentColor;opacity:.15}
        :global(.theme-preview .block.sm){height:14px;width:60%}
        :global(.theme-preview--system){background:linear-gradient(135deg,#f4f4f7 50%,#1f2433 50%);color:#5b4ef0}
        :global(.theme-preview--light){background:#f4f4f7;color:#0b0f1a}
        :global(.theme-preview--dark){background:#1f2433;color:#fff}
        :global(.theme-lbl){display:flex;align-items:center;justify-content:space-between;padding:0 4px;font-size:13px;font-weight:700}
        :global(.theme-lbl .check){width:18px;height:18px;border-radius:999px;border:1.5px solid var(--line)}
        :global(.theme-card.active .theme-lbl .check){border:5px solid var(--primary)}
        :global(.lang-pills){display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
        :global(.lang-pill){
          display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--line);
          border-radius:12px;background:#fff;color:var(--ink);font-family:inherit;cursor:pointer;
        }
        :global(.lang-pill.active){border-color:var(--primary);background:var(--primary-soft);color:var(--primary)}
        :global(.lang-pill .flag){font-size:11px;font-weight:800;letter-spacing:.5px}
        :global(.lang-pill .nm){font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        :global(.sec-grid){display:grid;grid-template-columns:1fr 1fr;gap:14px}
        :global(.sec-card){
          padding:18px;border:1px solid var(--line);border-radius:14px;
          display:flex;flex-direction:column;gap:8px;background:#fff;
        }
        :global(.sec-card .head){display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
        :global(.sec-card .nm){font-size:14px;font-weight:700;color:var(--ink)}
        :global(.sec-card .ds){font-size:12.5px;color:var(--ink-3);line-height:1.5}
        :global(.sec-card .btn){align-self:flex-start;margin-top:8px}
        :global(.status-pill){
          display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:999px;
          font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;
        }
        :global(.status-pill--muted){background:var(--line-2);color:var(--ink-3)}
        :global(.status-pill--warn){background:#fef3c7;color:#92400e}
        :global(.password-panel){
          display:grid;grid-template-columns:repeat(3,1fr) auto;gap:12px;align-items:end;
          margin-top:16px;padding-top:16px;border-top:1px solid var(--line);
        }
        :global(.password-msg){grid-column:1/-1;font-size:12.5px;font-weight:700}
        :global(.password-msg.ok){color:#047857}
        :global(.password-msg.bad){color:#be123c}
        :global(.signout-card){border-radius:16px;margin-bottom:16px}
        :global(.danger-card){
          background:#fff8f8;border:1px solid #fecaca;border-radius:16px;
          padding:22px;margin-bottom:20px;
        }
        :global(.danger-card-h){display:flex;align-items:center;gap:8px;margin-bottom:14px;color:#dc2626}
        :global(.danger-card-h h2){margin:0;font-size:17px;color:#9f1239}
        :global(.danger-row){
          display:flex;align-items:center;justify-content:space-between;gap:18px;
          padding:16px 18px;background:#fff;border:1px solid #fecaca;border-radius:12px;
        }
        :global(.danger-row .nm){font-size:14px;font-weight:700;color:var(--ink)}
        :global(.danger-row .ds){font-size:12.5px;color:var(--ink-3);margin-top:3px;line-height:1.5}
        :global(.btn-danger){background:#dc2626;color:#fff;border-color:transparent}
        :global(.btn-danger:hover){background:#b91c1c}
        :global(:root[data-theme="dark"] .settings-card),
        :global(:root[data-theme="dark"] .pref-tile),
        :global(:root[data-theme="dark"] .theme-card),
        :global(:root[data-theme="dark"] .sec-card),
        :global(:root[data-theme="dark"] .danger-row){
          background:var(--surface);
          border-color:var(--line);
          color:var(--ink);
          box-shadow:var(--shadow-sm);
        }
        :global(:root[data-theme="dark"] .profile-photo){
          background:linear-gradient(135deg,#20283d,#111827);
          border-color:var(--line);
          color:var(--ink);
        }
        :global(:root[data-theme="dark"] .profile-photo-cam){
          background:#20283d;
          border-color:var(--line);
        }
        :global(:root[data-theme="dark"] .field input),
        :global(:root[data-theme="dark"] .field select),
        :global(:root[data-theme="dark"] .pref-tile select){
          background:#111827;
          border-color:var(--line);
          color:var(--ink);
        }
        :global(:root[data-theme="dark"] .field input:disabled),
        :global(:root[data-theme="dark"] .field select:disabled){
          background:#151b2d;
          color:var(--ink-2);
        }
        :global(:root[data-theme="dark"] .theme-preview--light){
          background:#e5e7eb;
          color:#111827;
        }
        :global(:root[data-theme="dark"] .theme-card.active){
          background:rgba(122,111,255,.12);
        }
        :global(:root[data-theme="dark"] .danger-card){
          background:rgba(244,63,94,.08);
          border-color:rgba(251,113,133,.35);
        }
        :global(:root[data-theme="dark"] .danger-card-h h2){
          color:#fda4af;
        }
        @media (max-width:1100px){
          :global(.lang-pills){grid-template-columns:repeat(3,1fr)}
          :global(.password-panel){grid-template-columns:1fr}
        }
        @media (max-width:900px){
          :global(.settings-profile){grid-template-columns:1fr}
          :global(.profile-photo-block){width:auto;align-items:flex-start}
          :global(.settings-fields),:global(.pref-grid),:global(.theme-grid),:global(.sec-grid){grid-template-columns:1fr}
          :global(.lang-pills){grid-template-columns:repeat(2,1fr)}
          :global(.danger-row){align-items:flex-start;flex-direction:column}
        }
      `}</style>
    </>
  );
}
