import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, FileCheck2, FileText, ShieldCheck, UserCog, XCircle } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Textarea } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { CvFlagCount, CvFlagList, CvStatusBadge } from '../../components/cv/CvStatus'
import { useApp } from '../../context/AppContext'
import { EDUCATION_LABELS, EXPERIENCE_LABELS } from '../../data/constants'
import {
  ApiError,
  apiAdminCvVerifierRoles,
  apiAdminSetCvVerifierRoles,
  apiCvVerificationCandidate,
  apiCvVerificationDecide,
  apiCvVerificationQueue,
  apiFileUrl,
  type CvQueueEntry,
  type CvVerificationCandidate,
  type CvVerifierRoles,
} from '../../lib/api'
import { formatDate, formatMonth } from '../../lib/format'
import { ROLE_LABELS } from '../../lib/roles'
import type { CvVerificationStatus, UserRole } from '../../types'
import './CvVerification.css'

type Decision = 'verifie' | 'rejete'

const TABS: { status: CvVerificationStatus; label: string }[] = [
  { status: 'non_verifie', label: 'À vérifier' },
  { status: 'verifie', label: 'Vérifiés' },
  { status: 'rejete', label: 'Rejetés' },
]

const EMPTY_MESSAGES: Record<CvVerificationStatus, { title: string; description: string }> = {
  non_verifie: {
    title: 'Aucun CV en attente',
    description: 'Tous les CV déposés ont été relus. Les nouveaux dépôts apparaîtront ici.',
  },
  verifie: {
    title: 'Aucun CV vérifié',
    description: 'Les CV marqués comme vérifiés apparaîtront ici.',
  },
  rejete: {
    title: 'Aucun CV rejeté',
    description: 'Les CV rejetés apparaîtront ici, avec la note laissée au candidat.',
  },
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback
}

/** Les dates extraites d'un CV sont du texte libre : on ne les formate que
 *  si elles sont réellement interprétables. */
function cvDate(value: string | null | undefined): string | null {
  if (!value) return null
  return Number.isNaN(new Date(value).getTime()) ? value : formatMonth(value)
}

function cvPeriod(start: string | null, end: string | null, isCurrent: boolean): string | null {
  const from = cvDate(start)
  const to = isCurrent ? 'aujourd’hui' : cvDate(end)
  if (from && to) return `${from} – ${to}`
  return from ?? to
}

/**
 * Vérification humaine des CV. Accessible à l'admin et aux rôles qu'il
 * autorise (`currentUser.canVerifyCv`, revalidé par le serveur à chaque
 * appel). Les drapeaux automatiques sont des indices : la décision reste
 * humaine, et chaque décision s'ajoute à l'historique sans l'écraser.
 */
