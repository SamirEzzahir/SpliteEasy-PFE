"use client";
// app/account/page.tsx — Account Settings (sub-nav + profile card + quick settings + actions)

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth/AuthContext";
import { usersApi, type SettlementMode } from "@/lib/api/users";
import { apiErrorMessage } from "@/lib/api/client";

type SectionId =
  | "profile"
  | "security"
  | "preferences"
  | "settlement"
  | "payment"
  | "linked";

const SECTIONS: Array<{ id: SectionId; label: string; icon: string }> = [
  { id: "profile",    label: "Profile Information",    icon: "account"  },
  { id: "security",   label: "Security",               icon: "shield"   },
  { id: "preferences",label: "Preferences",            icon: "settings" },
  { id: "settlement", label: "Settlement Preferences", icon: "settle"   },
  { id: "payment",    label: "Payment Methods",        icon: "wallet"   },
  { id: "linked",     label: "Linked Accounts",        icon: "groups"   },
];

const SETTLEMENT_MODES: Array<{
  id: SettlementMode;
  name: string;
  icon: string;
  desc: string;
}> = [
  { id: "separate",    name: "Separate",    icon: "split-equal", desc: "Group balances stay independent. Cross-group settlements are tracked apart." },
  { id: "auto_adjust", name: "Auto-adjust", icon: "settle",      desc: "Global settlements automatically reduce group balances proportionally." },
  { id: "hybrid",      name: "Hybrid",      icon: "split-pct",   desc: "Show both the raw group balance and the globally-adjusted balance." },
];

