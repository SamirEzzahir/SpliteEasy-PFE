import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToastContext } from '../context/ToastContext'
import type { ActivityLog, Group, MyFriend, User } from '../types'

type AccountTab = 'profile' | 'security' | 'preferences' | 'notifications' | 'payments'
type ChangePasswordPayload = { old_password: string; new_password: string }
type DashboardSummary = { total_income: number; total_expense: number; net_balance: number }
type SettlementRow = { amount: number; status: 'pending' | 'accepted' | 'rejected' }

const accountTabs: Array<{ key: AccountTab; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'security', label: 'Security' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'payments', label: 'Payment Methods' },
]

function displayName(user: User | null) {
  if (!user) return 'Samir Ali'
  const first = (user.first_name || '').trim()
  const last = (user.last_name || '').trim()
  if (first || last) return `${first} ${last}`.trim()
  return user.username || user.email || 'SplitEasy User'
}

function avatarFor(user: User | null) {
  if (user?.profile_photo) return user.profile_photo
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName(user))}`
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)
}

function dateLabel(value?: string) {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

export default function AccountPage() {
  const { user: authUser, refreshUser } = useAuth()
  const { showToast } = useToastContext()

  const [activeTab, setActiveTab] = useState<AccountTab>('profile')
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<User | null>(null)
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [friends, setFriends] = useState<MyFriend[]>([])
  const [settlements, setSettlements] = useState<SettlementRow[]>([])

  const [saving, setSaving] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState('')
  const [phone, setPhone] = useState('')
  const [photo, setPhoto] = useState('')
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  async function reload() {
    setLoading(true)
    try {
      const [meRes, activityRes, summaryRes, groupsRes, friendsRes, settlementRes] = await Promise.all([
        client.get<User>('/users/user/me'),
        client.get<ActivityLog[]>('/activity').catch(() => ({ data: [] as ActivityLog[] })),
        client.get<DashboardSummary>('/dashboard/summary').catch(() => ({ data: null as DashboardSummary | null })),
        client.get<Group[]>('/groups').catch(() => ({ data: [] as Group[] })),
        client.get<MyFriend[]>('/friends/my').catch(() => ({ data: [] as MyFriend[] })),
        client.get<SettlementRow[]>('/settle/global/history').catch(() => ({ data: [] as SettlementRow[] })),
      ])

      setMe(meRes.data)
      setActivity((activityRes.data || []).slice(0, 6))
      setSummary(summaryRes.data)
      setGroups(groupsRes.data || [])
      setFriends(friendsRes.data || [])
      setSettlements(settlementRes.data || [])

      setUsername(meRes.data.username || '')
      setEmail(meRes.data.email || '')
      setFirstName(meRes.data.first_name || '')
      setLastName(meRes.data.last_name || '')
      setGender(meRes.data.gender || '')
      setPhone(meRes.data.phone || '')
      setPhoto(meRes.data.profile_photo || '')
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to load account'
      showToast(String(message), 'danger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => cleanupModalBackdrop()
  }, [])

  const fullName = displayName(me || authUser)
  const profileImage = avatarFor(me || authUser)
  const totalSettled = useMemo(
    () => settlements.filter((row) => row.status === 'accepted').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [settlements],
  )
  const totalSaved = Math.max(0, (summary?.total_income || 0) - (summary?.total_expense || 0))

  const modalPortal = typeof document === 'undefined' ? null : createPortal(
    <>
      {editProfileOpen ? (
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setEditProfileOpen(false)
        }}
        style={{ background: 'rgba(7,10,20,0.48)', backdropFilter: 'blur(3px)' }}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg rounded-4">
            <div className="modal-header border-0 pb-0">
              <h5 className="modal-title fw-bold">Edit profile</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={() => setEditProfileOpen(false)}></button>
            </div>
            <div className="modal-body p-4">
              <form onSubmit={saveProfile}>
                <div className="row g-3">
                  <FormField label="Username" value={username} onChange={setUsername} required />
                  <FormField label="Email" value={email} onChange={setEmail} type="email" required />
                  <FormField label="First name" value={firstName} onChange={setFirstName} />
                  <FormField label="Last name" value={lastName} onChange={setLastName} />
                  <FormField label="Gender" value={gender} onChange={setGender} />
                  <FormField label="Phone" value={phone} onChange={setPhone} />
                  <div className="col-12">
                    <label className="form-label fw-semibold">Profile photo URL</label>
                    <input className="form-control" value={photo} onChange={(event) => setPhoto(event.target.value)} />
                  </div>
                </div>
                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button className="btn btn-outline-secondary" type="button" onClick={() => setEditProfileOpen(false)} disabled={saving}>Cancel</button>
                  <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {passwordOpen ? (
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !pwSaving) setPasswordOpen(false)
        }}
        style={{ background: 'rgba(7,10,20,0.48)', backdropFilter: 'blur(3px)' }}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg rounded-4">
            <div className="modal-header border-0 pb-0">
              <h5 className="modal-title fw-bold">Change password</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={() => setPasswordOpen(false)}></button>
            </div>
            <div className="modal-body p-4">
              <form onSubmit={changePassword}>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Current password</label>
                    <input className="form-control" type="password" value={oldPw} onChange={(event) => setOldPw(event.target.value)} required />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold">New password</label>
                    <input className="form-control" type="password" value={newPw} onChange={(event) => setNewPw(event.target.value)} required />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold">Confirm new password</label>
                    <input className="form-control" type="password" value={newPw2} onChange={(event) => setNewPw2(event.target.value)} required />
                  </div>
                </div>
                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button className="btn btn-outline-secondary" type="button" onClick={() => setPasswordOpen(false)} disabled={pwSaving}>Cancel</button>
                  <button className="btn btn-primary" type="submit" disabled={pwSaving}>{pwSaving ? 'Saving...' : 'Change password'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      ) : null}
    </>,
    document.body,
  )

  return (
    <div className="account-page">
      <div className="account-layout">
        <main className="account-main">
          <div className="page-heading">
            <div>
              <h1>My Account</h1>
              <p>Manage your personal information, security and preferences.</p>
            </div>
          </div>

          <div className="account-tabs">
            {accountTabs.map((tab) => (
              <button
                key={tab.key}
                className={`account-tab ${activeTab === tab.key ? 'active' : ''}`}
                type="button"
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'profile' ? (
            <>
              <section className="card account-profile-card">
                <div className="section-title-row">
                  <h2>Profile Information</h2>
                  <button className="btn btn-primary" type="button" disabled={loading} onClick={() => setEditProfileOpen(true)}>
                    <i className="bi bi-pencil me-2"></i>
                    Edit Profile
                  </button>
                </div>

                <div className="account-profile-grid">
                  <div className="account-photo-wrap">
                    <img src={profileImage} alt="Profile" />
                    <button className="account-camera" type="button" onClick={() => setEditProfileOpen(true)}>
                      <i className="bi bi-camera-fill"></i>
                    </button>
                  </div>
                  <div className="account-form-preview">
                    <PreviewField label="Full Name" value={fullName} />
                    <PreviewField label="Username" value={me?.username || username || 'samirali'} />
                    <PreviewField label="Email" value={me?.email || email || 'samir.ali@example.com'} />
                    <PreviewField label="Phone Number" value={me?.phone || phone || '+213 550 12 34 56'} />
                    <PreviewField label="Date of Birth" value="May 15, 2001" />
                    <PreviewField label="Location" value="Algiers, Algeria" />
                  </div>
                </div>
              </section>

              <div className="account-card-grid">
                <SecurityCard onPasswordClick={() => setPasswordOpen(true)} />
                <PreferencesCard />
              </div>

              <section className="card account-danger-card">
                <div className="account-danger-copy">
                  <span><i className="bi bi-exclamation-triangle"></i></span>
                  <div>
                    <h2>Account Danger Zone</h2>
                    <p>Once you delete your account, there is no going back. Please be certain.</p>
                  </div>
                </div>
                <button className="btn btn-outline-danger" type="button" onClick={() => showToast('Delete account flow is not enabled yet.', 'warning')}>
                  Delete Account
                </button>
              </section>
            </>
          ) : (
            <section className="card account-panel-card">
              {activeTab === 'security' ? <SecurityCard onPasswordClick={() => setPasswordOpen(true)} expanded /> : null}
              {activeTab === 'preferences' ? <PreferencesCard expanded /> : null}
              {activeTab === 'notifications' ? <NotificationsPanel /> : null}
              {activeTab === 'payments' ? <PaymentPanel /> : null}
            </section>
          )}
        </main>

        <aside className="account-side">
          <section className="card account-summary-card">
            <h2>Account Summary</h2>
            <div className="premium-banner">
              <i className="bi bi-crown-fill"></i>
              <strong>Premium Member</strong>
              <span>Member since {me?.created_at ? dateLabel(me.created_at) : 'Jan 2024'}</span>
            </div>
            <SummaryRow icon="bi-receipt" label="Total Expenses" value={money(summary?.total_expense || 0)} tone="purple" />
            <SummaryRow icon="bi-check2-square" label="Total Settled" value={money(totalSettled)} tone="green" />
            <SummaryRow icon="bi-piggy-bank" label="Total Saved" value={money(totalSaved)} tone="blue" />
            <SummaryRow icon="bi-people-fill" label="Active Groups" value={String(groups.length)} tone="blue" />
            <SummaryRow icon="bi-person-heart" label="Friends" value={String(friends.length)} tone="purple" />
            <button className="btn btn-outline-primary w-100 mt-3" type="button">View My Activity</button>
          </section>

          <section className="card connected-card">
            <h2>Connected Accounts</h2>
            <p>Manage your linked accounts and services.</p>
            <ConnectedRow icon="bi-google" label="Google" detail={me?.email || 'samir.ali@example.com'} />
            <ConnectedRow icon="bi-apple" label="Apple" detail={me?.email || 'samir.ali@example.com'} />
            <ConnectedRow icon="bi-bank2" label="Bank Account" detail="•••• 3456" />
            <button className="btn btn-outline-primary w-100 mt-2" type="button">Manage Connections</button>
          </section>

          <section className="card account-activity-card">
            <div className="section-title-row">
              <h2>Recent Activity</h2>
              <button className="link-button" type="button">View all</button>
            </div>
            <div className="account-activity-list">
              {activity.length ? (
                activity.slice(0, 4).map((item, index) => (
                  <div className="account-activity-row" key={item.id}>
                    <span className={`account-mini-icon tone-${index % 4}`}>
                      <i className={`bi ${activityIcon(item.action)}`}></i>
                    </span>
                    <div>
                      <strong>{item.action.replace(/_/g, ' ')}</strong>
                      <span>{dateLabel(item.created_at)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="account-empty">No recent activity yet.</div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {modalPortal}
    </div>
  )

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!me) return
    setSaving(true)
    try {
      await client.put(`/users/${me.id}`, {
        username: username.trim(),
        email: email.trim(),
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        gender: gender.trim() || null,
        phone: phone.trim() || null,
        profile_photo: photo.trim() || null,
      })
      showToast('Profile updated', 'success')
      setEditProfileOpen(false)
      window.setTimeout(cleanupModalBackdrop, 250)
      await reload()
      await refreshUser()
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to update profile'
      showToast(String(message), 'danger')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPw.length < 6) {
      showToast('New password must be at least 6 characters', 'danger')
      return
    }
    if (newPw !== newPw2) {
      showToast('Passwords do not match', 'danger')
      return
    }
    setPwSaving(true)
    try {
      const payload: ChangePasswordPayload = { old_password: oldPw, new_password: newPw }
      await client.post('/users/user/me/change-password', payload)
      showToast('Password changed', 'success')
      setOldPw('')
      setNewPw('')
      setNewPw2('')
      setPasswordOpen(false)
      window.setTimeout(cleanupModalBackdrop, 250)
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to change password'
      showToast(String(message), 'danger')
    } finally {
      setPwSaving(false)
    }
  }
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <label className="account-preview-field">
      <span>{label}</span>
      <input value={value} readOnly />
    </label>
  )
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <div className="col-12 col-md-6">
      <label className="form-label fw-semibold">{label}</label>
      <input className="form-control" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </div>
  )
}

function SecurityCard({ onPasswordClick, expanded = false }: { onPasswordClick: () => void; expanded?: boolean }) {
  const rows = [
    { icon: 'bi-lock-fill', title: 'Password', detail: 'Last changed 2 months ago', action: 'Change', tone: 'purple', onClick: onPasswordClick },
    { icon: 'bi-shield-check', title: 'Two-Factor Authentication', detail: 'Enabled', action: 'Manage', tone: 'green' },
    { icon: 'bi-display', title: 'Login Sessions', detail: '3 active sessions', action: 'View', tone: 'purple' },
    { icon: 'bi-patch-check-fill', title: 'Account Status', detail: 'Active', action: 'Active', tone: 'green' },
  ]
  return (
    <section className={expanded ? '' : 'card account-sub-card'}>
      <h2>Security</h2>
      <div className="account-setting-list">
        {rows.map((row) => (
          <div className="account-setting-row" key={row.title}>
            <span className={`account-mini-icon ${row.tone}`}><i className={`bi ${row.icon}`}></i></span>
            <div>
              <strong>{row.title}</strong>
              <small className={row.detail === 'Enabled' || row.detail === 'Active' ? 'success-text' : ''}>{row.detail}</small>
            </div>
            <button className="btn btn-soft btn-sm" type="button" onClick={row.onClick}>{row.action}</button>
          </div>
        ))}
      </div>
    </section>
  )
}

function PreferencesCard({ expanded = false }: { expanded?: boolean }) {
  const prefs = [
    { icon: 'bi-currency-dollar', label: 'Currency', value: 'USD - US Dollar', tone: 'purple' },
    { icon: 'bi-globe2', label: 'Language', value: 'English', tone: 'purple' },
    { icon: 'bi-calendar3', label: 'Date Format', value: 'May 29, 2025', tone: 'green' },
    { icon: 'bi-clock', label: 'Time Zone', value: '(GMT+1) Algiers', tone: 'orange' },
    { icon: 'bi-palette-fill', label: 'Theme', value: 'Light', tone: 'orange' },
  ]
  return (
    <section className={expanded ? '' : 'card account-sub-card'}>
      <h2>Preferences</h2>
      <div className="account-pref-list">
        {prefs.map((pref) => (
          <div className="account-pref-row" key={pref.label}>
            <span className={`account-mini-icon ${pref.tone}`}><i className={`bi ${pref.icon}`}></i></span>
            <strong>{pref.label}</strong>
            {pref.label === 'Theme' ? (
              <div className="account-theme-toggle">
                <button className="active" type="button">Light</button>
                <button type="button">Dark</button>
                <button type="button">System</button>
              </div>
            ) : (
              <select className="form-select" value={pref.value} onChange={() => undefined}>
                <option>{pref.value}</option>
              </select>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function NotificationsPanel() {
  return (
    <>
      <h2>Notifications</h2>
      {['Expense updates', 'Settlement reminders', 'Friend requests', 'Monthly summaries'].map((item, index) => (
        <div className="account-toggle-row" key={item}>
          <div>
            <strong>{item}</strong>
            <span>Keep me updated about {item.toLowerCase()}.</span>
          </div>
          <input className="form-check-input" type="checkbox" defaultChecked={index < 3} />
        </div>
      ))}
    </>
  )
}

function PaymentPanel() {
  return (
    <>
      <h2>Payment Methods</h2>
      {['Visa ending 3456', 'Apple Pay', 'Bank Account'].map((item) => (
        <div className="account-toggle-row" key={item}>
          <div>
            <strong>{item}</strong>
            <span>Connected and ready for settlements.</span>
          </div>
          <span className="connected-pill">Connected</span>
        </div>
      ))}
    </>
  )
}

function SummaryRow({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: string }) {
  return (
    <div className="account-summary-row">
      <span className={`account-mini-icon ${tone}`}><i className={`bi ${icon}`}></i></span>
      <strong>{label}</strong>
      <b>{value}</b>
    </div>
  )
}

function ConnectedRow({ icon, label, detail }: { icon: string; label: string; detail: string }) {
  return (
    <div className="connected-row">
      <span><i className={`bi ${icon}`}></i></span>
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <b>Connected</b>
    </div>
  )
}

function activityIcon(action: string) {
  if (action.includes('expense')) return 'bi-receipt'
  if (action.includes('settle') || action.includes('paid')) return 'bi-check2-circle'
  if (action.includes('group')) return 'bi-people'
  return 'bi-clock-history'
}

function cleanupModalBackdrop() {
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove())
  document.body.classList.remove('modal-open')
  document.body.style.removeProperty('overflow')
  document.body.style.removeProperty('padding-right')
}
