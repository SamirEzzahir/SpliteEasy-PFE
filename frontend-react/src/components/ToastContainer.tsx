import type { Toast } from '../hooks/useToast'

interface Props {
  toasts: Toast[]
  onRemove: (id: number) => void
}

const icons: Record<string, string> = {
  success: 'check-circle',
  danger: 'exclamation-triangle',
  info: 'info-circle',
  warning: 'exclamation-circle',
  primary: 'bell',
}

export default function ToastContainer({ toasts, onRemove }: Props) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-container position-fixed top-0 end-0 p-3" style={{ zIndex: 9999 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast show align-items-center text-bg-${t.type} border-0 mb-2`}
          role="alert"
        >
          <div className="d-flex">
            <div className="toast-body">
              <i className={`bi bi-${icons[t.type] || 'bell'} me-2`}></i>
              {t.message}
            </div>
            <button
              type="button"
              className="btn-close btn-close-white me-2 m-auto"
              onClick={() => onRemove(t.id)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
