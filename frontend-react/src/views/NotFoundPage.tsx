import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="container py-5" style={{ maxWidth: 760 }}>
      <div className="card p-4">
        <div className="d-flex align-items-center gap-3">
          <div className="display-6 mb-0">404</div>
          <div>
            <div className="h4 mb-1">Page not found</div>
            <div className="text-muted">The page you requested doesn’t exist.</div>
          </div>
        </div>
        <div className="mt-4">
          <Link className="btn btn-primary" to="/app">
            Go to Home
          </Link>
          <Link className="btn btn-outline-secondary ms-2" to="/login">
            Login
          </Link>
        </div>
      </div>
    </div>
  )
}

