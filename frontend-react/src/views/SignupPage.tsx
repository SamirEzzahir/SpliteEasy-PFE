import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'

export default function SignupPage() {
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
  <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
    <div
      className="d-flex w-100"
      style={{
        maxWidth: "1100px",
        borderRadius: "20px",
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
        background: "#fff",
      }}
    >

      {/* LEFT SIDE (FORM) */}
      <div className="p-5 flex-fill">
        <div className="mb-4">
          <h3 className="fw-bold">
            <span style={{ color: "#6C4CF1" }}>Split</span>Easy
          </h3>
        </div>

        <h4 className="fw-bold">Create your account</h4>
        <p className="text-muted mb-4">
          Join SplitEasy and start splitting expenses the smart way.
        </p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setSubmitting(true)
            setError(null)
            try {
              await client.post('/auth/register', {
                username: username.trim(),
                email: email.trim(),
                password,
              })
              navigate('/login?registered=1', { replace: true })
            } catch (err: any) {
              const message = err?.response?.data?.detail || err?.message || 'Registration failed'
              setError(String(message))
            } finally {
              setSubmitting(false)
            }
          }}
        >
          <div className="mb-3">
            <input
              className="form-control rounded-3 p-3"
              placeholder="Full name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <input
              type="email"
              className="form-control rounded-3 p-3"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <input
              type="password"
              className="form-control rounded-3 p-3"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            className="w-100 text-white border-0 mt-3"
            style={{
              padding: "14px",
              borderRadius: "10px",
              background: "linear-gradient(90deg, #6C4CF1, #8B5CF6)",
              fontWeight: "600",
            }}
            disabled={submitting}
          >
            {submitting ? "Creating..." : "Sign up"}
          </button>
        </form>

        {/* Social */}
        <div className="text-center text-muted mt-4">
          or continue with
        </div>

        <div className="mt-3 d-grid gap-2">
          <button className="btn btn-outline-secondary">Google</button>
          <button className="btn btn-outline-secondary">Apple</button>
          <button className="btn btn-outline-secondary">Facebook</button>
        </div>

        <p className="text-center mt-4">
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#6C4CF1" }}>
            Login
          </Link>
        </p>
      </div>

      {/* RIGHT SIDE (ILLUSTRATION) */}
      <div
        className="d-none d-lg-flex flex-column align-items-center justify-content-center text-center p-5"
        style={{
          width: "50%",
          background: "linear-gradient(135deg, #F3F0FF, #EDE9FE)",
        }}
      >
        <h3 className="fw-bold">
          Smart expenses.
          <br />
          Stronger <span style={{ color: "#6C4CF1" }}>connections.</span>
        </h3>

        <p className="text-muted mt-3">
          Split expenses, track payments and settle up with friends.
        </p>

        <img
          src="/wallet.png"
          alt="illustration"
          style={{ width: "250px", marginTop: "30px" }}
        />
      </div>
    </div>
  </div>
)
}
