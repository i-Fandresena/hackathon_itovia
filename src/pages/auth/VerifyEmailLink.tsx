import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { ApiError, apiConfirmVerificationLink } from '../../lib/api'
import { LogoMark } from '../../components/brand/Logo'
import './Auth.css'

/**
 * Page ouverte en cliquant sur "Vérifier mon email" depuis l'email reçu.
 * Ne complète pas l'inscription elle-même (les données du formulaire ne
 * vivent que dans l'onglet d'origine) — elle marque juste l'email vérifié ;
 * la modale restée ouverte dans l'autre onglet le détecte automatiquement
 * (EmailVerificationModal sonde /verification/status).
 */
export function VerifyEmailLink() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Lien invalide.')
      return
    }
    apiConfirmVerificationLink(token)
      .then(() => setStatus('ok'))
      .catch((err) => {
        setStatus('error')
        setError(err instanceof ApiError ? err.message : 'Lien invalide ou expiré.')
      })
  }, [token])

  return (
    <div className="split-auth-page">
      <Link to="/" className="split-back-link">
        <ArrowLeft size={16} aria-hidden />
        Retour à l’accueil
      </Link>

      <div className="split-left-panel">
        <svg className="split-wave" viewBox="0 0 560 560" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="280" cy="560" rx="360" ry="320" fill="rgba(255,255,255,0.05)" />
          <ellipse cx="280" cy="600" rx="300" ry="280" fill="rgba(255,255,255,0.07)" />
          <ellipse cx="280" cy="640" rx="240" ry="240" fill="rgba(255,255,255,0.09)" />
        </svg>
        <div className="split-brand-block">
          <div className="split-logo-badge">
            <LogoMark size={40} />
          </div>
          <h1 className="split-brand-name">OffRec</h1>
        </div>
      </div>

      <div className="split-right-panel">
        <div className="split-form-wrapper" style={{ textAlign: 'center' }}>
          {status === 'loading' && (
            <p className="split-form-subtitle">Vérification en cours…</p>
          )}
          {status === 'ok' && (
            <>
              <CheckCircle2 size={40} color="#059669" style={{ marginBottom: '1rem' }} />
              <h2 className="split-form-title">Email vérifié</h2>
              <p className="split-form-subtitle">
                Retournez à l’onglet où vous vous étiez inscrit·e — la vérification
                a été détectée automatiquement, vous pouvez continuer là-bas.
              </p>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle size={40} color="#dc2626" style={{ marginBottom: '1rem' }} />
              <h2 className="split-form-title">Lien invalide</h2>
              <p className="split-form-subtitle">{error} Retournez à l’inscription pour redemander un code.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
