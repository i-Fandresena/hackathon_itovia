import { useState } from 'react'
import { PauseCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { useApp } from '../../context/AppContext'
import { ApiError, apiWithdrawMatchingConsent } from '../../lib/api'
import './PauseMatchingConsent.css'

/** Où réactiver l'accord (D6 : jamais automatique). */
const PROFILE_PATH = '/candidat/profil'

/**
 * « Mettre en pause mon accord de matching » en un clic, avec confirmation
 * en place (aucune modale empilée) : `DELETE …/matching-consent`, le même
 * retrait que depuis le profil (D6 : toujours le choix du candidat, jamais
 * automatique). Réactivation depuis le profil.
 */
export function PauseMatchingConsent({ align = 'start' }: { align?: 'start' | 'end' }) {
  const { currentUser, patchCandidateProfile } = useApp()
  const consentAt = currentUser?.candidateProfile?.matchingConsentAt ?? null
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [paused, setPaused] = useState(false)

  if (!currentUser?.candidateProfile) return null

  if (!consentAt) {
    return (
      <p className={`pmc pmc-${align}`} role={paused ? 'status' : undefined}>
        {paused ? 'Accord de matching mis en pause : OffRec ne propose plus votre profil. ' : 'Votre accord de matching est en pause. '}
        <Link to={PROFILE_PATH} className="pmc-link">
          Le réactiver depuis mon profil
        </Link>
      </p>
    )
  }

  const pause = async () => {
    setBusy(true)
    setError('')
    try {
      const { candidateProfile } = await apiWithdrawMatchingConsent()
      patchCandidateProfile({ matchingConsentAt: candidateProfile.matchingConsentAt ?? null })
      setPaused(true)
      setConfirming(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise en pause impossible. Réessayez.')
    } finally {
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <div className={`pmc pmc-${align}`}>
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
          <PauseCircle size={14} aria-hidden />
          Mettre en pause mon accord de matching
        </Button>
      </div>
    )
  }

  return (
    <div className={`pmc pmc-confirm pmc-${align}`} role="group" aria-label="Mettre en pause mon accord de matching">
      <p className="pmc-text">
        OffRec ne proposera plus votre profil à de nouvelles entreprises. Vos dossiers en cours ne changent pas. Vous
        pourrez le réactiver à tout moment depuis votre profil.
      </p>
      {error && (
        <p className="pmc-error" role="alert">
          {error}
        </p>
      )}
      <div className="pmc-actions">
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
          Annuler
        </Button>
        <Button size="sm" disabled={busy} aria-busy={busy} onClick={() => void pause()}>
          <PauseCircle size={14} aria-hidden />
          {busy ? 'Mise en pause…' : 'Confirmer la pause'}
        </Button>
      </div>
    </div>
  )
}