function initialsOf(name: string | null | undefined, fallback = "?") {
  const src = (name || fallback).trim();
  if (!src) return fallback;
  return src.split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const { user, refresh, logout } = useAuth();
  const [section, setSection] = useState<SectionId>("profile");

  // Profile form
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [username, setUsername] = useState(user?.username || "");
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // Quick settings
  const [language, setLanguage] = useState("en");
  const [currency, setCurrency] = useState("MAD");
  const [theme, setTheme] = useState("system");
  const [notifications, setNotifications] = useState("enabled");

  // Settlement mode
  const [mode, setMode] = useState<SettlementMode>("separate");

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name || "");
    setEmail(user.email || "");
    setUsername(user.username || "");
  }, [user]);

  const permissions = useMemo(() => {
    const raw = user?.role?.permissions;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }, [user?.role?.permissions]);

  if (!user) return null;

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setProfileError(null);
    setProfileSaving(true);
    try {
      await usersApi.updateProfile(user.id, {
        full_name: fullName,
        email,
        username,
      });
      await refresh();
      setEditing(false);
    } catch (e) {
      setProfileError(apiErrorMessage(e));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError(null);
    setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError("Passwords don't match."); return; }
    if (newPw.length < 8) { setPwError("Use at least 8 characters."); return; }
    setPwSaving(true);
    try {
      await usersApi.changePassword(user.id, { current_password: currentPw, new_password: newPw });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setPwSuccess(true);
    } catch (e) {
      setPwError(apiErrorMessage(e));
    } finally {
      setPwSaving(false);
    }
  };

  const handleSetMode = async (next: SettlementMode) => {
    setMode(next);
    try { await usersApi.setSettlementMode(user.id, next); } catch {/* silent */}
  };

  const handleDeactivate = async () => {
    if (!confirm("Delete your account? This permanently removes your profile data. Your groups stay, but you'll be signed out.")) return;
    try {
      await usersApi.deactivate(user.id);
      logout();
    } catch (e) {
      alert(apiErrorMessage(e));
    }
  };

  const displayName = user.full_name || user.username;
  const memberSinceLabel = "May 12, 2024";  // backend doesn't expose created_at on User yet

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Account Settings</h1>
          <p>Manage your account and preferences</p>
        </div>
      </div>

      <div className="acct2">
        {/* Sub-sidebar */}
        <aside className="acct2-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={"acct2-nav-item" + (section === s.id ? " active" : "")}
              onClick={() => setSection(s.id)}
            >
              <Icon name={s.icon} size={15} />
              <span>{s.label}</span>
            </button>
          ))}
          <div className="acct2-help-card">
            <div className="acct2-help-ic"><Icon name="settings" size={22} /></div>
            <div className="nm">Customize your experience</div>
            <div className="ds">Manage your preferences and account settings easily.</div>
            <button className="btn btn-primary">Learn More</button>
          </div>

          <div className="acct2-nav-sep" />
          <button className="acct2-nav-item">
            <Icon name="info" size={15} /> Help Center
          </button>
          <button className="acct2-nav-item" onClick={logout} style={{ color: "var(--rose)" }}>
            <Icon name="settle" size={15} /> Log out
          </button>
        </aside>

        {/* Main */}
        <div className="acct2-main">
          {section === "profile" && (
            <>
              {/* Profile Information */}
              <div className="profile-card">
                <div className="profile-card-h">
                  <h2>Profile Information</h2>
                  {!editing ? (
                    <button className="btn btn-outline-primary" onClick={() => setEditing(true)}>
                      <Icon name="edit" size={13} /> Edit Profile
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditing(false);
                          setFullName(user.full_name || "");
                          setEmail(user.email || "");
                          setUsername(user.username || "");
                          setProfileError(null);
                        }}
                        disabled={profileSaving}
                      >
                        Cancel
                      </button>
                      <button className="btn btn-primary" onClick={handleSaveProfile} disabled={profileSaving}>
                        {profileSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>

                {profileError && (
                  <div className="notice error" style={{ marginBottom: 16 }}>
                    <Icon name="info" size={14} /> {profileError}
                  </div>
                )}

                <div className="profile-card-body">
                  <div className="profile-photo-block">
                    <div className="profile-photo">
                      {initialsOf(user.full_name || user.username)}
                      <button className="profile-photo-cam" aria-label="Change photo">
                        <Icon name="image" size={14} />
                      </button>
                    </div>
                    <div className="profile-photo-hint">JPG, PNG or GIF. Max 2MB</div>
                  </div>

                  <div className="profile-fields">
                    <div className="field">
                      <label>Full Name</label>
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={!editing}
                      />
                    </div>
                    <div className="field">
                      <label>Username</label>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={!editing}
                      />
                    </div>
                    <div className="field">
                      <label>Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={!editing}
                      />
                    </div>
                    <div className="field">
                      <label>Phone Number</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <select disabled={!editing} style={{ width: 80, padding: "10px 8px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13.5, background: "#fff" }}>
                          <option>🇲🇦</option>
                          <option>🇺🇸</option>
                          <option>🇫🇷</option>
                        </select>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+212 6 12 34 56 78"
                          disabled={!editing}
                          style={{ flex: 1 }}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label>Member Since</label>
                      <div style={{ position: "relative" }}>
                        <input value={memberSinceLabel} disabled style={{ paddingLeft: 34 }} />
                        <Icon name="activity" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Account Type</label>
                      <div className="acct-role-pill" style={{ alignSelf: "flex-start", padding: "8px 14px", fontSize: 12 }}>
                        <Icon name="crown" size={12} /> {user.role?.name || "Member"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Settings */}
              <div className="dash-card">
                <div className="dash-card-h">
                  <h3>Quick Settings</h3>
                </div>
                <div className="qs-grid">
                  <div className="qs-card">
                    <div className="ic"><Icon name="info" size={20} /></div>
                    <div className="lbl">Language</div>
                    <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                      <option value="en">English</option>
                      <option value="fr">Français</option>
                      <option value="ar">العربية</option>
                    </select>
                  </div>
                  <div className="qs-card">
                    <div className="ic"><Icon name="coin" size={20} /></div>
                    <div className="lbl">Currency</div>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      <option value="MAD">MAD (Moroccan Dirham)</option>
                      <option value="USD">USD (US Dollar)</option>
                      <option value="EUR">EUR (Euro)</option>
                    </select>
                  </div>
                  <div className="qs-card">
                    <div className="ic"><Icon name="moon" size={20} /></div>
                    <div className="lbl">Theme</div>
                    <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                      <option value="system">System</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                  <div className="qs-card">
                    <div className="ic"><Icon name="bell" size={20} /></div>
                    <div className="lbl">Notifications</div>
                    <select value={notifications} onChange={(e) => setNotifications(e.target.value)}>
                      <option value="enabled">Enabled</option>
                      <option value="email">Email only</option>
                      <option value="off">Off</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Account Actions */}
              <div className="dash-card">
                <div className="dash-card-h">
                  <h3>Account Actions</h3>
                </div>
                <div className="aa-grid">
                  <div className="aa-card">
                    <div className="ic purple"><Icon name="shield" size={26} /></div>
                    <div className="nm">Change Password</div>
                    <div className="ds">Update your password to keep your account secure.</div>
                    <button className="btn btn-outline-primary" onClick={() => setSection("security")}>
                      Change Password
                    </button>
                  </div>
                  <div className="aa-card">
                    <div className="ic green"><Icon name="shield" size={26} /></div>
                    <div className="nm">Two-Factor Authentication</div>
                    <div className="ds">Add an extra layer of security to your account.</div>
                    <button className="btn btn-outline-primary">Manage 2FA</button>
                  </div>
                  <div className="aa-card">
                    <div className="ic rose"><Icon name="x" size={26} /></div>
                    <div className="nm">Delete Account</div>
                    <div className="ds">Permanently delete your account and all your data.</div>
                    <button className="btn btn-outline-danger" onClick={handleDeactivate}>
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {section === "security" && (
            <div className="profile-card">
              <div className="profile-card-h">
                <h2>Security</h2>
              </div>
              {pwError && <div className="notice error"><Icon name="info" size={14}/> {pwError}</div>}
              {pwSuccess && <div className="notice success"><Icon name="check" size={14}/> Password updated.</div>}

              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 520 }}>
                <div className="field">
                  <label>Current Password</label>
                  <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter your current password" />
                </div>
                <div className="field">
                  <label>New Password</label>
                  <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" />
                </div>
                <div className="field">
                  <label>Confirm New Password</label>
                  <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-type the new password" />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleChangePassword} disabled={pwSaving || !currentPw || !newPw}>
                    {pwSaving ? "Updating…" : "Update Password"}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--line-2)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>Two-Factor Authentication</h3>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Authenticator app</div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>Use an authenticator app to generate one-time codes.</div>
                  </div>
                  <button className="btn btn-outline-primary">Enable</button>
                </div>
              </div>

              {permissions.length > 0 && (
                <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--line-2)" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>Role permissions</h3>
                  <div className="acct-perm-list">
                    {permissions.map((p) => <span key={p} className="acct-perm-pill">{p}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {section === "preferences" && (
            <div className="profile-card">
              <div className="profile-card-h">
                <h2>Preferences</h2>
              </div>
              <div className="qs-grid">
                <div className="qs-card">
                  <div className="ic"><Icon name="info" size={20} /></div>
                  <div className="lbl">Language</div>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="ar">العربية</option>
                  </select>
                </div>
                <div className="qs-card">
                  <div className="ic"><Icon name="coin" size={20} /></div>
                  <div className="lbl">Currency</div>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="MAD">MAD (Moroccan Dirham)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </div>
                <div className="qs-card">
                  <div className="ic"><Icon name="moon" size={20} /></div>
                  <div className="lbl">Theme</div>
                  <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                <div className="qs-card">
                  <div className="ic"><Icon name="bell" size={20} /></div>
                  <div className="lbl">Notifications</div>
                  <select value={notifications} onChange={(e) => setNotifications(e.target.value)}>
                    <option value="enabled">Enabled</option>
                    <option value="email">Email only</option>
                    <option value="off">Off</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "settlement" && (
            <div className="profile-card">
              <div className="profile-card-h">
                <h2>Settlement Preferences</h2>
              </div>
              <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--ink-3)" }}>
                How should cross-group settlements show up inside groups?
              </p>
              <div className="acct-radio-grid">
                {SETTLEMENT_MODES.map((m) => (
                  <label key={m.id} className={"acct-radio" + (mode === m.id ? " active" : "")}>
                    <input
                      type="radio"
                      name="settlement-mode"
                      checked={mode === m.id}
                      onChange={() => handleSetMode(m.id)}
                    />
                    <div className="rh">
                      <span className="nm">
                        <span className="ic"><Icon name={m.icon} size={13} /></span>
                        {m.name}
                      </span>
                      <span className="check" />
                    </div>
                    <div className="ds">{m.desc}</div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {section === "payment" && (
            <div className="profile-card">
              <div className="profile-card-h">
                <h2>Payment Methods</h2>
                <button className="btn btn-primary"><Icon name="plus" size={13}/> Add method</button>
              </div>
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--ink-3)" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto 12px", background: "var(--primary-soft)", display: "grid", placeItems: "center", color: "var(--primary)" }}>
                  <Icon name="wallet" size={24} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>No payment methods yet</div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>Add a card or bank account to settle up faster.</div>
              </div>
            </div>
          )}

          {section === "linked" && (
            <div className="profile-card">
              <div className="profile-card-h">
                <h2>Linked Accounts</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { name: "Google", icon: "mail", connected: true },
                  { name: "Apple",  icon: "phone", connected: false },
                  { name: "Facebook", icon: "groups", connected: false },
                ].map((p) => (
                  <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, border: "1px solid var(--line)", borderRadius: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f4f4f7", display: "grid", placeItems: "center", color: "var(--ink-2)" }}>
                      <Icon name={p.icon} size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        {p.connected ? "Connected — sign in with " + p.name : "Not connected"}
                      </div>
                    </div>
                    <button className={"btn " + (p.connected ? "btn-secondary" : "btn-outline-primary")}>
                      {p.connected ? "Disconnect" : "Connect"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
