import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import './WithdrawDossierButton.css'

interface WithdrawDossierButtonProps {
  suggestionId: string
  opportunityTitle: string
  /** Appelé une fois le retrait enregistré par le serveur. */
  onWithdrawn?: (opportunityTitle: string) => void
}

/**
 * « Me retirer » d'un dossier, avec confirmation. À n'afficher que lorsque
 * `canWithdrawFromDossier(status)` est vrai ; le serveur reste le garde-fou
 * (400 après la mise en relation) et son message est affiché tel quel.
 */
export function WithdrawDossierButton({ suggestionId, opportunityTitle, onWithdrawn }: WithdrawDossierButtonProps) {
  const { declineSuggestion } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    if (busy) return
    setOpen(false)
    setError('')
  }

  const confirm = async () => {
    setBusy(true)
    setError('')
    const result = await declineSuggestion(suggestionId)
    setBusy(false)
    if (!result.ok) {
      setError(result.error ?? 'Retrait impossible.')
      return
    }
    setOpen(false)
    onWithdrawn?.(opportunityTitle)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Me retirer
      </Button>
      {open && (
        <Modal title="Vous retirer de ce dossier ?" onClose={close}>
          <p className="withdraw-text">
            Le dossier « {opportunityTitle} » sera clos : l’entreprise ne pourra plus y donner
            suite et le système ne proposera plus automatiquement votre profil pour cette offre.
          </p>
          {error && (
            <p className="withdraw-error" role="alert">
              {error}
            </p>
          )}
          <div className="withdraw-actions">
            <Button variant="ghost" size="sm" disabled={busy} onClick={close}>
              Annuler
            </Button>
            <Button variant="danger" size="sm" disabled={busy} onClick={confirm}>
              {busy ? 'Retrait…' : 'Oui, me retirer'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
