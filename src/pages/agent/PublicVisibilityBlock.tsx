import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ExternalLink, Eye, EyeOff, Globe } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { ApiError, apiAgentSetPublicVisibility } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { PublicTalent, PublicVisibilityState } from '../../types'
import { PublicTalentCard } from '../talents/PublicTalentCard'
import '../talents/PublicTalents.css'
import './PublicVisibilityBlock.css'

interface Props {
  talentId: string
  visibility: PublicVisibilityState
  preview: PublicTalent
  onChanged: (message: string) => void
}

/**
 * Bloc « Visibilité publique » de la fiche talent (agent) : l'accord de
 * fiche publique est DISTINCT de l'accord de création, se recueille
 * explicitement auprès de la personne, et se retire à tout moment.
 */
export function PublicVisibilityBlock({ talentId, visibility, preview, onChanged }: Props) {
  const [confirm, setConfirm] = useState<'grant' | 'revoke' | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const apply = async (granted: boolean) => {
    setBusy(true)
    setError('')
    try {
      await apiAgentSetPublicVisibility(talentId, granted)
      setConfirm(null)
      onChanged(granted ? 'Accord public enregistré : la fiche est publiée.' : 'Fiche publique retirée : l’ancien lien ne fonctionne plus.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.')
    } finally {
      setBusy(false)
    }
  }

  const status = visibility.visible ? (
    <Badge variant="success">En ligne</Badge>
  ) : visibility.granted ? (
    <Badge variant="default">Accord donné · fiche masquée</Badge>
  ) : (
    <Badge variant="muted">Pas de fiche publique</Badge>
  )

  return (
    <Card className="tdet-block tpv">
      <div className="tpv-head">
        <h2 className="tdet-card-title tpv-title">
          <Globe size={18} aria-hidden /> Visibilité publique
        </h2>
        {status}
      </div>
      <p className="tdet-muted tpv-intro">
        La vitrine « Talents recommandés » met en avant ce talent auprès des visiteurs. Il faut l’
        <strong>accord explicite</strong> de la personne, distinct de celui donné pour son profil OffRec. Elle peut
        le retirer à tout moment : retirez alors la fiche.
      </p>

      {visibility.granted && visibility.publicConsentAt && (
        <p className="tpv-date">Accord public recueilli le {formatDate(visibility.publicConsentAt)}.</p>
      )}

      {visibility.blockers.length > 0 && (
        <ul className="tpv-blockers">
          {visibility.blockers.map((b) => (
            <li key={b}>
              <AlertTriangle size={14} aria-hidden /> {b}
            </li>
          ))}
        </ul>
      )}

      <div className="tpv-preview">
        <p className="tpv-preview-label">
          {visibility.visible ? 'Ce que voient les visiteurs' : 'Aperçu de ce qui serait public'}
        </p>
        <PublicTalentCard talent={preview} preview />
        <p className="tdet-muted tpv-never">
          Jamais publiés : nom, téléphone, photo, agent, commentaires, libellés des travaux, auteurs des
          recommandations.
        </p>
      </div>

      {error && !confirm && <p className="tpv-error">{error}</p>}

      <div className="tpv-actions">
        {visibility.granted ? (
          <>
            {visibility.visible && visibility.publicRef && (
              <Link to={`/annuaire/talents/${visibility.publicRef}`} className="tpv-link" target="_blank" rel="noreferrer">
                <ExternalLink size={14} aria-hidden /> Voir la fiche publique
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={() => setConfirm('revoke')}>
              <EyeOff size={15} aria-hidden /> Retirer la fiche publique
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            disabled={visibility.blockers.length > 0}
            onClick={() => {
              setAgreed(false)
              setError('')
              setConfirm('grant')
            }}
          >
            <Eye size={15} aria-hidden /> Enregistrer l’accord et publier
          </Button>
        )}
      </div>

      {confirm === 'grant' && (
        <Modal title="Publier la fiche de ce talent" onClose={() => setConfirm(null)}>
          <p className="tdet-muted tpv-modal-text">
            La fiche apparaîtra dans « Talents recommandés », visible sans compte, avec uniquement les informations de
            l’aperçu.
          </p>
          <label className="tpv-agree">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              J’ai expliqué à la personne ce qui sera public et elle a donné son accord explicite pour apparaître dans
              la vitrine OffRec.
            </span>
          </label>
          {error && <p className="tpv-error">{error}</p>}
          <div className="tpv-actions">
            <Button disabled={!agreed || busy} onClick={() => apply(true)}>
              Publier la fiche
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Annuler
            </Button>
          </div>
        </Modal>
      )}

      {confirm === 'revoke' && (
        <Modal title="Retirer la fiche publique" onClose={() => setConfirm(null)}>
          <p className="tdet-muted tpv-modal-text">
            La fiche disparaît immédiatement de la vitrine et son lien actuel ne fonctionnera plus. Pour la republier,
            il faudra un nouvel accord de la personne (un nouveau lien sera créé). Les demandes de contact déjà reçues
            restent dans votre liste.
          </p>
          {error && <p className="tpv-error">{error}</p>}
          <div className="tpv-actions">
            <Button variant="danger" disabled={busy} onClick={() => apply(false)}>
              Retirer la fiche
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Annuler
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  )
}
