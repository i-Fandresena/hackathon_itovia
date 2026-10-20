import { z } from 'zod'
import {
  INTERVIEW_MESSAGE_MAX,
  INTERVIEW_REASON_MAX,
  contactDetailsError,
  interviewWindowError,
} from '../../../src/lib/interview.js'
import {
  ABSENCE_REPLY_MAX,
  ABSENCE_REPLY_MIN,
  CONTRACT_DURATION_MAX_MONTHS,
  CONTRACT_DURATION_MIN_MONTHS,
  CONTRACT_TYPES,
  DECLINE_NOTE_MAX,
  HIRE_DECLINE_REASONS,
  HIRE_JOB_TITLE_MAX,
  HIRE_JOB_TITLE_MIN,
  HIRE_MESSAGE_MAX,
  HIRE_PROPOSAL_STATUSES,
  INTERVIEW_OUTCOME_FILTERS,
  INTERVIEW_RESULTS,
  INTERVIEW_RESULT_REASONS,
  OPPORTUNITY_POSITIONS_MAX,
  OPPORTUNITY_POSITIONS_MIN,
  OUTCOME_NOTE_MAX,
  contractDurationError,
  hireSalaryError,
  hireStartDateError,
  outcomeReasonError,
} from '../../../src/lib/hiring.js'
import {
  OPPORTUNITY_SKILLS_MAX,
  checkMissions,
  normalizeRequiredSkills,
  skillError,
} from '../../../src/lib/opportunityFields.js'
import { HIRING_PERIODS } from './hiring-metrics.js'

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
export const notificationCategories = ['candidat', 'recruteur', 'agent', 'systeme', 'moderation', 'annuaire'] as const

/** Paramètres de `GET /notifications/mine` (chaînes de requête). */
export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  category: z.enum(notificationCategories).optional(),
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})

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

/**
 * Missions de l'offre (facultatives) : liste de textes, lignes vides
 * ignorées, espaces nettoyés, 15 au plus, 3 à 200 caractères chacune, sans
 * doublon ni coordonnées (email, téléphone, site web) — règles partagées
 * avec le formulaire recruteur (`src/lib/opportunityFields.ts`).
 */
const opportunityMissionsSchema = z
  .array(z.string({ invalid_type_error: 'Chaque mission doit être un texte.' }), {
    invalid_type_error: 'Les missions doivent être une liste.',
  })
  .transform((raw, ctx) => {
    const { missions, errors } = checkMissions(raw)
    for (const error of errors) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error.message })
    }
    return missions
  })

/**
 * Compétences requises : suggestions (`COMMON_SKILLS`) ou saisie libre.
 * Espaces nettoyés, 2 à 50 caractères, sans coordonnées ni adresse web ;
 * une saisie équivalente à une suggestion (casse, accents) prend le libellé
 * de la suggestion et les doublons sont fusionnés ; 20 au plus après fusion.
 */
