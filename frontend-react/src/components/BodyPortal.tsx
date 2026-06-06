import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

function cleanupBootstrapModalState() {
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove())
  document.body.classList.remove('modal-open')
  document.body.style.removeProperty('overflow')
  document.body.style.removeProperty('padding-right')
}

export default function BodyPortal({ children }: { children: ReactNode }) {
  useEffect(() => {
    cleanupBootstrapModalState()
    return cleanupBootstrapModalState
  }, [])

  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
