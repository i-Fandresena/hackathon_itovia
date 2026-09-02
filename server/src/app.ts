import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import path from 'node:path'
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
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))

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

  app.use(notFound)
  app.use(errorHandler)

  return app
}
