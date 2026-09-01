import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { fadeUp, staggerContainer } from '../../lib/motion'

type FadeUpProps = {
  index?: number
  className?: string
  children?: ReactNode
  /** Pages de données (tableaux de bord) : le contenu doit apparaître dès le
   *  montage, pas seulement au scroll — sinon tout ce qui est sous le pli
   *  reste invisible tant que personne ne fait défiler. Réservé au récit au
   *  scroll de la landing (comportement par défaut, inchangé). */
  eager?: boolean
}

export function FadeUp({ index = 0, children, className, eager = false }: FadeUpProps) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: eager ? '2000px' : '-40px' }}
      variants={fadeUp}
      custom={index}
    >
      {children}
    </motion.div>
  )
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-32px' }}
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  )
}

export function PageMotion({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
