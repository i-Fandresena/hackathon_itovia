import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Star } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { DISTRICTS, PRICE_UNITS, PROOF_LABELS } from '../../data/constants'
import { useApp } from '../../context/AppContext'
import type { ProofType } from '../../types'
import './Directory.css'

const TODAY = new Date().toISOString().slice(0, 10)
const MIN_COMMENT = 40

/**
 * Le formulaire impose ce qui rend une recommandation exploitable : un
 * travail précis, une date de chantier, et un commentaire qui décrit une
 * expérience. « Très bon, je recommande » n'aide personne et est refusé.
 */
export function RecommendationForm() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { hydrated, getProvider, addRecommendation, canRecommendProvider } = useApp()

  const provider = getProvider(id)

  const [jobLabel, setJobLabel] = useState('')
  const [jobDate, setJobDate] = useState('')
  const [district, setDistrict] = useState('')
  const [rating, setRating] = useState(4)
  const [wouldUseAgain, setWouldUseAgain] = useState(true)
  const [pricePaid, setPricePaid] = useState('')
  const [priceUnit, setPriceUnit] = useState('')
  const [comment, setComment] = useState('')
  const [proof, setProof] = useState<ProofType>('aucune')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  const guard = useMemo(() => canRecommendProvider(id), [canRecommendProvider, id])

  if (!hydrated) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="page">
        <div className="container">
          <p>Prestataire introuvable.</p>
          <Link to="/annuaire">Retour à l’annuaire</Link>
        </div>
      </div>
    )
  }

  if (!guard.ok) {
    return (
      <div className="page">
        <div className="container dir-detail">
          <Card>
            <p className="dir-guard">{guard.error}</p>
            <Link to={`/annuaire/${provider.id}`}>Retour à la fiche</Link>
          </Card>
        </div>
      </div>
    )
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (jobLabel.trim().length < 8) {
      next.jobLabel = 'Décrivez le travail réalisé (ex. « livraison de 2 000 briques »).'
    }
    if (!jobDate) {
      next.jobDate = 'La date du chantier est obligatoire.'
    } else if (jobDate > TODAY) {
      next.jobDate = 'La date ne peut pas être dans le futur.'
    }
    if (!district) next.district = 'Indiquez votre quartier.'
    if (comment.trim().length < MIN_COMMENT) {
      next.comment = `Décrivez ce que vous avez constaté (${MIN_COMMENT} caractères minimum).`
    }
    if (pricePaid && !priceUnit) {
      next.priceUnit = 'Précisez l’unité du prix.'
    }
    if (pricePaid && Number(pricePaid) <= 0) {
      next.pricePaid = 'Montant invalide.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    const result = addRecommendation({
      providerId: provider.id,
      rating,
      wouldUseAgain,
      jobLabel: jobLabel.trim(),
      jobDate,
      authorDistrict: district,
      pricePaid: pricePaid ? Number(pricePaid) : undefined,
      priceUnit: pricePaid ? priceUnit : undefined,
      comment: comment.trim(),
      proof,
    })

    if (!result.ok) {
      setFormError(result.error ?? 'Publication impossible.')
      return
    }
    navigate(`/annuaire/${provider.id}`)
  }

  return (
    <div className="page">
      <div className="container dir-detail dir-form-page">
        <Link to={`/annuaire/${provider.id}`} className="dir-back">
          <ArrowLeft size={16} aria-hidden />
          Retour à la fiche
        </Link>

        <header className="page-header">
          <h1>Recommander {provider.name}</h1>
          <p>
            Votre retour n’a de valeur que s’il repose sur un travail réel. Plus
            il est précis et documenté, plus il pèse dans le score du
            prestataire.
          </p>
        </header>

        <Card>
          <form onSubmit={handleSubmit} className="dir-form">
            <Field
              label="Travail réalisé"
              error={errors.jobLabel}
              hint="Soyez concret : quantité, surface, durée."
            >
              <Input
                value={jobLabel}
                onChange={(e) => setJobLabel(e.target.value)}
                placeholder="Livraison de 2 000 briques à Alasora"
              />
            </Field>

            <div className="dir-form-row">
              <Field
                label="Date du chantier"
                error={errors.jobDate}
                hint="Pas la date du jour : celle du travail."
              >
                <Input
                  type="date"
                  max={TODAY}
                  value={jobDate}
                  onChange={(e) => setJobDate(e.target.value)}
                />
              </Field>

              <Field label="Votre quartier" error={errors.district}>
                <Select value={district} onChange={(e) => setDistrict(e.target.value)}>
                  <option value="">Choisir…</option>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Votre note">
              <div className="dir-stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`dir-star ${n <= rating ? 'active' : ''}`}
                    onClick={() => setRating(n)}
                    aria-label={`${n} sur 5`}
                  >
                    <Star size={22} fill={n <= rating ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </Field>

            <Field
              label="Referiez-vous appel à ce prestataire ?"
              hint="C’est le signal que les autres membres regardent en premier."
            >
              <div className="skill-chips">
                <button
                  type="button"
                  className={`chip ${wouldUseAgain ? 'active' : ''}`}
                  onClick={() => setWouldUseAgain(true)}
                >
                  Oui, je le reprendrais
                </button>
                <button
                  type="button"
                  className={`chip ${!wouldUseAgain ? 'active' : ''}`}
                  onClick={() => setWouldUseAgain(false)}
                >
                  Non
                </button>
              </div>
            </Field>

            <div className="dir-form-row">
              <Field
                label="Prix payé (Ariary)"
                error={errors.pricePaid}
                hint="Facultatif, mais c’est l’information la plus recherchée."
              >
                <Input
                  type="number"
                  min="0"
                  value={pricePaid}
                  onChange={(e) => setPricePaid(e.target.value)}
                  placeholder="480"
                />
              </Field>

              <Field label="Unité" error={errors.priceUnit}>
                <Select value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)}>
                  <option value="">Choisir…</option>
                  {PRICE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="Votre expérience"
              error={errors.comment}
              hint={`Qualité, respect des délais, écart avec le devis… (${comment.trim().length}/${MIN_COMMENT})`}
            >
              <Textarea
                rows={5}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Briques bien cuites, peu de casse. Livraison le jour convenu, prix conforme à ce qui était annoncé au téléphone."
              />
            </Field>

            <Field
              label="Preuve"
              hint="Une facture ou une photo augmente nettement le poids de votre retour."
            >
              <Select
                value={proof}
                onChange={(e) => setProof(e.target.value as ProofType)}
              >
                {(Object.keys(PROOF_LABELS) as ProofType[]).map((p) => (
                  <option key={p} value={p}>
                    {PROOF_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>

            {formError && <p className="dir-guard">{formError}</p>}

            <Button type="submit" size="lg" fullWidth>
              Publier ma recommandation
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