const opportunitySkillsSchema = z
  .array(z.string({ invalid_type_error: 'Chaque compétence doit être un texte.' }), {
    invalid_type_error: 'Les compétences requises doivent être une liste.',
  })
  .default([])
  .transform((raw, ctx) => {
    const skills = normalizeRequiredSkills(raw)
    for (const skill of skills) {
      const error = skillError(skill)
      if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `« ${skill.slice(0, 60)} » : ${error}` })
    }
    if (skills.length > OPPORTUNITY_SKILLS_MAX) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${OPPORTUNITY_SKILLS_MAX} compétences au maximum.` })
    }
    return skills
  })

/** Nombre de postes d'une offre (D1) : 1 à 50 (`positionsUpdateError` côté serveur pour le minimum de placements). */
export const opportunityPositionsField = z
  .number({ invalid_type_error: 'Nombre de postes invalide.' })
  .int('Nombre de postes invalide.')
  .min(OPPORTUNITY_POSITIONS_MIN, `Nombre de postes attendu : de ${OPPORTUNITY_POSITIONS_MIN} à ${OPPORTUNITY_POSITIONS_MAX}.`)
  .max(OPPORTUNITY_POSITIONS_MAX, `Nombre de postes attendu : de ${OPPORTUNITY_POSITIONS_MIN} à ${OPPORTUNITY_POSITIONS_MAX}.`)

export const opportunityInputSchema = z.object({
  title: z.string().min(3, 'Le titre doit contenir au moins 3 caractères.'),
  category: z.string().min(2, 'La catégorie est requise.'),
  sector: z.enum(sectors, { errorMap: () => ({ message: 'Secteur invalide.' }) }),
  sectorDetails: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  description: z.string().min(10, 'La description doit contenir au moins 10 caractères.'),
  province: z.string().min(2, 'La province est requise.'),
  city: z.string().min(2, 'La ville est requise.'),
  opportunityType: z.enum(opportunityTypes, { errorMap: () => ({ message: 'Type d’opportunité invalide.' }) }),
  requiredSkills: opportunitySkillsSchema,
  /** Absent : les missions déjà enregistrées ne sont pas touchées (PUT) ;
   *  `[]` à la création. */
  missions: opportunityMissionsSchema.optional(),
  level: z.enum(experienceLevels, { errorMap: () => ({ message: 'Niveau d’expérience invalide.' }) }),
  deadline: z.string().refine((v) => Boolean(v) && !Number.isNaN(Date.parse(v)), 'Date limite invalide.'),
  featured: z.boolean().optional(),
  /** Nombre de postes (D1). Absent : 1 à la création, inchangé en modification. */
  positions: opportunityPositionsField.optional(),
})

export const applicationInputSchema = z.object({
  message: z.string().max(2000).optional(),
})

/** `proposee_candidat` / `interet_candidat` : valeurs héritées (avant la
 *  décision 2026-10-08), plus jamais produites mais toujours valides. */
export const matchSuggestionStatuses = [
  'suggeree',
  'proposee_candidat',
  'interet_candidat',
  'proposee_recruteur',
  'interet_recruteur',
  'mise_en_relation',
  'ecartee',
] as const

export const matchSuggestionQuerySchema = z.object({
  status: z.enum(matchSuggestionStatuses, { errorMap: () => ({ message: 'Statut invalide.' }) }).optional(),
})

export const createMatchSuggestionSchema = z.object({
  opportunityId: z.string().uuid(),
  candidateId: z.string().uuid(),
})

export const matchSuggestionStatusSchema = z.object({
  status: z.enum(matchSuggestionStatuses),
})

/* Textes libres sans coordonnées : OffRec reste l'intermédiaire
 * (`contactDetailsError`, src/lib/interview.ts). */

const rejectContactDetails = (value: string | null | undefined, ctx: z.RefinementCtx) => {
  const error = contactDetailsError(value)
  if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error })
}

/** Texte libre facultatif : vide, absent ou `null` → `null`. */
const optionalNoContactText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .superRefine(rejectContactDetails)

/** Texte libre obligatoire, entre `min` et `max` caractères après `trim`. */
const noContactText = (options: { min: number; max: number; tooShort: string; tooLong: string }) =>
  z
    .string({ required_error: options.tooShort })
    .trim()
    .min(options.min, options.tooShort)
    .max(options.max, options.tooLong)
    .superRefine(rejectContactDetails)

/* Entretiens fixés par le recruteur (décision 2026-10-14, lib/interviews.ts). */

const interviewOptionalText = optionalNoContactText

/**
 * Date et heure de l'entretien : instant ISO 8601 avec fuseau explicite
 * (le client envoie l'heure de Madagascar avec `+03:00`), au moins 2 h
 * après maintenant et au plus 60 jours plus tard.
 */
const interviewDateSchema = z
  .string({ required_error: 'Indiquez la date et l’heure de l’entretien.' })
  .datetime({ offset: true, message: 'Date et heure invalides (format ISO 8601 avec fuseau attendu).' })
  .transform((value) => new Date(value))
  .superRefine((date, ctx) => {
    const error = interviewWindowError(date, new Date())
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error })
  })

export const interviewScheduleSchema = z.object({
  scheduledAt: interviewDateSchema,
  durationMinutes: z.union([z.literal(30), z.literal(45), z.literal(60)], {
    errorMap: () => ({ message: 'Durée attendue : 30, 45 ou 60 minutes.' }),
  }),
  message: interviewOptionalText(INTERVIEW_MESSAGE_MAX, `Message trop long (${INTERVIEW_MESSAGE_MAX} caractères au plus).`),
})

/** Reprogrammation : nouvelle date et durée ; le message est conservé s'il
 *  est omis (`undefined`), effacé s'il est vide ou `null`. */
export const interviewRescheduleSchema = interviewScheduleSchema.extend({
  message: z
    .string()
    .trim()
    .max(INTERVIEW_MESSAGE_MAX, `Message trop long (${INTERVIEW_MESSAGE_MAX} caractères au plus).`)
    .nullable()
    .optional()
    .superRefine(rejectContactDetails),
})

export const interviewUnavailableSchema = z.object({
  reason: noContactText({
    min: 3,
    max: INTERVIEW_REASON_MAX,
    tooShort: 'Indiquez brièvement le motif de l’empêchement.',
    tooLong: `Motif trop long (${INTERVIEW_REASON_MAX} caractères au plus).`,
  }),
})

/* Après l'entretien (plan du 2026-10-16) : règles dans src/lib/hiring.ts.
 * Issue, réponse d'absence et filtre « Issue » : routes du sous-lot 3
 * (lib/hiring-service.ts, lib/interview-list.ts) ; propositions d'embauche
 * et offre pourvue : sous-lot 5 (lib/hire-proposals.ts,
 * lib/opportunity-fill.ts). */

const interviewIdField = z.string({ required_error: 'Entretien manquant.' }).uuid('Entretien invalide.')
const proposalIdField = z.string({ required_error: 'Proposition manquante.' }).uuid('Proposition invalide.')
const revisionField = z
  .number({ required_error: 'Révision manquante.', invalid_type_error: 'Révision invalide.' })
  .int('Révision invalide.')
  .min(0, 'Révision invalide.')

/**
 * Issue d'un tour par le recruteur. `nextRound` (date du tour suivant, mêmes
 * règles que `interviewScheduleSchema`) seulement avec `second_entretien`.
 * La note privée n'est relue que par son auteur (décision D3).
 */
export const interviewOutcomeSchema = z
  .object({
    interviewId: interviewIdField,
    result: z.enum(INTERVIEW_RESULTS, { errorMap: () => ({ message: 'Issue d’entretien invalide.' }) }),
    reason: z.enum(INTERVIEW_RESULT_REASONS, { errorMap: () => ({ message: 'Motif invalide.' }) }).optional(),
    note: optionalNoContactText(OUTCOME_NOTE_MAX, `Note trop longue (${OUTCOME_NOTE_MAX} caractères au plus).`),
    nextRound: interviewScheduleSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const reasonError = outcomeReasonError(value.result, value.reason)
    if (reasonError) ctx.addIssue({ code: z.ZodIssueCode.custom, message: reasonError, path: ['reason'] })
    if (value.nextRound && value.result !== 'second_entretien') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La date d’un tour suivant ne s’indique qu’avec l’issue « Second entretien ».',
        path: ['nextRound'],
      })
    }
  })

/** Explication d'absence du candidat (lue par les admins seuls). */
export const absenceReplySchema = z.object({
  interviewId: interviewIdField,
  reason: noContactText({
    min: ABSENCE_REPLY_MIN,
    max: ABSENCE_REPLY_MAX,
    tooShort: 'Expliquez brièvement votre absence.',
    tooLong: `Explication trop longue (${ABSENCE_REPLY_MAX} caractères au plus).`,
  }),
})

const hireProposalFields = {
  jobTitle: noContactText({
    min: HIRE_JOB_TITLE_MIN,
    max: HIRE_JOB_TITLE_MAX,
    tooShort: `Intitulé du poste trop court (${HIRE_JOB_TITLE_MIN} caractères au moins).`,
    tooLong: `Intitulé du poste trop long (${HIRE_JOB_TITLE_MAX} caractères au plus).`,
  }),
  /** Salaire mensuel brut, en Ariary (entier). */
  monthlySalaryAr: z
    .number({
      required_error: 'Indiquez le salaire mensuel brut en Ariary.',
      invalid_type_error: 'Indiquez le salaire mensuel brut en Ariary.',
    })
    .superRefine((value, ctx) => {
      const error = hireSalaryError(value)
      if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error })
    }),
  /** Jour civil AAAA-MM-JJ à Madagascar : d'aujourd'hui à +180 jours. */
  startDate: z.string({ required_error: 'Indiquez la date de début.' }).superRefine((value, ctx) => {
    const error = hireStartDateError(value, new Date())
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error })
  }),
  contractType: z.enum(CONTRACT_TYPES, { errorMap: () => ({ message: 'Type de contrat invalide.' }) }),
  contractDurationMonths: z
    .number({ invalid_type_error: 'Durée du contrat invalide.' })
    .int('Durée du contrat invalide.')
    .min(CONTRACT_DURATION_MIN_MONTHS, `Durée attendue : de ${CONTRACT_DURATION_MIN_MONTHS} à ${CONTRACT_DURATION_MAX_MONTHS} mois.`)
    .max(CONTRACT_DURATION_MAX_MONTHS, `Durée attendue : de ${CONTRACT_DURATION_MIN_MONTHS} à ${CONTRACT_DURATION_MAX_MONTHS} mois.`)
    .nullable()
    .optional(),
  message: optionalNoContactText(HIRE_MESSAGE_MAX, `Message trop long (${HIRE_MESSAGE_MAX} caractères au plus).`),
}

/** Proposition d'embauche (recruteur) : durée obligatoire pour un CDD ou un stage, interdite pour un CDI. */
export const hireProposalSchema = z.object(hireProposalFields).superRefine((value, ctx) => {
  const error = contractDurationError(value.contractType, value.contractDurationMonths)
  if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error, path: ['contractDurationMonths'] })
})

/**
 * Modification d'une proposition en attente : champs modifiés + révision
 * lue. La cohérence contrat / durée n'est contrôlée ici que si les deux
 * champs sont envoyés ; le serveur la recontrôle sur la proposition
 * fusionnée (`mergeProposalRevision`, lib/hire-proposals.ts).
 */
export const hireProposalReviseSchema = z
  .object(hireProposalFields)
  .partial()
  .extend({ revision: revisionField })
  .superRefine((value, ctx) => {
    const { revision: _revision, ...changes } = value
    if (Object.values(changes).every((field) => field === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Aucune modification à enregistrer.' })
    }
    if (value.contractType && value.contractDurationMonths !== undefined) {
      const error = contractDurationError(value.contractType, value.contractDurationMonths)
      if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error, path: ['contractDurationMonths'] })
    }
  })

/** Retrait d'une proposition par le recruteur. */
export const hireProposalWithdrawSchema = z.object({ revision: revisionField })

/** Acceptation par le candidat : la révision qu'il a lue. */
export const hireProposalAcceptSchema = z.object({ proposalId: proposalIdField, revision: revisionField })

/** Refus par le candidat : catégorie et précision facultatives (précision lue par les admins seuls). */
export const hireProposalDeclineSchema = z.object({
  proposalId: proposalIdField,
  revision: revisionField,
  reason: z.enum(HIRE_DECLINE_REASONS, { errorMap: () => ({ message: 'Motif invalide.' }) }).optional(),
  note: optionalNoContactText(DECLINE_NOTE_MAX, `Précision trop longue (${DECLINE_NOTE_MAX} caractères au plus).`),
})

/** `GET /admin/matching/hire-proposals?status=` (statut effectif). */
export const adminHireProposalQuerySchema = z.object({
  status: z.enum(HIRE_PROPOSAL_STATUSES, { errorMap: () => ({ message: 'Statut de proposition invalide.' }) }).optional(),
})

/** Réouverture d'une offre pourvue (`positions` facultatif, `checkOpportunityFillAction`). */
export const opportunityReopenSchema = z.object({ positions: opportunityPositionsField.optional() })

/** Filtre « Issue » des listes d'entretiens (`?outcome=`, recruteur et admin). */
export const interviewOutcomeFilterSchema = z.enum(INTERVIEW_OUTCOME_FILTERS, {
  errorMap: () => ({ message: 'Filtre d’issue invalide.' }),
})

/* Présélection ATS par offre (lib/preselection.ts). */

const TOP_MESSAGE = 'Le nombre de profils retenus doit être 5 ou 10.'
const FLAG_MESSAGE = 'Valeur attendue : true ou false.'

/** Filtre optionnel passé en paramètre de requête : `true` | `false`, absent = désactivé. */
const queryFlag = z
  .enum(['true', 'false'], { errorMap: () => ({ message: FLAG_MESSAGE }) })
  .optional()
  .transform((value) => value === 'true')

export const preselectionQuerySchema = z.object({
  top: z
    .enum(['5', '10'], { errorMap: () => ({ message: TOP_MESSAGE }) })
    .default('5')
    .transform((value) => (value === '10' ? 10 : 5) as 5 | 10),
  verifiedOnly: queryFlag,
  sameProvince: queryFlag,
  levelMatch: queryFlag,
  desiredType: queryFlag,
})

export const preselectionTransmitSchema = z.object({
  candidateIds: z
    .array(z.string().uuid('Identifiant de candidat invalide.'))
    .min(1, 'Sélectionnez au moins un candidat.')
    .max(10, 'Dix candidats au plus par transmission.')
    .refine((ids) => new Set(ids).size === ids.length, 'Un candidat ne peut être sélectionné qu’une fois.'),
  top: z.union([z.literal(5), z.literal(10)], { errorMap: () => ({ message: TOP_MESSAGE }) }).default(5),
  filters: z
    .object({
      verifiedOnly: z.boolean().default(false),
      sameProvince: z.boolean().default(false),
      levelMatch: z.boolean().default(false),
      desiredType: z.boolean().default(false),
    })
    .default({}),
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

export const reportTargetTypes = ['opportunity', 'provider', 'recommendation', 'user', 'endorsement', 'talent', 'company'] as const
export const moderationActionTypes = ['dismiss', 'warning', 'restriction', 'suspension', 'ban'] as const

/** Identifiant public d'une fiche « Talents recommandés » (jamais l'id interne). */
export const PUBLIC_REF_PATTERN = /^[a-z2-9]{10}$/

/**
 * `targetId` est un UUID, sauf pour une fiche publique de talent : le client
 * n'en connaît que le `publicRef`, résolu en id côté serveur.
 */
export const reportInputSchema = z
  .object({
    targetType: z.enum(reportTargetTypes),
    targetId: z.string().min(1).max(64),
    reason: z.string().min(10).max(1000),
  })
  .superRefine((v, ctx) => {
    const ok = v.targetType === 'talent' ? PUBLIC_REF_PATTERN.test(v.targetId) : z.string().uuid().safeParse(v.targetId).success
    if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetId'], message: 'Identifiant invalide.' })
  })

export const moderationResolveSchema = z.object({
  action: z.enum(moderationActionTypes),
  note: z.string().max(1000).optional(),
})

// Vérification des CV candidats

export const userRoles = ['candidate', 'recruiter', 'particulier', 'admin', 'agent', 'talent'] as const
export const cvVerificationStatuses = ['non_verifie', 'verifie', 'rejete'] as const

export const cvQueueQuerySchema = z.object({
  status: z.enum(cvVerificationStatuses, { errorMap: () => ({ message: 'Statut invalide.' }) }).default('non_verifie'),
})

export const cvVerificationDecisionSchema = z
  .object({
    decision: z.enum(['verifie', 'rejete'], { errorMap: () => ({ message: 'Décision invalide.' }) }),
    note: z.string().trim().max(1000, 'La note ne doit pas dépasser 1000 caractères.').optional(),
    /** `cvUrl` du fichier lu par le vérificateur — refus (409) s'il a changé entre-temps. */
    cvUrl: z.string().max(200).optional(),
  })
  .refine((v) => v.decision !== 'rejete' || Boolean(v.note && v.note.length > 0), {
    message: 'Une note est obligatoire pour rejeter un CV.',
    path: ['note'],
  })

export const cvVerifierRolesSchema = z.object({
  roles: z.array(z.enum(userRoles, { errorMap: () => ({ message: 'Rôle invalide.' }) })),
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
  /** Quartier (facultatif), affiché à côté de la ville. */
  district: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v : null)),
})

/**
 * Création d'un profil de talent : l'accord de la personne est obligatoire
 * pour TOUTE création (directe, depuis une demande de contact, une piste de
 * veille ou une recommandation). Une seule origine à la fois.
 */
export const talentCreateSchema = talentProfileInputSchema
  .extend({
    consent: z.literal(true, {
      errorMap: () => ({
        message: 'Cochez la case : la personne doit avoir accepté d’avoir un profil OffRec et d’être proposée à des entreprises.',
      }),
    }),
    fromLeadId: z.string().uuid().optional(),
    fromSourcingLeadId: z.string().uuid().optional(),
    fromSignalId: z.string().uuid().optional(),
  })
  .refine((v) => [v.fromLeadId, v.fromSourcingLeadId, v.fromSignalId].filter(Boolean).length <= 1, {
    message: 'Un profil ne peut venir que d’une seule origine (demande, veille ou recommandation).',
    path: ['fromSignalId'],
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

/** Déclaration d'un placement par le recruteur : l'offre est obligatoire
 *  (contrôle de propriété et de proposition préalable, routes/placements). */
export const placementInputSchema = z
  .object({
    opportunityId: z
      .string({ required_error: 'Indiquez l’offre concernée par le placement.' })
      .uuid('Offre invalide.'),
    candidateId: z.string().uuid().optional(),
    talentId: z.string().uuid().optional(),
    monthlySalaryAr: z.number().int().positive('Le salaire doit être un montant positif.').optional(),
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

// Recommandations de talents (signal privé traité par un agent)

export const talentSignalStatuses = [
  'nouveau',
  'pris_en_charge',
  'converti',
  'refuse',
  'injoignable',
  'expire',
  'fusionne',
] as const

/** Chiffres seulement, `261` ou `0` initial retiré, 9 derniers gardés. `null` si invalide. */
export function phoneKeyOf(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('261')) digits = digits.slice(3)
  else if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.length === 9 ? digits : null
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au maximum.`)
    .optional()
    .transform((v) => (v ? v : undefined))

