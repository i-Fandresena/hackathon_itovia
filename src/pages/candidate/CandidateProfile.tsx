import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { FileText, Plus, Send, Upload } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select } from '../../components/ui/Form'
import { CVExtractedData } from '../../components/cv/CVExtractedData'
import { CvFlagList, CvStatusBadge } from '../../components/cv/CvStatus'
import {
  AVAILABILITY_LABELS,
  COMMON_SKILLS,
  EDUCATION_LABELS,
  EXPERIENCE_LABELS,
  GENDER_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  PROVINCES,
} from '../../data/constants'
import { useApp } from '../../context/AppContext'
import {
  ApiError,
  apiFileUrl,
  apiGiveMatchingConsent,
  apiUploadCv,
  apiWithdrawMatchingConsent,
} from '../../lib/api'
import { formatDate } from '../../lib/format'
import type {
  Availability,
  CandidateProfile,
  EducationLevel,
  ExperienceLevel,
  Gender,
  OpportunityType,
} from '../../types'
import './CandidateProfile.css'

const emptyProfile: CandidateProfile = {
  fullName: '',
  email: '',
  phone: '',
  province: PROVINCES[0],
  city: PROVINCES[0],
  gender: 'autre',
  educationLevel: 'licence',
  skills: [],
  experienceLevel: 'debutant',
  desiredOpportunityTypes: ['emploi'],
  availability: 'flexible',
}

