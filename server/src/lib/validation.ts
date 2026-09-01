import { z } from 'zod'

export const educationLevels = ['bac', 'licence', 'master', 'autodidacte', 'technique'] as const
export const experienceLevels = ['debutant', 'junior', 'intermediaire', 'senior'] as const
export const opportunityTypes = ['emploi', 'stage', 'mission', 'freelance', 'alternance'] as const
export const availabilities = ['immediate', 'm1', 'm3', 'flexible'] as const
export const proofTypes = ['facture', 'photo', 'aucune'] as const

export const candidateProfileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  province: z.string().min(2),
  city: z.string().min(2),
  educationLevel: z.enum(educationLevels),
  skills: z.array(z.string().min(1)).default([]),
  experienceLevel: z.enum(experienceLevels),
  desiredOpportunityTypes: z.array(z.enum(opportunityTypes)).default([]),
  availability: z.enum(availabilities),
})

export const recruiterProfileSchema = z.object({
  companyName: z.string().min(2),
  phone: z.string().min(6),
  province: z.string().min(2),
  city: z.string().min(2),
  sector: z.string().min(2),
})

export const individualProfileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  province: z.string().min(2),
  city: z.string().min(2),
})

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
  role: z.enum(['candidate', 'recruiter', 'particulier']),
  candidateProfile: candidateProfileSchema.optional(),
  recruiterProfile: recruiterProfileSchema.optional(),
  individualProfile: individualProfileSchema.optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const opportunityInputSchema = z.object({
  title: z.string().min(3),
  category: z.string().min(2),
  description: z.string().min(20),
  province: z.string().min(2),
  city: z.string().min(2),
  opportunityType: z.enum(opportunityTypes),
  requiredSkills: z.array(z.string().min(1)).default([]),
  level: z.enum(experienceLevels),
  deadline: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Date invalide.'),
  featured: z.boolean().optional(),
})

export const applicationInputSchema = z.object({
  message: z.string().max(2000).optional(),
})

export const recommendationInputSchema = z.object({
  providerId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  wouldUseAgain: z.boolean(),
  jobLabel: z.string().min(8),
  jobDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)) && Date.parse(v) <= Date.now(), 'Date invalide.'),
  pricePaid: z.number().int().positive().optional(),
  priceUnit: z.string().min(1).optional(),
  comment: z.string().min(40),
  proof: z.enum(proofTypes).default('aucune'),
}).refine((v) => !v.pricePaid || !!v.priceUnit, {
  message: 'Un prix nécessite une unité.',
  path: ['priceUnit'],
})

export const startConversationSchema = z.object({
  toUserId: z.string().uuid(),
  opportunityId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
})

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
})

export const subscribeSchema = z.object({
  planCode: z.string().min(1),
})

export const reportTargetTypes = ['opportunity', 'provider', 'recommendation', 'user'] as const
export const moderationActionTypes = ['dismiss', 'warning', 'restriction', 'suspension', 'ban'] as const

export const reportInputSchema = z.object({
  targetType: z.enum(reportTargetTypes),
  targetId: z.string().uuid(),
  reason: z.string().min(10).max(1000),
})

export const moderationResolveSchema = z.object({
  action: z.enum(moderationActionTypes),
  note: z.string().max(1000).optional(),
})

export const providerInputSchema = z.object({
  name: z.string().min(2),
  trade: z.string().min(2),
  description: z.string().default(''),
  district: z.string().min(2),
  city: z.string().default('Antananarivo'),
  province: z.string().default('Antananarivo'),
  phone: z.string().min(6),
  whatsapp: z.string().optional(),
})
