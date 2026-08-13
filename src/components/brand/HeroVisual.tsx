import { motion, useReducedMotion } from 'framer-motion'
import { MatchRing } from './MatchRing'
import './HeroVisual.css'

const REASONS = [
  'Compétences : Réseaux sociaux, Canva',
  'Province : Antananarivo',
  'Niveau : Junior compatible',
]

export function HeroVisual() {
  const reduce = useReducedMotion()

  return (
    <div className="hero-visual-wrap">
      <motion.div
        className="hero-visual-glow"
        animate={reduce ? {} : { opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="hero-panel hero-panel-back"
        initial={reduce ? {} : { opacity: 0, y: 24, rotate: -3 }}
        animate={{ opacity: 1, y: 0, rotate: -3 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="hero-panel hero-panel-main"
        initial={reduce ? {} : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="hero-panel-header">
          <span className="hero-panel-tag">Recommandation active</span>
          <span className="hero-panel-live" />
        </div>
        <h3 className="hero-panel-title">Assistant·e marketing digital</h3>
        <p className="hero-panel-meta">TechMada Solutions · Antananarivo</p>
        <div className="hero-panel-body">
          <MatchRing value={87} size={96} label="match" />
          <ul className="hero-panel-reasons">
            {REASONS.map((r, i) => (
              <motion.li
                key={r}
                initial={reduce ? {} : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.08, duration: 0.35 }}
              >
                {r}
              </motion.li>
            ))}
          </ul>
        </div>
        <motion.div
          className="hero-panel-bar"
          initial={reduce ? { width: '87%' } : { width: 0 }}
          animate={{ width: '87%' }}
          transition={{ duration: 1, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </motion.div>
    </div>
  )
}
