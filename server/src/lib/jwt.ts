import jwt from 'jsonwebtoken'
import type { UserRole } from '../../../src/types/index.js'

function readSecret(): string {
  const value = process.env.JWT_SECRET
  if (!value) {
    throw new Error('JWT_SECRET manquant : définissez-le dans server/.env')
  }
  return value
}

const JWT_SECRET: string = readSecret()

export interface SessionPayload {
  sub: string
  role: UserRole
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  })
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as SessionPayload
}
