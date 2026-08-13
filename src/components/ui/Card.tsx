import type { CSSProperties, ReactNode } from 'react'
import './Card.css'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: () => void
  hover?: boolean
}

export function Card({ children, className = '', style, onClick, hover }: CardProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`card ${hover ? 'card-hover' : ''} ${className}`.trim()}
      style={style}
      onClick={onClick}
    >
      {children}
    </Tag>
  )
}
