import { motion, useReducedMotion } from 'framer-motion'
import './MadagascarMap.css'

const HUBS = [
  { id: 'tana', cx: 52, cy: 42, label: 'Tana' },
  { id: 'tamat', cx: 68, cy: 38, label: 'Tamat.' },
  { id: 'fianar', cx: 48, cy: 58, label: 'Fianar.' },
  { id: 'maha', cx: 38, cy: 32, label: 'Maha.' },
  { id: 'toli', cx: 42, cy: 72, label: 'Toliara' },
  { id: 'antsi', cx: 58, cy: 18, label: 'Antsi.' },
]

export function MadagascarMap() {
  const reduce = useReducedMotion()

  return (
    <div className="mada-map" aria-hidden>
      <svg viewBox="0 0 80 88" className="mada-map-svg">
        <path
          className="mada-outline"
          d="M48 8c-8 2-14 8-16 16-2 10 2 22 0 34-2 12-10 22-8 28 2 6 12 4 18 0 8-6 14-16 16-26 2-12-2-24 4-36 4-10 12-14 6-16z"
        />
        {HUBS.map((h, i) => (
          <g key={h.id}>
            {!reduce && (
              <motion.circle
                className="mada-pulse"
                cx={h.cx}
                cy={h.cy}
                r="4"
                initial={{ scale: 0.6, opacity: 0.5 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  delay: i * 0.35,
                  ease: 'easeOut',
                }}
              />
            )}
            <circle className="mada-dot" cx={h.cx} cy={h.cy} r="2.2" />
          </g>
        ))}
      </svg>
      <p className="mada-caption">6 provinces actives</p>
    </div>
  )
}