/** Fin de journée d'aujourd'hui à Madagascar (UTC+3) : une date de travail ne peut pas être future. */
function endOfTodayMadagascar(): number {
  const offset = 3 * 60 * 60 * 1000
  const day = 24 * 60 * 60 * 1000
  return Math.floor((Date.now() + offset) / day) * day + day - offset
}

/**
 * Corps de `POST /endorsements/talents` (champ multipart `payload`, JSON).
 * `highlights` est contrôlé contre la liste fermée par l'appelant
 * (`TALENT_HIGHLIGHTS`, fichier partagé).
 */
export const talentEndorsementInputSchema = z
  .object({
    trade: z.string().trim().min(2, 'Indiquez le métier.').max(80),
    sector: z.enum(sectors),
    province: z.string().trim().min(2).max(60),
    city: z.string().trim().min(2, 'Indiquez la ville.').max(80),
    district: z.string().trim().min(2, 'Indiquez le quartier.').max(80),
    subjectName: optionalText(80),
    contactPhone: optionalText(30).refine((v) => v === undefined || phoneKeyOf(v) !== null, {
      message: 'Numéro invalide : 10 chiffres (ex. 034 12 345 67) ou +261 suivi de 9 chiffres.',
    }),
    contactHint: optionalText(300),
    relation: z.enum(['client', 'employeur', 'collegue'], {
      errorMap: () => ({ message: 'Choisissez votre lien avec cette personne.' }),
    }),
    jobLabel: z.string().trim().min(8, 'Décrivez le travail en 8 caractères au moins.').max(200),
    jobDate: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), 'Date invalide.')
      .refine((v) => Date.parse(v) <= endOfTodayMadagascar(), 'La date ne peut pas être dans le futur.'),
    highlights: z.array(z.string()).min(1, 'Choisissez au moins un point fort.').max(5, '5 points forts au maximum.'),
    comment: optionalText(1000),
    authorDistrict: optionalText(80),
  })
  .refine((v) => Boolean(v.subjectName || v.contactPhone || v.contactHint), {
    message: 'Donnez au moins un moyen de retrouver cette personne (nom, téléphone ou lieu).',
    path: ['contactPhone'],
  })

