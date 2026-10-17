import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { attachSession } from './middleware/auth.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import authRoutes from './routes/auth.routes.js'
import opportunityRoutes from './routes/opportunities.routes.js'
import applicationRoutes from './routes/applications.routes.js'
import notificationRoutes from './routes/notifications.routes.js'
import directoryRoutes from './routes/directory.routes.js'
import aiRoutes from './routes/ai.routes.js'
import adminRoutes from './routes/admin.routes.js'
import messageRoutes from './routes/messages.routes.js'
import billingRoutes from './routes/billing.routes.js'
import reportRoutes from './routes/reports.routes.js'
import agentRoutes from './routes/agent.routes.js'
import placementRoutes from './routes/placements.routes.js'
import publicRoutes from './routes/public.routes.js'
import verificationRoutes from './routes/verification.routes.js'
import talentAccountRoutes from './routes/talent-account.routes.js'
import adminMatchingRoutes from './routes/admin-matching.routes.js'
import matchSuggestionsRoutes from './routes/match-suggestions.routes.js'
import cvVerificationRoutes from './routes/cv-verification.routes.js'
import uploadsRoutes from './routes/uploads.routes.js'
import endorsementRoutes from './routes/endorsements.routes.js'
import publicTalentRoutes from './routes/public-talents.routes.js'
import companyRoutes from './routes/companies.routes.js'
import adminCompanyRoutes from './routes/admin-companies.routes.js'
import adminRecruiterRoutes from './routes/admin-recruiters.routes.js'
import adminCandidateRoutes from './routes/admin-candidates.routes.js'
import adminActivityRoutes from './routes/admin-activity.routes.js'
import recruiterRoutes from './routes/recruiter.routes.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use(attachSession)
  // Plus de `express.static` public : les fichiers déposés (CV) ne sont
  // servis qu'après contrôle d'accès — voir routes/uploads.routes.ts.
  app.use('/uploads', uploadsRoutes)

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/opportunities', opportunityRoutes)
  app.use('/api/applications', applicationRoutes)
  app.use('/api/notifications', notificationRoutes)
  app.use('/api/directory', directoryRoutes)
  app.use('/api/ai', aiRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/messages', messageRoutes)
  app.use('/api/billing', billingRoutes)
  app.use('/api/reports', reportRoutes)
  app.use('/api/agent', agentRoutes)
  app.use('/api/placements', placementRoutes)
  app.use('/api/talent-leads', publicRoutes)
  app.use('/api/verification', verificationRoutes)
  app.use('/api/talent-account', talentAccountRoutes)
  app.use('/api/admin/matching', adminMatchingRoutes)
  app.use('/api/match-suggestions', matchSuggestionsRoutes)
  app.use('/api/recruiter', recruiterRoutes)
  app.use('/api/cv-verification', cvVerificationRoutes)
  app.use('/api/endorsements', endorsementRoutes)
  // Vitrine publique « Talents recommandés » (lecture sans compte).
  app.use('/api/talents-recommandes', publicTalentRoutes)
  // Entreprises recommandées : vitrine publique, encart du recruteur lié.
  app.use('/api/companies', companyRoutes)
  app.use('/api/admin/companies', adminCompanyRoutes)
  app.use('/api/admin/recruiters', adminRecruiterRoutes)
  app.use('/api/admin/candidates', adminCandidateRoutes)
  // Journal d'activité de la plateforme (consultation admin).
  app.use('/api/admin/activity', adminActivityRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
