import { z } from 'zod'

export const educationLevels = ['bac', 'licence', 'master', 'autodidacte', 'technique'] as const
export const experienceLevels = ['debutant', 'junior', 'intermediaire', 'senior'] as const
export const opportunityTypes = ['emploi', 'stage', 'mission', 'freelance', 'alternance'] as const
export const availabilities = ['immediate', 'm1', 'm3', 'flexible'] as const
export const proofTypes = ['facture', 'photo', 'aucune'] as const
export const genders = ['femme', 'homme', 'autre'] as const
export const talentStatuses = ['en_attente', 'verifie', 'recommande', 'place'] as const
export const applicationStatuses = ['envoyee', 'vue', 'contactee', 'refusee'] as const
export const placementStages = ['etape1_due', 'etape1_payee', 'etape2_due', 'etape2_payee', 'annule'] as const
export const sectors = ['btp', 'textile_artisanat', 'digital', 'agroalimentaire', 'services_commerce', 'autre'] as const
export const leadStatuses = ['nouveau', 'contacte', 'converti', 'ignore'] as const

export const candidateProfileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  province: z.string().min(2),
  city: z.string().min(2),
  gender: z.enum(genders),
  educationLevel: z.enum(educationLevels),
  skills: z.array(z.string().min(1)).default([]),
  experienceLevel: z.enum(experienceLevels),
  desiredOpportunityTypes: z.array(z.enum(opportunityTypes)).default([]),
  availability: z.enum(availabilities),
  sector: z.enum(sectors).optional(),
})

export const recruiterProfileSchema = z.object({
  companyName: z.string().min(2),
  phone: z.string().min(6),
  province: z.string().min(2),
  city: z.string().min(2),
  sector: z.enum(sectors),
})

export const individualProfileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  province: z.string().min(2),
  city: z.string().min(2),
})

/** Compte de suivi d'un talent non-diplômé — jamais de pouvoir d'écriture
 *  sur TalentProfile, voir schema.prisma TalentAccountProfile. */
export const talentAccountProfileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  province: z.string().min(2),
  city: z.string().min(2),
  gender: z.enum(genders),
  leadId: z.string().uuid().optional(),
})

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
  role: z.enum(['candidate', 'recruiter', 'particulier', 'talent']),
  verificationToken: z.string().min(1, 'Vérification email requise.'),
  candidateProfile: candidateProfileSchema.optional(),
  recruiterProfile: recruiterProfileSchema.optional(),
  individualProfile: individualProfileSchema.optional(),
  talentAccountProfile: talentAccountProfileSchema.optional(),
})

export const sendVerificationCodeSchema = z.object({
  email: z.string().email(),
})

export const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{4}$/, 'Le code doit contenir 4 chiffres.'),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const opportunityInputSchema = z.object({
  title: z.string().min(3, 'Le titre doit contenir au moins 3 caractères.'),
  category: z.string().min(2, 'La catégorie est requise.'),
  sector: z.enum(sectors, { errorMap: () => ({ message: 'Secteur invalide.' }) }),
  sectorDetails: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  description: z.string().min(10, 'La description doit contenir au moins 10 caractères.'),
  province: z.string().min(2, 'La province est requise.'),
  city: z.string().min(2, 'La ville est requise.'),
  opportunityType: z.enum(opportunityTypes, { errorMap: () => ({ message: 'Type d’opportunité invalide.' }) }),
  requiredSkills: z.array(z.string().min(1)).default([]),
  level: z.enum(experienceLevels, { errorMap: () => ({ message: 'Niveau d’expérience invalide.' }) }),
  deadline: z.string().refine((v) => Boolean(v) && !Number.isNaN(Date.parse(v)), 'Date limite invalide.'),
  featured: z.boolean().optional(),
})

export const applicationInputSchema = z.object({
  message: z.string().max(2000).optional(),
})

export const matchSuggestionStatuses = [
  'proposee_candidat',
  'interet_candidat',
  'proposee_recruteur',
  'interet_recruteur',
  'mise_en_relation',
  'ecartee',
] as const

export const createMatchSuggestionSchema = z.object({
  opportunityId: z.string().uuid(),
  candidateId: z.string().uuid(),
})

export const matchSuggestionStatusSchema = z.object({
  status: z.enum(matchSuggestionStatuses),
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

export const contactOffrecSchema = z.object({
  message: z.string().min(1).max(2000),
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

export const talentProfileInputSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  province: z.string().min(2),
  city: z.string().min(2),
  gender: z.enum(genders),
  trade: z.string().min(2),
  sector: z.enum(sectors),
  skills: z.array(z.string().min(1)).default([]),
  availability: z.enum(availabilities),
  fromLeadId: z.string().uuid().optional(),
  fromSourcingLeadId: z.string().uuid().optional(),
})

const sourcingLeadTypes = ['talent', 'opportunity'] as const

export const sourcingLeadInputSchema = z.object({
  type: z.enum(sourcingLeadTypes),
  source: z.string().min(2).max(200),
  sourceUrl: z.string().url().max(500).optional().or(z.literal('')),
  trade: z.string().min(2),
  sector: z.enum(sectors),
  province: z.string().min(2),
  city: z.string().min(2),
  description: z.string().min(5).max(1000),
})

export const sourcingLeadStatusSchema = z.object({
  status: z.enum(leadStatuses),
})

export const talentLeadInputSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  province: z.string().min(2),
  city: z.string().min(2),
  gender: z.enum(genders),
  trade: z.string().min(2),
  sector: z.enum(sectors),
  message: z.string().max(1000).optional(),
})

export const talentLeadStatusSchema = z.object({
  status: z.enum(leadStatuses),
})

export const talentVerificationInputSchema = z.object({
  trade: z.string().min(2),
  checklist: z.record(z.string(), z.boolean()),
  note: z.string().max(1000).optional(),
})

export const talentProposeSchema = z.object({
  opportunityId: z.string().uuid(),
})

export const applicationStatusSchema = z.object({
  status: z.enum(applicationStatuses),
})

export const placementInputSchema = z
  .object({
    opportunityId: z.string().uuid().optional(),
    candidateId: z.string().uuid().optional(),
    talentId: z.string().uuid().optional(),
    monthlySalaryAr: z.number().int().positive().optional(),
  })
  .refine((v) => Boolean(v.candidateId) !== Boolean(v.talentId), {
    message: 'Un placement concerne soit un candidat diplômé, soit un talent non-diplômé — jamais les deux.',
    path: ['candidateId'],
  })

export const placementStageSchema = z.object({
  stage: z.enum(placementStages),
})

export const agentProfileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  province: z.string().min(2),
  city: z.string().min(2),
})

export const createAgentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
  agentProfile: agentProfileSchema,
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
