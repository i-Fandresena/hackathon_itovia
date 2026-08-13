import { motion, useReducedMotion } from 'framer-motion'
import './MatchRing.css'

interface MatchRingProps {
  value: number
  size?: number
  label?: string
}

export function MatchRing({ value, size = 88, label }: MatchRingProps) {
  const reduce = useReducedMotion()
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="match-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="match-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          className="match-ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeDasharray={circumference}
          initial={reduce ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <motion.div
        className="match-ring-center"
        initial={reduce ? {} : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <span className="match-ring-value">{value}</span>
        <span className="match-ring-unit">%</span>
        {label && <span className="match-ring-label">{label}</span>}
      </motion.div>
    </div>
  )
}
