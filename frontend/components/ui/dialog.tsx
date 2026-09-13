"use client";
import * as React from "react";
import { X } from "lucide-react";
let locks = 0;
let previousOverflow = "";

type FrameProps = { open?: boolean; onClose: () => void; children: React.ReactNode; className?: string;
  busy?: boolean; label?: string; labelledBy?: string; describedBy?: string };
/** Native modal semantics contain focus and make background content inert. */
export function ModalFrame({ open = true, onClose, children, className = "", busy = false, label, labelledBy, describedBy }: FrameProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    if (locks++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    dialog.showModal();
    return () => {
      dialog.close();
      if (--locks === 0) document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);
  if (!open) return null;
  return <dialog ref={ref} className={`ui-dialog ${className}`} aria-label={label} aria-labelledby={labelledBy}
    aria-describedby={describedBy} aria-busy={busy}
    onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}
    onClick={(e) => {
      if (e.target !== e.currentTarget || busy) return;
      const r = e.currentTarget.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
    }}>{children}</dialog>;
}
export function Dialog({ open, onClose, title, description, children, footer, className, busy = false }: {
  open: boolean; onClose: () => void; title: React.ReactNode; description?: React.ReactNode;
  children: React.ReactNode; footer?: React.ReactNode; className?: string; busy?: boolean;
}) {
  const id = React.useId();
  return <ModalFrame open={open} onClose={onClose} busy={busy} className={className} labelledBy={`${id}-title`} describedBy={description ? `${id}-description` : undefined}>
    <div className="modal-h"><div><h2 id={`${id}-title`}>{title}</h2>{description && <p id={`${id}-description`}>{description}</p>}</div>
      <button type="button" className="modal-x" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={20} /></button>
    </div>
    <div className="modal-b">{children}</div>
    {footer && <div className="modal-f">{footer}</div>}
  </ModalFrame>;
}
