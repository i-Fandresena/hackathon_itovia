import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { apiSendVerificationCode, apiVerificationStatus, apiVerifyCode, ApiError } from '../../lib/api'
import './EmailVerificationModal.css'

const RESEND_COOLDOWN_S = 45
const POLL_INTERVAL_MS = 3000

interface EmailVerificationModalProps {
  email: string
  onVerified: (token: string) => void
  onClose: () => void
}

export function EmailVerificationModal({ email, onVerified, onClose }: EmailVerificationModalProps) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const submitCode = async (code: string) => {
    setVerifying(true)
    setError('')
    try {
      const { token } = await apiVerifyCode(email, code)
      onVerified(token)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Code incorrect.')
      setDigits(['', '', '', ''])
      inputsRef.current[0]?.focus()
    } finally {
      setVerifying(false)
    }
  }

  // Détecte une vérification faite via le lien cliqué dans l'email (autre
  // onglet) — l'utilisateur n'a alors rien à retaper ici.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const status = await apiVerificationStatus(email)
        if (status.verified && status.token) {
          clearInterval(interval)
          onVerified(status.token)
        }
      } catch {
        // Silencieux : le sondage réessaiera au prochain intervalle.
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [email, onVerified])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = clean
    setDigits(next)
    if (clean && index < 3) {
      inputsRef.current[index + 1]?.focus()
    }
    if (next.every((d) => d)) {
      submitCode(next.join(''))
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (text.length === 4) {
      e.preventDefault()
      setDigits(text.split(''))
      submitCode(text)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setError('')
    setDigits(['', '', '', ''])
    try {
      await apiSendVerificationCode(email)
      setCooldown(RESEND_COOLDOWN_S)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Envoi impossible pour le moment.')
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="verify-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="verify-modal"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="verify-modal-close" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>

          <h2 className="verify-modal-title">Vérifiez votre email</h2>
          <p className="verify-modal-text">
            Nous avons envoyé un code à 4 chiffres à <strong>{email}</strong>. Entrez-le
            ci-dessous pour continuer votre inscription.
          </p>

          <div className="verify-modal-digits">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                disabled={verifying}
                autoFocus={i === 0}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className="verify-modal-digit"
                aria-label={`Chiffre ${i + 1} du code`}
              />
            ))}
          </div>

          {error && <p className="verify-modal-error">{error}</p>}

          <p className="verify-modal-hint">
            Vous pouvez aussi cliquer sur le bouton « Vérifier mon email » dans
            l’email reçu — la vérification se fera automatiquement ici, sans
            retaper le code.
          </p>

          <button
            type="button"
            className="verify-modal-resend"
            onClick={handleResend}
            disabled={cooldown > 0}
          >
            {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : 'Renvoyer le code'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
