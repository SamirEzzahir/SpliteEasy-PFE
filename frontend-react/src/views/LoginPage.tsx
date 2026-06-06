import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const params = new URLSearchParams(location.search)
  const registered = params.get('registered') === '1'
  const from = (location.state as { from?: string } | null)?.from || '/app'

  useEffect(() => {
    if (isAuthenticated) navigate('/app', { replace: true })
  }, [isAuthenticated, navigate])

  return (
    <div className="container-fluid py-4 py-lg-5">
      <div className="row g-4 align-items-stretch justify-content-center">
        <div className="col-12 col-lg-5 d-none d-lg-block">
          <div className="h-100 p-5 rounded-4" style={{
            background:
              'radial-gradient(800px 420px at 30% 20%, rgba(124, 77, 255, 0.35), transparent 60%),' +
              'radial-gradient(700px 420px at 70% 80%, rgba(74, 92, 255, 0.35), transparent 55%),' +
              'linear-gradient(180deg, rgba(9, 13, 31, 0.92), rgba(4, 7, 18, 0.92))',
            color: 'rgba(255,255,255,0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)'
          }}>
            <div className="d-flex align-items-center gap-2 mb-4">
              <span className="app-logo">
                <i className="bi bi-cash-stack"></i>
              </span>
              <div className="fw-bold fs-4">SplitEasy</div>
            </div>
            <h1 className="display-6 fw-bold">Manage expenses, split fairly.</h1>
            <p className="mt-3" style={{ color: 'rgba(255,255,255,0.72)', fontSize: '1.05rem' }}>
              Track balances in real time, settle up fast, and keep your finances organized with friends.
            </p>
            <div className="mt-4 d-flex flex-column gap-2">
              <div className="d-flex align-items-center gap-2">
                <span className="user-avatar" style={{ width: 32, height: 32, borderRadius: 12 }}><i className="bi bi-check"></i></span>
                <span>Split expenses easily</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="user-avatar" style={{ width: 32, height: 32, borderRadius: 12 }}><i className="bi bi-check"></i></span>
                <span>Track balances and settlements</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="user-avatar" style={{ width: 32, height: 32, borderRadius: 12 }}><i className="bi bi-check"></i></span>
                <span>Wallets, income, debts and jars</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-5 col-xl-4">
          <div className="text-center mb-3">
            <div className="d-inline-flex align-items-center gap-2">
              <span className="app-logo d-lg-none">
                <i className="bi bi-cash-stack"></i>
              </span>
              <span className="fw-bold fs-4 d-lg-none">SplitEasy</span>
            </div>
          </div>

          <div className="card auth-card p-4 p-lg-5">
            <div className="mb-3">
              <h2 className="h4 mb-1">Welcome back</h2>
              <div className="text-muted">Sign in to continue</div>
            </div>

            {registered && <div className="alert alert-success">Account created. Please log in.</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setSubmitting(true)
                setError(null)
                try {
                  await login(username.trim(), password)
                  navigate(from, { replace: true })
                } catch (err: any) {
                  const message = err?.response?.data?.detail || err?.message || 'Login failed'
                  setError(String(message))
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              <div className="mb-3">
                <label className="form-label">Username</label>
                <input
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Password</label>
                <input
                  className="form-control"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button className="btn btn-primary w-100" disabled={submitting} type="submit">
                {submitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="text-center mt-3">
              <span className="text-muted">No account?</span> <Link to="/signup">Create one</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