export const talentSignalListQuerySchema = z.object({
  status: z.enum(talentSignalStatuses).optional(),
})

/** Changements de statut demandés par l'agent (la conversion est le lot 3). */
export const talentSignalStatusSchema = z.object({
  status: z.enum(['nouveau', 'refuse', 'injoignable', 'pris_en_charge']),
})

export const signalMergeSchema = z.object({
  intoId: z.string().uuid(),
})

export const endorsementReviewSchema = z
  .object({
    proofAccepted: z.boolean().optional(),
    reviewed: z.literal(true).optional(),
    hiddenJobLabel: z.boolean().optional(),
    exclude: z.object({ reason: z.string().trim().min(3, 'Précisez le motif.').max(300) }).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Aucune modification demandée.' })

// Talents recommandés : fiche publique et demandes de contact via OffRec

/** Accord de visibilité publique recueilli (ou retiré) par l'agent. */
export const publicVisibilitySchema = z.object({
  granted: z.boolean(),
})

/** L'admin ne peut que retirer une fiche publique (modération), jamais la donner. */
export const adminPublicVisibilitySchema = z.object({
  granted: z.literal(false),
})

const optionalFilter = z
  .string()
  .trim()
  .max(80)
  .optional()
  .transform((v) => (v ? v : undefined))

/** Paramètres de `GET /talents-recommandes`. */
export const publicTalentListQuerySchema = z.object({
  trade: optionalFilter,
  city: optionalFilter,
  /** Taille maximale de chaque section (recommandés, nouveaux). */
  limit: z.coerce.number().int().min(1).max(100).default(60),
})

export const contactRequestStatuses = ['nouvelle', 'transmise', 'close'] as const

export const talentContactRequestInputSchema = z.object({
  need: z
    .string()
    .trim()
    .min(20, 'Décrivez votre besoin en 20 caractères au moins.')
    .max(1000, '1000 caractères au maximum.'),
})

export const contactRequestListQuerySchema = z.object({
  status: z.enum(contactRequestStatuses).optional(),
})

/** L'agent fait avancer la demande : `nouvelle → transmise → close` (ou `nouvelle → close`). */
export const contactRequestStatusSchema = z.object({
  status: z.enum(['transmise', 'close']),
})

// Entreprises recommandées

/** Paramètres de `GET /companies` (vitrine et recherche du formulaire). */
export const companyListQuerySchema = z.object({
  q: optionalFilter,
  city: optionalFilter,
  sector: z.enum(sectors).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
})

/**
 * Recommander une entreprise (champ `payload` du multipart). Soit
 * `companyId` (entreprise existante, proposée par la recherche), soit
 * `company` (nouvelle fiche, dédoublonnée par `nameKey` + ville côté serveur).
 */
export const companyEndorsementInputSchema = z
  .object({
    companyId: z.string().uuid().optional(),
    company: z
      .object({
        name: z.string().trim().min(2, 'Indiquez le nom de l’entreprise.').max(120),
        sector: z.enum(sectors),
        province: z.string().trim().min(2).max(60),
        city: z.string().trim().min(2, 'Indiquez la ville.').max(80),
      })
      .optional(),
    relation: z.enum(['salarie', 'stagiaire', 'prestataire'], {
      errorMap: () => ({ message: 'Choisissez votre lien avec cette entreprise.' }),
    }),
    jobLabel: z.string().trim().min(3, 'Indiquez votre poste ou votre mission (3 caractères au moins).').max(120),
    jobDate: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), 'Date invalide.')
      .refine((v) => Date.parse(v) <= endOfTodayMadagascar(), 'La date ne peut pas être dans le futur.'),
    highlights: z.array(z.string()).min(1, 'Choisissez au moins un point fort.').max(5, '5 points forts au maximum.'),
    comment: optionalText(1000),
    authorDistrict: optionalText(80),
  })
  .refine((v) => Boolean(v.companyId) !== Boolean(v.company), {
    message: 'Choisissez une entreprise existante ou décrivez-en une nouvelle.',
    path: ['company'],
  })

