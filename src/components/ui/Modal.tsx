import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import './Modal.css'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Boîte de dialogue générique — même habillage que EmailVerificationModal,
 *  extrait ici pour être réutilisé (fiches détaillées, aperçus...). */
export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
          <X size={18} />
        </button>
        <h2 className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  )
}
