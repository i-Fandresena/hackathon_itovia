import { useState, type FormEvent } from 'react'
import { Flag } from 'lucide-react'
import { Button } from './Button'
import { apiCreateReport, type ReportTargetType } from '../../lib/api'
import { useApp } from '../../context/AppContext'

interface ReportButtonProps {
  targetType: ReportTargetType
  targetId: string
}

/** Signalement minimal : n'importe quel compte connecté peut alerter l'admin. */
export function ReportButton({ targetType, targetId }: ReportButtonProps) {
  const { currentUser } = useApp()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [sent, setSent] = useState(false)

  if (!currentUser) return null
  if (sent) {
    return <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>Signalement envoyé, merci.</p>
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 10) return
    await apiCreateReport(targetType, targetId, reason.trim())
    setSent(true)
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Flag size={14} />
        Signaler
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Pourquoi signalez-vous ceci ? (10 caractères min.)"
        style={{ flex: 1, minWidth: 220, padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid var(--color-border)' }}
      />
      <Button type="submit" size="sm" disabled={reason.trim().length < 10}>
        Envoyer
      </Button>
    </form>
  )
}