/** Revue admin d'une recommandation d'entreprise : décision sur la preuve, ou exclusion d'un auteur lié. */
export const companyEndorsementReviewSchema = z
  .object({
    proofAccepted: z.boolean().optional(),
    exclude: z.object({ reason: z.string().trim().min(3, 'Précisez le motif.').max(300) }).optional(),
  })
  .refine((v) => v.proofAccepted !== undefined || v.exclude !== undefined, { message: 'Aucune modification demandée.' })

/** Masquer / réafficher une entreprise (admin). */
export const companyVisibilitySchema = z.union([
  z.object({ hidden: z.literal(true), reason: z.string().trim().min(3, 'Précisez le motif.').max(300) }),
  z.object({ hidden: z.literal(false) }),
])

/** Lier (ou délier, `null`) une entreprise à un compte recruteur (admin). */
export const companyRecruiterLinkSchema = z.object({
  recruiterUserId: z.string().uuid().nullable(),
})

// Comptes recruteurs (consultation admin)

export const userStatuses = ['active', 'warned', 'restricted', 'suspended', 'banned'] as const

/** Paramètres de `GET /admin/recruiters` (recherche, filtre de statut, tri, pagination). */
export const adminRecruiterListQuerySchema = z.object({
  /** Recherche sur l'email, le nom de l'entreprise déclarée ou celui de la fiche liée. */
  q: optionalFilter,
  status: z.enum(userStatuses).optional(),
  /** `activity` : dernière activité d'abord ; `recent` : inscription la plus récente ; `name` : entreprise A→Z. */
  sort: z.enum(['activity', 'recent', 'name']).default('activity'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
})

export const adminRecruiterIdParamSchema = z.object({
  id: z.string().uuid('Identifiant de compte invalide.'),
})

/** Paramètres de `GET /admin/candidates` (recherche, filtres, tri, pagination). */
export const adminCandidateListQuerySchema = z.object({
  /** Recherche sans casse ni accents sur le nom, l'email ou une compétence confirmée du profil. */
  q: optionalFilter,
  status: z.enum(userStatuses).optional(),
  /** Consentement de matching : `given` (en vigueur) ou `missing` (jamais donné ou retiré). */
  consent: z.enum(['given', 'missing']).optional(),
  /** CV : `present` / `absent`, ou un statut de vérification (CV déposé dans ce statut). */
  cv: z.enum(['present', 'absent', 'non_verifie', 'verifie', 'rejete']).optional(),
  /**
   * `activity` : dernière activité d'abord ; `recent` : inscription la plus récente ;
   * `name` : nom A→Z ; `completion` : profil le plus complet d’abord.
   */
  sort: z.enum(['activity', 'recent', 'name', 'completion']).default('activity'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
})

export const adminCandidateIdParamSchema = z.object({
  id: z.string().uuid('Identifiant de compte invalide.'),
})

// Journal d'activité (admin)

/** Familles d'actions du journal — libellés et correspondance des actions : `lib/activity.ts`. */
export const ACTIVITY_FAMILY_KEYS = [
  'comptes',
  'candidats',
  'matching',
  'recruteurs',
  'talents',
  'recommandations',
  'entreprises',
  'moderation',
  'placements',
  'administration',
  'autre',
] as const

/** Curseur `<ms depuis l'époque>_<uuid>` renvoyé par `GET /admin/activity` (`nextCursor`). */
export const ACTIVITY_CURSOR_PATTERN = /^\d{1,15}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const booleanFlag = z
  .enum(['1', '0', 'true', 'false'])
  .optional()
  .transform((v) => v === '1' || v === 'true')

/** Paramètres de `GET /admin/activity` (filtres, curseur, taille de page). */
export const adminActivityQuerySchema = z
  .object({
    family: z.enum(ACTIVITY_FAMILY_KEYS).optional(),
    /** Rôle de l'acteur. */
    role: z.enum(userRoles).optional(),
    /** Acteur : email, nom du candidat ou de l'agent, raison sociale du recruteur. */
    q: optionalFilter,
    /** Début (inclus) et fin (exclue) de la période, ISO 8601 avec fuseau. */
    from: z.string().datetime({ offset: true, message: 'Date de début invalide.' }).optional(),
    to: z.string().datetime({ offset: true, message: 'Date de fin invalide.' }).optional(),
    /** Inclure les événements système (matching, envoi des notifications, purge). Désactivé par défaut. */
    system: booleanFlag,
    cursor: z.string().regex(ACTIVITY_CURSOR_PATTERN, 'Curseur invalide.').optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((v) => !v.from || !v.to || Date.parse(v.from) < Date.parse(v.to), {
    message: 'La date de début doit précéder la date de fin.',
    path: ['to'],
  })

/* Listes « Entretiens » (lib/interview-list.ts). */

const interviewPeriods = ['a_venir', 'passes', 'annules', 'tous'] as const
const interviewStatuses = ['planifie', 'confirme', 'empechement', 'annule'] as const

/** `GET /match-suggestions/interviews` (recruteur) : filtres facultatifs. */
export const recruiterInterviewQuerySchema = z.object({
  period: z.enum(interviewPeriods, { errorMap: () => ({ message: 'Période invalide.' }) }).default('a_venir'),
  status: z.enum(interviewStatuses, { errorMap: () => ({ message: 'Statut d’entretien invalide.' }) }).optional(),
  opportunityId: z.string().uuid('Offre invalide.').optional(),
  /** `a_renseigner` (issue due) ou une issue posée. */
  outcome: interviewOutcomeFilterSchema.optional(),
})

/** `GET /admin/matching/interviews` : en plus, recruteur, problème d'agenda
 *  et pagination par décalage (`offset` + `limit`, 100 au plus). */
export const adminInterviewQuerySchema = recruiterInterviewQuerySchema.extend({
  recruiterId: z.string().uuid('Recruteur invalide.').optional(),
  calendarIssue: z
    .enum(['true', 'false'], { errorMap: () => ({ message: 'Valeur attendue : true ou false.' }) })
    .optional()
    .transform((value) => value === 'true'),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

/* Mesure « après l'entretien » (sous-lot 7, lib/hiring-stats.ts). */

/** Période de la cohorte (dossiers transmis pendant les n derniers jours, ou depuis le début). */
const hiringPeriodField = z
  .enum(HIRING_PERIODS, { errorMap: () => ({ message: 'Période invalide (30, 90, 365 ou all).' }) })
  .default('all')

/** `GET /recruiter/stats/hiring` : période et offre facultative (la sienne). */
export const recruiterHiringStatsQuerySchema = z.object({
  period: hiringPeriodField,
  opportunityId: z.string().uuid('Offre invalide.').optional(),
})

/** `GET /admin/stats/hiring` : en plus, recruteur et exclusion des comptes de test. */
export const adminHiringStatsQuerySchema = recruiterHiringStatsQuerySchema.extend({
  recruiterId: z.string().uuid('Recruteur invalide.').optional(),
  excludeTest: queryFlag,
})

/** `POST /admin/stats/research-export` : exclusion facultative des comptes de test. */
export const researchExportSchema = z
  .object({ excludeTest: z.boolean({ invalid_type_error: 'Valeur attendue : true ou false.' }).default(false) })
  .strict()
