import { ArrowRight, type LucideIcon } from 'lucide-react'
import { Button } from './Button'
import './EmptyState.css'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
          <ArrowRight size={16} aria-hidden />
        </Button>
      )}
    </div>
  )
}