const sameSkill = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function CandidateProfile() {
  const { currentUser, updateCandidateProfile, patchCandidateProfile } = useApp()
  // État du formulaire, initialisé une fois : il n'est pas resynchronisé sur
  // `currentUser`, pour qu'un dépôt de CV ou un changement de consentement
  // (qui mettent à jour `currentUser`) n'écrase pas une saisie en cours.
  // L'email vit sur le compte (`User`), pas sur `CandidateProfile` en base :
  // on le reporte ici pour que le champ ne s'affiche pas vide.
  const [profile, setProfile] = useState<CandidateProfile>(() => {
    const saved = currentUser?.candidateProfile
    return saved
      ? { ...saved, email: saved.email || currentUser.email }
      : { ...emptyProfile, email: currentUser?.email ?? '' }
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [cvUploading, setCvUploading] = useState(false)
  const [cvFile, setCvFile] = useState<File | null>(null)
  /** Attestation sur l'honneur — obligatoire à chaque dépôt, jamais
   *  pré-cochée, et remise à zéro après l'envoi. */
  const [cvAttested, setCvAttested] = useState(false)
  /** Consentement de matching donné en même temps que le dépôt — facultatif,
   *  jamais pré-coché. */
  const [cvConsent, setCvConsent] = useState(false)
  const [consentBusy, setConsentBusy] = useState(false)
  const [consentConfirming, setConsentConfirming] = useState(false)
  const [consentMessage, setConsentMessage] = useState('')
  const [consentError, setConsentError] = useState('')
  const [cvError, setCvError] = useState('')
  const [cvValidationErrors, setCvValidationErrors] = useState<string[]>([])
  const [cvWarnings, setCvWarnings] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** Champs déjà enregistrés par le serveur (CV, consentement) : reportés
   *  dans le formulaire et dans `currentUser`, sans toucher au reste de la
   *  saisie en cours. */
  const applyServerPatch = (patch: Partial<CandidateProfile>) => {
    setProfile((p) => ({ ...p, ...patch }))
    patchCandidateProfile(patch)
  }

  const toggleSkill = (skill: string) => {
    setProfile((p) => ({
      ...p,
      skills: p.skills.includes(skill)
        ? p.skills.filter((s) => s !== skill)
        : [...p.skills, skill],
    }))
  }

  const toggleType = (type: OpportunityType) => {
    setProfile((p) => ({
      ...p,
      desiredOpportunityTypes: p.desiredOpportunityTypes.includes(type)
        ? p.desiredOpportunityTypes.filter((t) => t !== type)
        : [...p.desiredOpportunityTypes, type],
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const result = await updateCandidateProfile({ ...profile, city: profile.city || profile.province })
    if (!result.ok) {
      setError(result.error ?? 'Enregistrement impossible.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleCvChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCvFile(e.target.files?.[0] ?? null)
    setCvError('')
    setCvValidationErrors([])
  }

  const handleCvUpload = async () => {
    if (!cvFile || !cvAttested) return
    setCvUploading(true)
    setCvError('')
    setCvValidationErrors([])
    setCvWarnings([])
    try {
      const result = await apiUploadCv(cvFile, cvAttested, cvConsent)
      // Un nouveau dépôt repart toujours d'une vérification à faire : on
      // reflète la réponse du serveur sans attendre un rechargement.
      applyServerPatch({
        cvUrl: result.cvUrl,
        cvVerificationStatus: result.verificationStatus,
        cvFlags: result.flags,
        cvVerificationNote: null,
        cvVerifiedAt: null,
        cvSkillsSuggested: result.suggestedSkills ?? [],
        matchingConsentAt: result.matchingConsentAt,
      })
      setCvWarnings(result.validationWarnings ?? [])
      setCvFile(null)
      setCvAttested(false)
      setCvConsent(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      if (err instanceof ApiError) {
        // 400 « le CV ne correspond pas au profil » : le serveur détaille
        // chaque écart dans `validationErrors`.
        const details: unknown = err.body?.validationErrors
        setCvValidationErrors(
          Array.isArray(details) ? details.filter((d): d is string => typeof d === 'string') : [],
        )
        setCvError(err.message)
      } else {
        setCvError('Le dépôt du CV a échoué. Vérifiez votre connexion et qu’il s’agit bien d’un fichier PDF.')
      }
    } finally {
      setCvUploading(false)
    }
  }

  const cvStatus = profile.cvVerificationStatus ?? 'non_verifie'

  const consentAt = profile.matchingConsentAt ?? null

  const handleGiveConsent = async () => {
    setConsentBusy(true)
    setConsentError('')
    setConsentMessage('')
    try {
      const saved = await apiGiveMatchingConsent()
      applyServerPatch({ matchingConsentAt: saved.matchingConsentAt ?? null })
      setConsentMessage(
        'Consentement enregistré. OffRec peut désormais proposer votre profil aux entreprises dont les offres vous correspondent.',
      )
    } catch (err) {
      setConsentError(err instanceof ApiError ? err.message : 'Enregistrement du consentement impossible.')
    } finally {
      setConsentBusy(false)
    }
  }

  const handleWithdrawConsent = async () => {
    setConsentBusy(true)
    setConsentError('')
    setConsentMessage('')
    try {
      const { candidateProfile, withdrawnSuggestions } = await apiWithdrawMatchingConsent()
      applyServerPatch({ matchingConsentAt: candidateProfile.matchingConsentAt ?? null })
      setConsentConfirming(false)
      setConsentMessage(
        withdrawnSuggestions > 0
          ? `Consentement retiré. OffRec ne proposera plus votre profil ; ${withdrawnSuggestions} proposition${withdrawnSuggestions > 1 ? 's' : ''} encore en attente de validation ${withdrawnSuggestions > 1 ? 'ont été annulées' : 'a été annulée'}.`
          : 'Consentement retiré. OffRec ne proposera plus votre profil à de nouvelles entreprises.',
      )
    } catch (err) {
      setConsentError(err instanceof ApiError ? err.message : 'Retrait du consentement impossible.')
    } finally {
      setConsentBusy(false)
    }
  }

  // Compétences détectées dans le CV et pas encore dans le profil. Les
  // ajouter ne fait que remplir le formulaire : c'est l'enregistrement du
  // profil par le candidat qui les confirme (le CV ne s'applique jamais seul).
  const pendingCvSkills = (profile.cvSkillsSuggested ?? []).filter(
    (skill) => !profile.skills.some((s) => sameSkill(s, skill)),
  )
  const savedSkills = currentUser?.candidateProfile?.skills ?? []
  const skillsUnsaved =
    profile.skills.length !== savedSkills.length || profile.skills.some((s) => !savedSkills.includes(s))
  // Les compétences hors liste commune (venues du CV) restent visibles et
  // retirables dans le champ « Compétences ».
  const commonSkills: readonly string[] = COMMON_SKILLS
  const skillOptions = [...commonSkills, ...profile.skills.filter((s) => !commonSkills.includes(s))]

  const addSkills = (skills: string[]) => {
    setProfile((p) => {
      const added = skills.filter((skill) => !p.skills.some((s) => sameSkill(s, skill)))
      return added.length === 0 ? p : { ...p, skills: [...p.skills, ...added] }
    })
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <header className="page-header">
          <h1>Mon profil candidat</h1>
          <p>
            Le matching avec les offres se base sur ce profil : vos compétences, votre province,
            votre niveau et les types d’opportunités recherchés.
          </p>
        </header>

        <Card className="profile-block">
          <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Mon CV</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)', marginBottom: '0.75rem' }}>
            Déposez votre CV (PDF) : nous en extrayons quelques compétences à titre de suggestion,
            que vous choisissez ou non d’ajouter à votre profil. Chaque CV est ensuite relu par
            OffRec.
          </p>

          {profile.cvUrl && (
            <div className="cv-current">
              <div className="cv-current-head">
                <a href={apiFileUrl(profile.cvUrl)} target="_blank" rel="noreferrer" className="cv-current-link">
                  <FileText size={14} />
                  Voir le CV déposé
                </a>
                <CvStatusBadge status={cvStatus} />
              </div>
              {cvStatus === 'non_verifie' && (
                <p className="cv-current-note">
                  Votre CV sera relu par OffRec avant toute mise en relation.
                </p>
              )}
              {cvStatus === 'verifie' && profile.cvVerifiedAt && (
                <p className="cv-current-note">Vérifié le {formatDate(profile.cvVerifiedAt)}.</p>
              )}
              {cvStatus === 'rejete' && (
                <div className="cv-alert cv-alert-danger" role="status">
                  <strong>Ce CV n’a pas été validé par OffRec.</strong>
                  {profile.cvVerificationNote && (
                    <p>Motif indiqué par le vérificateur : {profile.cvVerificationNote}</p>
                  )}
                  <p>Vous pouvez déposer un CV corrigé ci-dessous.</p>
                </div>
              )}
              {cvStatus !== 'verifie' && profile.cvFlags && profile.cvFlags.length > 0 && (
                <div className="cv-points">
                  <p className="cv-points-title">Points à vérifier</p>
                  <p className="cv-current-note">
                    Relevés automatiquement à l’analyse du CV, ils seront examinés par un
                    vérificateur OffRec. Si vos informations sont exactes, vous n’avez rien à faire.
                  </p>
                  <CvFlagList flags={profile.cvFlags} />
                </div>
              )}
            </div>
          )}

          <div className="cv-upload">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              hidden
              onChange={handleCvChange}
            />
            <div className="cv-upload-row">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cvUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />
                {profile.cvUrl ? 'Choisir un nouveau CV (PDF)' : 'Choisir un CV (PDF)'}
              </Button>
              <span className="cv-upload-file">{cvFile ? cvFile.name : 'Aucun fichier sélectionné'}</span>
            </div>

            <label className="cv-attestation">
              <input
                type="checkbox"
                checked={cvAttested}
                disabled={cvUploading}
                onChange={(e) => setCvAttested(e.target.checked)}
              />
              <span>
                Je certifie que les informations de mon CV (diplômes, expériences, compétences)
                sont exactes et me concernent personnellement.
              </span>
            </label>
            <p className="cv-deterrent">
              Les informations sont vérifiées par OffRec avant toute mise en relation. Une fausse
              déclaration peut entraîner un avertissement, une restriction du compte, et jusqu’au
              bannissement.
            </p>
            {!consentAt && (
              <label className="cv-attestation">
                <input
                  type="checkbox"
                  checked={cvConsent}
                  disabled={cvUploading}
                  onChange={(e) => setCvConsent(e.target.checked)}
                />
                <span>
                  J’accepte qu’OffRec propose mon profil aux entreprises dont les offres me
                  correspondent{' '}
                  <span className="cv-optional">
                    (facultatif — vous pourrez donner ou retirer cet accord à tout moment ci-dessous)
                  </span>
                  .
                </span>
              </label>
            )}

            <Button
              type="button"
              size="sm"
              disabled={!cvFile || !cvAttested || cvUploading}
              onClick={handleCvUpload}
            >
              <Send size={14} />
              {cvUploading ? 'Analyse en cours…' : 'Envoyer le CV'}
            </Button>
            {!cvUploading && cvFile && !cvAttested && (
              <p className="cv-current-note">Cochez l’attestation pour pouvoir envoyer votre CV.</p>
            )}
          </div>

          {cvError && (
            <div className="cv-alert cv-alert-danger" role="alert">
              <strong>{cvError}</strong>
              {cvValidationErrors.length > 0 && (
                <>
                  <ul>
                    {cvValidationErrors.map((msg) => (
                      <li key={msg}>{msg}</li>
                    ))}
                  </ul>
                  <p>
                    Les informations personnelles du CV doivent correspondre à celles de votre
                    profil. Corrigez votre profil ou déposez le bon CV.
                  </p>
                </>
              )}
            </div>
          )}
          {cvWarnings.length > 0 && (
            <div className="cv-alert cv-alert-warning" role="status">
              <ul>
                {cvWarnings.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
          {pendingCvSkills.length > 0 && (
            <div className="cv-suggested">
              <div className="cv-suggested-head">
                <p className="cv-current-note">
                  Compétences détectées dans le CV, pas encore dans votre profil — cliquez pour les
                  ajouter, puis enregistrez le profil :
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => addSkills(pendingCvSkills)}>
                  <Plus size={14} />
                  Ajouter toutes les compétences détectées
                </Button>
              </div>
              <div className="skill-chips">
                {pendingCvSkills.map((skill) => (
                  <button key={skill} type="button" className="chip" onClick={() => addSkills([skill])}>
                    + {skill}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="consent-card">
          <div className="consent-head">
            <h2>Proposition de mon profil aux entreprises</h2>
            <span className={`consent-tag ${consentAt ? 'is-on' : 'is-off'}`}>
              {consentAt ? 'Consentement donné' : 'Consentement non donné'}
            </span>
          </div>
          <p className="consent-text">
            {consentAt
              ? `Vous avez accepté le ${formatDate(consentAt)} qu’OffRec propose votre profil aux entreprises dont les offres vous correspondent. Vous n’avez pas à postuler : vous êtes notifié·e à la mise en relation.`
              : 'Tant que vous n’avez pas donné votre accord, OffRec ne propose votre profil à aucune entreprise. Avec votre accord, vous n’avez pas à postuler : vous êtes notifié·e à la mise en relation.'}
          </p>
          {consentAt && !profile.cvUrl && (
            <p className="cv-current-note">
              Il manque encore votre CV : sans lui, le système ne peut pas proposer votre profil.
            </p>
          )}

          {!consentAt && (
            <Button type="button" size="sm" disabled={consentBusy} onClick={handleGiveConsent}>
              {consentBusy ? 'Enregistrement…' : 'J’accepte qu’OffRec propose mon profil'}
            </Button>
          )}
          {consentAt && !consentConfirming && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setConsentConfirming(true)
                setConsentMessage('')
                setConsentError('')
              }}
            >
              Retirer mon consentement
            </Button>
          )}
          {consentAt && consentConfirming && (
            <div className="cv-alert cv-alert-warning consent-confirm" role="alert">
              <p>
                Si vous retirez votre consentement, OffRec ne fera plus aucune nouvelle proposition
                de votre profil. Les dossiers déjà transmis à une entreprise ne sont pas retirés
                automatiquement : retirez-vous de chacun depuis votre tableau de bord si vous le
                souhaitez.
              </p>
              <div className="consent-actions">
                <Button type="button" variant="danger" size="sm" disabled={consentBusy} onClick={handleWithdrawConsent}>
                  {consentBusy ? 'Retrait…' : 'Confirmer le retrait'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={consentBusy}
                  onClick={() => setConsentConfirming(false)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
          {consentMessage && (
            <p className="consent-result" role="status">
              {consentMessage}
            </p>
          )}
          {consentError && (
            <p className="consent-error" role="alert">
              {consentError}
            </p>
          )}
        </Card>

        {/* Afficher les données extraites du CV si disponibles */}
        <CVExtractedData profile={profile} />

        <Card>
          <form onSubmit={handleSubmit}>
            <Field label="Nom complet">
              <Input
                required
                value={profile.fullName}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                required
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </Field>
            <Field label="Téléphone">
              <Input
                required
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </Field>
            <Field label="Genre">
              <Select
                value={profile.gender}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value as Gender })}
              >
                {(Object.keys(GENDER_LABELS) as Gender[]).map((k) => (
                  <option key={k} value={k}>
                    {GENDER_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Province">
              <Select
                value={profile.province}
                onChange={(e) =>
                  setProfile({ ...profile, province: e.target.value, city: e.target.value })
                }
              >
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ville">
              <Input
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              />
            </Field>
            <Field label="Niveau d’études">
              <Select
                value={profile.educationLevel}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    educationLevel: e.target.value as EducationLevel,
                  })
                }
              >
                {(Object.keys(EDUCATION_LABELS) as EducationLevel[]).map((k) => (
                  <option key={k} value={k}>
                    {EDUCATION_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Niveau d’expérience">
              <Select
                value={profile.experienceLevel}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    experienceLevel: e.target.value as ExperienceLevel,
                  })
                }
              >
                {(Object.keys(EXPERIENCE_LABELS) as ExperienceLevel[]).map((k) => (
                  <option key={k} value={k}>
                    {EXPERIENCE_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Compétences">
              <p className="profile-help">
                Le matching se base sur les compétences de votre profil : celles détectées dans
                votre CV ne comptent que si vous les ajoutez ici et enregistrez.
              </p>
              <div className="skill-chips">
                {skillOptions.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    className={`chip ${profile.skills.includes(skill) ? 'active' : ''}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Types d’opportunités recherchées">
              <div className="skill-chips">
                {(Object.keys(OPPORTUNITY_TYPE_LABELS) as OpportunityType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`chip ${profile.desiredOpportunityTypes.includes(t) ? 'active' : ''}`}
                    onClick={() => toggleType(t)}
                  >
                    {OPPORTUNITY_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Disponibilité">
              <Select
                value={profile.availability}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    availability: e.target.value as Availability,
                  })
                }
              >
                {(Object.keys(AVAILABILITY_LABELS) as Availability[]).map((k) => (
                  <option key={k} value={k}>
                    {AVAILABILITY_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            {skillsUnsaved && !saved && (
              <p className="profile-unsaved" role="status">
                Compétences modifiées : enregistrez le profil pour qu’elles soient prises en compte
                dans le matching.
              </p>
            )}
            {saved && <p className="save-ok">Profil enregistré avec succès.</p>}
            {error && <p style={{ color: 'var(--color-danger, #c0392b)' }}>{error}</p>}
            <Button type="submit" fullWidth>
              Enregistrer le profil
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

