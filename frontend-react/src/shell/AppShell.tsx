import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToastContext } from '../context/ToastContext'
import { useNotifications } from '../hooks/useNotifications'
import ToastContainer from '../components/ToastContainer'

function initials(username?: string) {
  const u = (username || '').trim()
  if (!u) return '?'
  return u.slice(0, 1).toUpperCase()
}

export default function AppShell() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { toasts, showToast, removeToast } = useToastContext()
  const { notifications, unreadCount, markAllRead } = useNotifications(user?.id ?? null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const topbarMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSidebarOpen(false)
        setNotificationsOpen(false)
        setUserMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!topbarMenuRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false)
        setUserMenuOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <>
      <div className="app-frame">
        <aside className={`app-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
          <div className="app-brand">
            <button className="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-2" onClick={() => navigate('/app')} type="button">
              <span className="app-logo">
                <i className="bi bi-cash-stack"></i>
              </span>
              <span className="app-brand-text">SplitEasy</span>
            </button>
          </div>

          <nav className="app-nav">
            <NavLink className="app-nav-link" to="/app" end onClick={() => setSidebarOpen(false)}>
              <i className="bi bi-speedometer2"></i>
              <span>Dashboard</span>
            </NavLink>
            <NavLink className="app-nav-link" to="/app/groups" onClick={() => setSidebarOpen(false)}>
              <i className="bi bi-people"></i>
              <span>Groups</span>
            </NavLink>
            <NavLink className="app-nav-link" to="/app/expenses" onClick={() => setSidebarOpen(false)}>
              <i className="bi bi-receipt"></i>
              <span>Expenses</span>
            </NavLink>
            <NavLink className="app-nav-link" to="/app/friends" onClick={() => setSidebarOpen(false)}>
              <i className="bi bi-person-plus"></i>
              <span>Friends</span>
            </NavLink>
            <NavLink className="app-nav-link" to="/app/global-settle" onClick={() => setSidebarOpen(false)}>
              <i className="bi bi-globe2"></i>
              <span>Settlements</span>
            </NavLink>
            <NavLink className="app-nav-link" to="/app/finance" onClick={() => setSidebarOpen(false)}>
              <i className="bi bi-wallet2"></i>
              <span>Wallets</span>
            </NavLink>
            <NavLink className="app-nav-link" to="/app/econome" onClick={() => setSidebarOpen(false)}>
              <i className="bi bi-pie-chart"></i>
              <span>Econome (Jars)</span>
            </NavLink>
            <NavLink className="app-nav-link" to="/app/debts-loans" onClick={() => setSidebarOpen(false)}>
              <i className="bi bi-bank"></i>
              <span>Debts & Loans</span>
            </NavLink>
            <NavLink className="app-nav-link" to="/app/dashboard" onClick={() => setSidebarOpen(false)}>
              <i className="bi bi-bar-chart"></i>
              <span>Reports</span>
            </NavLink>
            <NavLink className="app-nav-link" to="/app/insights" onClick={() => setSidebarOpen(false)}>
              <i className="bi bi-pie-chart-fill"></i>
              <span>Insights</span>
            </NavLink>
            <NavLink className="app-nav-link" to="/app/account" onClick={() => setSidebarOpen(false)}>
              <i className="bi bi-person"></i>
              <span>Account</span>
            </NavLink>
          </nav>
        </aside>

        <div className="app-main">
          <header className="app-topbar">
            <div className="d-flex align-items-center gap-2">
              <button className="btn btn-icon d-lg-none" type="button" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle sidebar">
                <i className="bi bi-list"></i>
              </button>

              <div className="app-search">
                <i className="bi bi-search"></i>
                <input placeholder="Search anything..." aria-label="Search" />
              </div>
            </div>

            <div className="d-flex align-items-center gap-2" ref={topbarMenuRef}>
              <div className="dropdown">
                <button
                  className="btn btn-icon position-relative"
                  type="button"
                  aria-label="Notifications"
                  aria-expanded={notificationsOpen}
                  onClick={() => {
                    setNotificationsOpen((current) => !current)
                    setUserMenuOpen(false)
                  }}
                >
                  <i className="bi bi-bell"></i>
                  {unreadCount > 0 && <span className="app-badge">{unreadCount}</span>}
                </button>
                <div className={`dropdown-menu dropdown-menu-end p-0 shadow app-dropdown ${notificationsOpen ? 'show' : ''}`} style={{ width: 360 }}>
                  <div className="d-flex align-items-center justify-content-between p-3 border-bottom">
                    <div className="fw-semibold">Notifications</div>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      type="button"
                      onClick={async () => {
                        await markAllRead()
                        setNotificationsOpen(false)
                        showToast('Marked all as read', 'success')
                      }}
                    >
                      Mark all
                    </button>
                  </div>
                  <div style={{ maxHeight: 360, overflow: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div className="p-3 text-muted">No notifications</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          className="dropdown-item py-3"
                          type="button"
                          onClick={() => {
                            setNotificationsOpen(false)
                            if (n.link) navigate(n.link)
                            else showToast(n.message, 'info')
                          }}
                        >
                          <div className="d-flex align-items-start gap-2">
                            <i className="bi bi-dot text-primary"></i>
                            <div className="flex-grow-1">
                              <div className="small fw-semibold">{n.type}</div>
                              <div className="small text-muted">{n.message}</div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="dropdown">
                <button
                  className="btn btn-user"
                  type="button"
                  aria-label="User menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => {
                    setUserMenuOpen((current) => !current)
                    setNotificationsOpen(false)
                  }}
                >
                  <span className="user-avatar">{initials(user?.username)}</span>
                  <span className="d-none d-md-inline text-start">
                    <span className="d-block fw-semibold">{user?.username || 'Account'}</span>
                    <span className="d-block small text-muted">View profile</span>
                  </span>
                  <i className="bi bi-chevron-down d-none d-md-inline"></i>
                </button>
                <ul className={`dropdown-menu dropdown-menu-end shadow app-dropdown ${userMenuOpen ? 'show' : ''}`}>
                  <li>
                    <NavLink className="dropdown-item" to="/app/account" onClick={() => setUserMenuOpen(false)}>
                      <i className="bi bi-person-gear me-2"></i>Account Settings
                    </NavLink>
                  </li>
                  <li>
                    <NavLink className="dropdown-item" to="/app/finance" onClick={() => setUserMenuOpen(false)}>
                      <i className="bi bi-wallet2 me-2"></i>Income & Wallets
                    </NavLink>
                  </li>
                  <li>
                    <NavLink className="dropdown-item" to="/app/debts-loans" onClick={() => setUserMenuOpen(false)}>
                      <i className="bi bi-bank me-2"></i>Debts & Loans
                    </NavLink>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button
                      className="dropdown-item text-danger"
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false)
                        logout()
                        navigate('/login')
                      }}
                    >
                      <i className="bi bi-box-arrow-right me-2"></i>
                      Logout
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </header>

          <div className="app-content">
            <Outlet />
          </div>
        </div>

        <div className={`app-overlay ${sidebarOpen ? 'is-open' : ''}`} onClick={() => setSidebarOpen(false)} />
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}