export function CvVerification() {
  const { currentUser } = useApp()
  const isAdmin = currentUser?.role === 'admin'

  const [status, setStatus] = useState<CvVerificationStatus>('non_verifie')
  const [queue, setQueue] = useState<CvQueueEntry[] | null>(null)
  const [queueError, setQueueError] = useState('')
  /** Ignore la réponse d'un onglet quitté entre-temps. */
  const queueRequest = useRef(0)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CvVerificationCandidate | null>(null)
  const [detailError, setDetailError] = useState('')
  const detailRequest = useRef(0)

  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null)
  const [note, setNote] = useState('')
  const [deciding, setDeciding] = useState(false)
  const [decisionError, setDecisionError] = useState('')
  const [feedback, setFeedback] = useState('')

  const loadQueue = (forStatus: CvVerificationStatus = status) => {
    const requestId = ++queueRequest.current
    setQueue(null)
    setQueueError('')
    apiCvVerificationQueue(forStatus)
      .then((candidates) => {
        if (requestId === queueRequest.current) setQueue(candidates)
      })
      .catch((err) => {
        if (requestId === queueRequest.current) {
          setQueueError(messageOf(err, 'Impossible de charger la file des CV.'))
        }
      })
  }

  useEffect(() => {
    loadQueue(status)
  }, [status])

  const loadDetail = (candidateId: string) => {
    const requestId = ++detailRequest.current
    setDetail(null)
    setDetailError('')
    apiCvVerificationCandidate(candidateId)
      .then((candidate) => {
        if (requestId === detailRequest.current) setDetail(candidate)
      })
      .catch((err) => {
        if (requestId === detailRequest.current) {
          setDetailError(messageOf(err, 'Impossible de charger cette fiche.'))
        }
      })
  }

  const resetDecision = () => {
    setPendingDecision(null)
    setNote('')
    setDecisionError('')
  }

  const openCandidate = (candidateId: string) => {
    setSelectedId(candidateId)
    setFeedback('')
    resetDecision()
    loadDetail(candidateId)
  }

  const closeCandidate = () => {
    detailRequest.current++
    setSelectedId(null)
    setDetail(null)
    setDetailError('')
    setFeedback('')
    resetDecision()
  }

  const noteMissing = pendingDecision === 'rejete' && note.trim().length === 0

  const confirmDecision = async () => {
    if (!selectedId || !pendingDecision || noteMissing) return
    setDeciding(true)
    setDecisionError('')
    try {
      await apiCvVerificationDecide(selectedId, pendingDecision, note.trim(), detail?.cvUrl)
      setFeedback(
        pendingDecision === 'verifie'
          ? 'CV marqué comme vérifié.'
          : 'CV rejeté. Le candidat verra votre note sur son profil.',
      )
      resetDecision()
      // La fiche est rechargée pour afficher le nouveau statut et la ligne
      // d'historique telle que le serveur l'a enregistrée.
      loadDetail(selectedId)
      loadQueue()
    } catch (err) {
      setDecisionError(messageOf(err, 'La décision n’a pas pu être enregistrée.'))
    } finally {
      setDeciding(false)
    }
  }

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <p className="eyebrow">Contrôle qualité OffRec</p>
          <h1>Vérification des CV</h1>
          <p>
            Chaque CV déposé est relu par une personne avant toute mise en relation. Les points
            relevés automatiquement sont des indices à contrôler, pas des conclusions.
          </p>
        </header>

        {selectedId ? (
          <div className="cvv-detail">
            <div>
              <Button variant="ghost" size="sm" onClick={closeCandidate}>
                <ArrowLeft size={14} />
                Retour à la file
              </Button>
            </div>

            {detailError ? (
              <Card>
                <p style={{ marginBottom: '0.75rem' }}>{detailError}</p>
                <Button size="sm" onClick={() => loadDetail(selectedId)}>
                  Réessayer
                </Button>
              </Card>
            ) : !detail ? (
              <Loading />
            ) : (
              <>
                {feedback && <p className="save-ok">{feedback}</p>}

                <Card>
                  <div className="cvv-detail-head">
                    <div>
                      <h2 className="cvv-name">{detail.fullName}</h2>
                      <p className="cvv-muted">
                        {detail.email}
                        {detail.phone ? ` · ${detail.phone}` : ''}
                      </p>
                      <p className="cvv-muted">
                        {[detail.city, detail.province].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <CvStatusBadge status={detail.verificationStatus} />
                  </div>
                  {detail.verificationStatus === 'verifie' && detail.verifiedAt && (
                    <p className="cvv-muted">Vérifié le {formatDate(detail.verifiedAt)}.</p>
                  )}
                  {detail.verificationNote && (
                    <p className="cvv-note">Note : {detail.verificationNote}</p>
                  )}
                  {detail.cvUrl ? (
                    <a
                      className="cvv-pdf-link"
                      href={apiFileUrl(detail.cvUrl)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText size={15} />
                      Ouvrir le CV (PDF)
                    </a>
                  ) : (
                    <p className="cvv-muted">Aucun fichier CV disponible pour ce candidat.</p>
                  )}
                </Card>

                <Card>
                  <h3 className="cvv-section-title">Points à vérifier</h3>
                  {detail.flags && detail.flags.length > 0 ? (
                    <CvFlagList flags={detail.flags} />
                  ) : (
                    <p className="cvv-muted">
                      Aucun point relevé automatiquement. Cela ne dispense pas de relire le CV.
                    </p>
                  )}
                </Card>

                <Card>
                  <h3 className="cvv-section-title">Profil déclaré et contenu du CV</h3>
                  <div className="cvv-compare">
                    <div className="cvv-compare-row cvv-compare-heads" aria-hidden>
                      <span>Déclaré dans le profil</span>
                      <span>Extrait du CV</span>
                    </div>

                    <div className="cvv-compare-row">
                      <div className="cvv-cell">
                        <p className="cvv-cell-label">Niveau d’études (profil)</p>
                        <p>{EDUCATION_LABELS[detail.educationLevel] ?? detail.educationLevel}</p>
                      </div>
                      <div className="cvv-cell">
                        <p className="cvv-cell-label">Formation (CV)</p>
                        {detail.cvEducation && detail.cvEducation.length > 0 ? (
                          <ul className="cvv-items">
                            {detail.cvEducation.map((edu, i) => (
                              <li key={i}>
                                <strong>{edu.degree}</strong>
                                <span>
                                  {[edu.school, edu.field, cvDate(edu.graduationDate)]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="cvv-muted">Aucune formation extraite.</p>
                        )}
                      </div>
                    </div>

                    <div className="cvv-compare-row">
                      <div className="cvv-cell">
                        <p className="cvv-cell-label">Niveau d’expérience (profil)</p>
                        <p>{EXPERIENCE_LABELS[detail.experienceLevel] ?? detail.experienceLevel}</p>
                      </div>
                      <div className="cvv-cell">
                        <p className="cvv-cell-label">Expérience (CV)</p>
                        {detail.cvProfessionalTitle && <p>{detail.cvProfessionalTitle}</p>}
                        {detail.cvYearsOfExperience !== null && detail.cvYearsOfExperience !== undefined && (
                          <p>
                            {detail.cvYearsOfExperience} an{detail.cvYearsOfExperience > 1 ? 's' : ''}{' '}
                            d’expérience
                          </p>
                        )}
                        {detail.cvExperiences && detail.cvExperiences.length > 0 ? (
                          <ul className="cvv-items">
                            {detail.cvExperiences.map((exp, i) => (
                              <li key={i}>
                                <strong>{exp.jobTitle}</strong>
                                <span>
                                  {[exp.company, cvPeriod(exp.startDate, exp.endDate, exp.isCurrent)]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="cvv-muted">Aucune expérience extraite.</p>
                        )}
                      </div>
                    </div>

                    <div className="cvv-compare-row">
                      <div className="cvv-cell">
                        <p className="cvv-cell-label">Compétences (profil)</p>
                        {detail.skills.length > 0 ? (
                          <div className="cvv-badges">
                            {detail.skills.map((skill) => (
                              <Badge key={skill} variant="primary">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="cvv-muted">Aucune compétence déclarée.</p>
                        )}
                      </div>
                      <div className="cvv-cell">
                        <p className="cvv-cell-label">Certifications (CV)</p>
                        {detail.cvCertifications && detail.cvCertifications.length > 0 ? (
                          <ul className="cvv-items">
                            {detail.cvCertifications.map((cert, i) => (
                              <li key={i}>
                                <strong>{cert.name}</strong>
                                <span>
                                  {[cert.issuer, cvDate(cert.issueDate)].filter(Boolean).join(' · ')}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="cvv-muted">Aucune certification extraite.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 className="cvv-section-title">Décision</h3>
                  {!detail.cvUrl ? (
                    <p className="cvv-muted">Pas de CV à vérifier pour ce candidat.</p>
                  ) : pendingDecision ? (
                    <div className={`cvv-confirm cvv-confirm-${pendingDecision}`}>
                      <p className="cvv-confirm-title">
                        {pendingDecision === 'verifie'
                          ? `Confirmer : marquer le CV de ${detail.fullName} comme vérifié ?`
                          : `Confirmer : rejeter le CV de ${detail.fullName} ?`}
                      </p>
                      <label className="cvv-note-field">
                        <span>
                          {pendingDecision === 'rejete'
                            ? 'Motif du rejet (obligatoire, visible par le candidat)'
                            : 'Note (facultative)'}
                        </span>
                        <Textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          maxLength={1000}
                          placeholder={
                            pendingDecision === 'rejete'
                              ? 'Ex. : le diplôme indiqué n’a pas pu être confirmé auprès de l’établissement.'
                              : 'Ex. : diplôme confirmé par téléphone auprès de l’établissement.'
                          }
                          disabled={deciding}
                        />
                      </label>
                      {noteMissing && (
                        <p className="cvv-muted">Indiquez le motif pour pouvoir rejeter ce CV.</p>
                      )}
                      {decisionError && <p className="cvv-error">{decisionError}</p>}
                      <div className="cvv-actions">
                        <Button
                          size="sm"
                          variant={pendingDecision === 'rejete' ? 'danger' : 'primary'}
                          disabled={deciding || noteMissing}
                          onClick={confirmDecision}
                        >
                          {deciding
                            ? 'Enregistrement…'
                            : pendingDecision === 'verifie'
                              ? 'Confirmer la vérification'
                              : 'Confirmer le rejet'}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={deciding} onClick={resetDecision}>
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="cvv-actions">
                      {detail.verificationStatus !== 'verifie' && (
                        <Button size="sm" onClick={() => setPendingDecision('verifie')}>
                          <ShieldCheck size={14} />
                          Marquer comme vérifié
                        </Button>
                      )}
                      {detail.verificationStatus !== 'rejete' && (
                        <Button size="sm" variant="danger" onClick={() => setPendingDecision('rejete')}>
                          <XCircle size={14} />
                          Rejeter
                        </Button>
                      )}
                    </div>
                  )}
                </Card>

                <Card>
                  <h3 className="cvv-section-title">Historique des décisions</h3>
                  {detail.history.length === 0 ? (
                    <p className="cvv-muted">Aucune décision enregistrée pour ce candidat.</p>
                  ) : (
                    <ul className="cvv-history">
                      {detail.history.map((entry, i) => (
                        <li key={i}>
                          <div className="cvv-history-head">
                            <CvStatusBadge status={entry.decision} />
                            <span className="cvv-muted">
                              {entry.verifierName} · <time>{formatDate(entry.createdAt)}</time>
                            </span>
                          </div>
                          {entry.note && <p className="cvv-note">{entry.note}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="cvv-tabs" role="group" aria-label="Filtrer par statut">
              {TABS.map((tab) => (
                <button
                  key={tab.status}
                  type="button"
                  className={`chip ${status === tab.status ? 'active' : ''}`}
                  aria-pressed={status === tab.status}
                  onClick={() => setStatus(tab.status)}
                >
                  {tab.label}
                  {status === tab.status && queue ? ` (${queue.length})` : ''}
                </button>
              ))}
            </div>

            {queueError ? (
              <div>
                <p style={{ marginBottom: '1rem' }}>{queueError}</p>
                <Button size="sm" onClick={() => loadQueue()}>
                  Réessayer
                </Button>
              </div>
            ) : !queue ? (
              <Loading />
            ) : queue.length === 0 ? (
              <EmptyState icon={FileCheck2} {...EMPTY_MESSAGES[status]} />
            ) : (
              <div className="cvv-queue">
                {queue.map((entry) => (
                  <Card
                    key={entry.candidateId}
                    className="cvv-queue-item"
                    hover
                    onClick={() => openCandidate(entry.candidateId)}
                  >
                    <span className="cvv-queue-main">
                      <strong>{entry.fullName}</strong>
                      <span className="cvv-muted">{entry.email}</span>
                      <span className="cvv-muted">
                        {entry.submittedAt ? `CV déposé le ${formatDate(entry.submittedAt)}` : 'Date de dépôt inconnue'}
                      </span>
                    </span>
                    <span className="cvv-queue-side">
                      <CvStatusBadge status={entry.verificationStatus} />
                      <CvFlagCount count={entry.flags?.length ?? 0} />
                      <ChevronRight size={16} aria-hidden />
                    </span>
                  </Card>
                ))}
              </div>
            )}

            {isAdmin && <VerifierRolesSettings />}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Réglage admin : quels rôles, en plus de l'admin, peuvent vérifier les CV.
 * N'est monté que pour l'admin ; le serveur refuse de toute façon ces deux
 * endpoints aux autres rôles.
 */
function VerifierRolesSettings() {
  const [settings, setSettings] = useState<CvVerifierRoles | null>(null)
  const [draft, setDraft] = useState<UserRole[]>([])
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const apply = (next: CvVerifierRoles) => {
    setSettings(next)
    setDraft(next.roles.filter((r) => r !== 'admin'))
  }

  const load = () => {
    setLoadError('')
    apiAdminCvVerifierRoles()
      .then(apply)
      .catch((err) => setLoadError(messageOf(err, 'Impossible de charger ce réglage.')))
  }

  useEffect(load, [])

  const toggle = (role: UserRole, checked: boolean) => {
    setSaved(false)
    setDraft((d) => (checked ? [...d.filter((r) => r !== role), role] : d.filter((r) => r !== role)))
  }

  const save = async () => {
    setSaving(true)
    setSaveError('')
    setSaved(false)
    try {
      apply(await apiAdminSetCvVerifierRoles(draft))
      setSaved(true)
    } catch (err) {
      setSaveError(messageOf(err, 'Enregistrement impossible.'))
    } finally {
      setSaving(false)
    }
  }

  // L'admin a toujours accès : ce n'est jamais une case à cocher.
  const grantable = (settings?.grantable ?? []).filter((r) => r !== 'admin')
  const current: UserRole[] = (settings?.roles ?? []).filter((r) => r !== 'admin')
  const dirty = draft.length !== current.length || draft.some((r) => !current.includes(r))

  return (
    <Card className="cvv-settings">
      <h2 className="cvv-settings-title">
        <UserCog size={18} aria-hidden />
        Qui peut vérifier les CV
      </h2>
      <p className="cvv-muted">
        L’administrateur a toujours accès à cette page. Vous pouvez aussi l’ouvrir aux rôles
        ci-dessous : tous les comptes du rôle coché pourront consulter les CV et rendre une décision.
      </p>

      {loadError ? (
        <div>
          <p style={{ marginBottom: '0.75rem' }}>{loadError}</p>
          <Button size="sm" onClick={load}>
            Réessayer
          </Button>
        </div>
      ) : !settings ? (
        <Loading />
      ) : grantable.length === 0 ? (
        <p className="cvv-muted">Aucun autre rôle ne peut être autorisé.</p>
      ) : (
        <>
          <div className="cvv-roles">
            {grantable.map((role) => (
              <label key={role} className="cvv-role">
                <input
                  type="checkbox"
                  checked={draft.includes(role)}
                  disabled={saving}
                  onChange={(e) => toggle(role, e.target.checked)}
                />
                {ROLE_LABELS[role] ?? role}
              </label>
            ))}
          </div>
          {saveError && <p className="cvv-error">{saveError}</p>}
          {saved && <p className="save-ok">Réglage enregistré.</p>}
          <div>
            <Button size="sm" disabled={!dirty || saving} onClick={save}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
