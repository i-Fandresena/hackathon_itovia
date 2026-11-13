import { useEffect, useState } from 'react'
import { FolderMinus } from 'lucide-react'
import { Button } from '../ui/Button'
import { ApiError, apiOtherDossiers, apiWithdrawOtherDossiers } from '../../lib/api'
import './OtherDossiersChoice.css'

const dossiers = (n: number) => `${n} autre${n > 1 ? 's' : ''} dossier${n > 1 ? 's' : ''}`

/**
 * Candidat en poste via OffRec (décision 2026-11-12) : « Me retirer de mes
 * autres dossiers » ou « Les garder ». Rien ne s'affiche s'il n'est pas en
 * poste ou n'a aucun autre dossier ouvert. Le retrait est définitif ; les
 * entreprises concernées reçoivent un message neutre. `variant="card"` (tableau
 * de bord) : sans « Les garder » — l'encadré reste tant qu'il reste des
 * dossiers, pour pouvoir y revenir plus tard.
 */
export function OtherDossiersChoice({
  variant = 'dialog',
  onWithdrawn,
}: {
  variant?: 'dialog' | 'card'
  /** Après un retrait réussi (recharger « Mes dossiers »). */
  onWithdrawn?: () => Promise<void> | void
}) {
  const [open, setOpen] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<'withdrawn' | 'kept' | null>(null)
  const [withdrawn, setWithdrawn] = useState(0)

  useEffect(() => {
    let active = true
    apiOtherDossiers()
      .then((summary) => {
        if (active) setOpen(summary.placed ? summary.openDossiers : 0)
      })
      .catch(() => {
        if (active) setOpen(0)
      })
    return () => {
      active = false
    }
  }, [])

  const withdraw = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await apiWithdrawOtherDossiers()
      setWithdrawn(response.withdrawn)
      setResult('withdrawn')
      await onWithdrawn?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Retrait impossible. Réessayez.')
    } finally {
      setBusy(false)
    }
  }

  if (result === 'withdrawn') {
    return (
      <p className={`odc odc-${variant} odc-done`} role="status">
        {withdrawn > 0
          ? `C’est fait : vous vous êtes retiré de ${dossiers(withdrawn)}. Les entreprises concernées en sont informées.`
          : 'Aucun autre dossier n’était encore ouvert.'}
      </p>
    )
  }
  if (result === 'kept') {
    return (
      <p className={`odc odc-${variant} odc-done`} role="status">
        Vos autres dossiers restent ouverts. Vous pourrez vous en retirer plus tard depuis votre tableau de bord.
      </p>
    )
  }
  if (!open) return null

  return (
    <section className={`odc odc-${variant}`} aria-labelledby="odc-title">
      <h3 id="odc-title" className="odc-title">
        <FolderMinus size={16} aria-hidden />
        {variant === 'card' ? 'Vous êtes en poste via OffRec' : 'Et vos autres dossiers ?'}
      </h3>
      <p className="odc-text">
        Vous avez encore {dossiers(open)} en cours auprès d’autres entreprises. Souhaitez-vous vous en retirer ? Les
        entretiens prévus seront annulés et les entreprises recevront un simple message indiquant que vous avez retiré
        votre dossier.
      </p>
      {error && (
        <p className="odc-error" role="alert">
          {error}
        </p>
      )}
      <div className="odc-actions">
        {variant === 'dialog' && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setResult('kept')}>
            Les garder
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={busy} aria-busy={busy} onClick={() => void withdraw()}>
          <FolderMinus size={14} aria-hidden />
          {busy ? 'Retrait…' : 'Me retirer de mes autres dossiers'}
        </Button>
      </div>
    </section>
  )
}
