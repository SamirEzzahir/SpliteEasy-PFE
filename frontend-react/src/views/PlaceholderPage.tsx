export default function PlaceholderPage({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="h4 mb-1">{title}</h1>
          <div className="text-muted small">
            {hint || 'This page is being ported from the legacy frontend.'}
          </div>
        </div>
        <span className="badge text-bg-primary">WIP</span>
      </div>
    </div>
  )
}

