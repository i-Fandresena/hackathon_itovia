--
-- PostgreSQL database dump
--

\restrict mKuUcIf9wG2FcrviL5gFdh5dM4f4nSEn5Riex6jk8HfVWuoqifU5hxyOZ2e2Hz4

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AccountTier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AccountTier" AS ENUM (
    'gratuit',
    'premium'
);


--
-- Name: ApplicationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ApplicationStatus" AS ENUM (
    'envoyee',
    'vue',
    'contactee',
    'refusee'
);


--
-- Name: Availability; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Availability" AS ENUM (
    'immediate',
    'm1',
    'm3',
    'flexible'
);


--
-- Name: EducationLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EducationLevel" AS ENUM (
    'bac',
    'licence',
    'master',
    'autodidacte',
    'technique'
);


--
-- Name: ExperienceLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ExperienceLevel" AS ENUM (
    'debutant',
    'junior',
    'intermediaire',
    'senior'
);


--
-- Name: Gender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Gender" AS ENUM (
    'femme',
    'homme',
    'autre'
);


--
-- Name: LeadStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LeadStatus" AS ENUM (
    'nouveau',
    'contacte',
    'converti',
    'ignore'
);


--
-- Name: MatchSuggestionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MatchSuggestionStatus" AS ENUM (
    'proposee_candidat',
    'interet_candidat',
    'proposee_recruteur',
    'interet_recruteur',
    'mise_en_relation',
    'ecartee'
);


--
-- Name: ModerationActionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ModerationActionType" AS ENUM (
    'dismiss',
    'warning',
    'restriction',
    'suspension',
    'ban'
);


--
-- Name: OpportunityType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OpportunityType" AS ENUM (
    'emploi',
    'stage',
    'mission',
    'freelance',
    'alternance'
);


--
-- Name: PlacementStage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PlacementStage" AS ENUM (
    'etape1_due',
    'etape1_payee',
    'etape2_due',
    'etape2_payee',
    'annule'
);


--
-- Name: ProofType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProofType" AS ENUM (
    'facture',
    'photo',
    'aucune'
);


--
-- Name: ReportStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReportStatus" AS ENUM (
    'open',
    'resolved'
);


--
-- Name: ReportTargetType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReportTargetType" AS ENUM (
    'opportunity',
    'provider',
    'recommendation',
    'user'
);


--
-- Name: Sector; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Sector" AS ENUM (
    'btp',
    'textile_artisanat',
    'digital',
    'agroalimentaire',
    'services_commerce',
    'autre'
);


--
-- Name: SourcingLeadType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SourcingLeadType" AS ENUM (
    'talent',
    'opportunity'
);


--
-- Name: TalentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TalentStatus" AS ENUM (
    'en_attente',
    'verifie',
    'recommande',
    'place'
);


--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserRole" AS ENUM (
    'candidate',
    'recruiter',
    'particulier',
    'admin',
    'agent',
    'talent'
);


--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserStatus" AS ENUM (
    'active',
    'warned',
    'restricted',
    'suspended',
    'banned'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AgentProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AgentProfile" (
    "userId" text NOT NULL,
    "fullName" text NOT NULL,
    phone text NOT NULL,
    province text NOT NULL,
    city text NOT NULL
);


--
-- Name: AiInteraction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiInteraction" (
    id text NOT NULL,
    "userId" text,
    feature text NOT NULL,
    "promptSummary" text NOT NULL,
    flagged boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Application; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Application" (
    id text NOT NULL,
    "opportunityId" text NOT NULL,
    "candidateId" text NOT NULL,
    message text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."ApplicationStatus" DEFAULT 'envoyee'::public."ApplicationStatus" NOT NULL
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "userId" text,
    action text NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Bookmark; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Bookmark" (
    "candidateId" text NOT NULL,
    "opportunityId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CandidateProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CandidateProfile" (
    "userId" text NOT NULL,
    "fullName" text NOT NULL,
    phone text NOT NULL,
    province text NOT NULL,
    city text NOT NULL,
    "educationLevel" public."EducationLevel" NOT NULL,
    skills text[],
    "experienceLevel" public."ExperienceLevel" NOT NULL,
    "desiredOpportunityTypes" public."OpportunityType"[],
    availability public."Availability" NOT NULL,
    "cvSkillsSuggested" text[] DEFAULT ARRAY[]::text[],
    "cvUrl" text,
    gender public."Gender" NOT NULL,
    sector public."Sector"
);


--
-- Name: Conversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Conversation" (
    id text NOT NULL,
    "participantAId" text NOT NULL,
    "participantBId" text NOT NULL,
    "opportunityId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: EmailVerification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmailVerification" (
    id text NOT NULL,
    email text NOT NULL,
    "codeHash" text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    token text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: IndividualProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."IndividualProfile" (
    "userId" text NOT NULL,
    "fullName" text NOT NULL,
    phone text NOT NULL,
    province text NOT NULL,
    city text NOT NULL
);


--
-- Name: MatchSuggestion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MatchSuggestion" (
    id text NOT NULL,
    "opportunityId" text NOT NULL,
    "candidateId" text NOT NULL,
    score integer NOT NULL,
    reasons text[],
    status public."MatchSuggestionStatus" DEFAULT 'proposee_candidat'::public."MatchSuggestionStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Member" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "displayName" text NOT NULL,
    district text NOT NULL,
    city text DEFAULT 'Antananarivo'::text NOT NULL,
    "phoneVerified" boolean DEFAULT false NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Message" (
    id text NOT NULL,
    "conversationId" text NOT NULL,
    "senderId" text NOT NULL,
    content text NOT NULL,
    "readAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ModerationAction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ModerationAction" (
    id text NOT NULL,
    "reportId" text,
    "adminId" text NOT NULL,
    "targetUserId" text,
    action public."ModerationActionType" NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    link text
);


--
-- Name: Opportunity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Opportunity" (
    id text NOT NULL,
    "recruiterId" text NOT NULL,
    "companyName" text NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    province text NOT NULL,
    city text NOT NULL,
    "opportunityType" public."OpportunityType" NOT NULL,
    "requiredSkills" text[],
    level public."ExperienceLevel" NOT NULL,
    deadline timestamp(3) without time zone NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sector public."Sector" DEFAULT 'autre'::public."Sector" NOT NULL,
    "sectorDetails" jsonb
);


--
-- Name: Placement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Placement" (
    id text NOT NULL,
    "opportunityId" text,
    "recruiterId" text NOT NULL,
    "candidateId" text,
    "talentId" text,
    "monthlySalaryAr" integer,
    stage public."PlacementStage" DEFAULT 'etape1_due'::public."PlacementStage" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Provider; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Provider" (
    id text NOT NULL,
    name text NOT NULL,
    trade text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    district text NOT NULL,
    city text DEFAULT 'Antananarivo'::text NOT NULL,
    province text DEFAULT 'Antananarivo'::text NOT NULL,
    phone text NOT NULL,
    whatsapp text,
    "addedByMemberId" text NOT NULL,
    "claimedByMemberId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Recommendation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Recommendation" (
    id text NOT NULL,
    "providerId" text NOT NULL,
    "authorMemberId" text NOT NULL,
    "authorDistrict" text NOT NULL,
    rating integer NOT NULL,
    "wouldUseAgain" boolean NOT NULL,
    "jobLabel" text NOT NULL,
    "jobDate" timestamp(3) without time zone NOT NULL,
    "pricePaid" integer,
    "priceUnit" text,
    comment text NOT NULL,
    proof public."ProofType" DEFAULT 'aucune'::public."ProofType" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RecommendationConfirmation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RecommendationConfirmation" (
    "recommendationId" text NOT NULL,
    "memberId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RecruiterProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RecruiterProfile" (
    "userId" text NOT NULL,
    "companyName" text NOT NULL,
    phone text NOT NULL,
    province text NOT NULL,
    city text NOT NULL,
    tier public."AccountTier" DEFAULT 'gratuit'::public."AccountTier" NOT NULL,
    sector public."Sector" DEFAULT 'autre'::public."Sector" NOT NULL
);


--
-- Name: Report; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Report" (
    id text NOT NULL,
    "reporterId" text NOT NULL,
    "targetType" public."ReportTargetType" NOT NULL,
    "targetId" text NOT NULL,
    "targetUserId" text,
    reason text NOT NULL,
    status public."ReportStatus" DEFAULT 'open'::public."ReportStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SourcingLead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SourcingLead" (
    id text NOT NULL,
    "agentId" text NOT NULL,
    type public."SourcingLeadType" NOT NULL,
    source text NOT NULL,
    "sourceUrl" text,
    trade text NOT NULL,
    sector public."Sector" NOT NULL,
    province text NOT NULL,
    city text NOT NULL,
    description text NOT NULL,
    status public."LeadStatus" DEFAULT 'nouveau'::public."LeadStatus" NOT NULL,
    "talentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Subscription" (
    id text NOT NULL,
    "recruiterId" text NOT NULL,
    "planCode" text NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SubscriptionPlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SubscriptionPlan" (
    code text NOT NULL,
    name text NOT NULL,
    "priceAr" integer NOT NULL,
    "maxActiveOpportunities" integer,
    features text[]
);


--
-- Name: TalentAccountProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TalentAccountProfile" (
    "userId" text NOT NULL,
    "fullName" text NOT NULL,
    phone text NOT NULL,
    province text NOT NULL,
    city text NOT NULL,
    gender public."Gender" NOT NULL,
    "leadId" text,
    "talentId" text
);


--
-- Name: TalentLead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TalentLead" (
    id text NOT NULL,
    "fullName" text NOT NULL,
    phone text NOT NULL,
    province text NOT NULL,
    city text NOT NULL,
    gender public."Gender" NOT NULL,
    trade text NOT NULL,
    sector public."Sector" NOT NULL,
    message text,
    status public."LeadStatus" DEFAULT 'nouveau'::public."LeadStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TalentOpportunityProposal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TalentOpportunityProposal" (
    id text NOT NULL,
    "talentId" text NOT NULL,
    "opportunityId" text NOT NULL,
    "proposedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TalentProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TalentProfile" (
    id text NOT NULL,
    "agentId" text NOT NULL,
    "fullName" text NOT NULL,
    phone text NOT NULL,
    province text NOT NULL,
    city text NOT NULL,
    gender public."Gender" NOT NULL,
    skills text[],
    availability public."Availability" NOT NULL,
    status public."TalentStatus" DEFAULT 'en_attente'::public."TalentStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    trade text DEFAULT ''::text NOT NULL,
    sector public."Sector" DEFAULT 'autre'::public."Sector" NOT NULL
);


--
-- Name: TalentVerification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TalentVerification" (
    id text NOT NULL,
    "talentId" text NOT NULL,
    trade text NOT NULL,
    checklist jsonb NOT NULL,
    note text,
    "verifiedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Transaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Transaction" (
    id text NOT NULL,
    "recruiterId" text NOT NULL,
    type text NOT NULL,
    "amountAr" integer NOT NULL,
    description text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    role public."UserRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."UserStatus" DEFAULT 'active'::public."UserStatus" NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: AgentProfile AgentProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgentProfile"
    ADD CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("userId");


--
-- Name: AiInteraction AiInteraction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiInteraction"
    ADD CONSTRAINT "AiInteraction_pkey" PRIMARY KEY (id);


--
-- Name: Application Application_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Application"
    ADD CONSTRAINT "Application_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: Bookmark Bookmark_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bookmark"
    ADD CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("candidateId", "opportunityId");


--
-- Name: CandidateProfile CandidateProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CandidateProfile"
    ADD CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("userId");


--
-- Name: Conversation Conversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conversation"
    ADD CONSTRAINT "Conversation_pkey" PRIMARY KEY (id);


--
-- Name: EmailVerification EmailVerification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailVerification"
    ADD CONSTRAINT "EmailVerification_pkey" PRIMARY KEY (id);


--
-- Name: IndividualProfile IndividualProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IndividualProfile"
    ADD CONSTRAINT "IndividualProfile_pkey" PRIMARY KEY ("userId");


--
-- Name: MatchSuggestion MatchSuggestion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MatchSuggestion"
    ADD CONSTRAINT "MatchSuggestion_pkey" PRIMARY KEY (id);


--
-- Name: Member Member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Member"
    ADD CONSTRAINT "Member_pkey" PRIMARY KEY (id);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: ModerationAction ModerationAction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ModerationAction"
    ADD CONSTRAINT "ModerationAction_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Opportunity Opportunity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Opportunity"
    ADD CONSTRAINT "Opportunity_pkey" PRIMARY KEY (id);


--
-- Name: Placement Placement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Placement"
    ADD CONSTRAINT "Placement_pkey" PRIMARY KEY (id);


--
-- Name: Provider Provider_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Provider"
    ADD CONSTRAINT "Provider_pkey" PRIMARY KEY (id);


--
-- Name: RecommendationConfirmation RecommendationConfirmation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecommendationConfirmation"
    ADD CONSTRAINT "RecommendationConfirmation_pkey" PRIMARY KEY ("recommendationId", "memberId");


--
-- Name: Recommendation Recommendation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Recommendation"
    ADD CONSTRAINT "Recommendation_pkey" PRIMARY KEY (id);


--
-- Name: RecruiterProfile RecruiterProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecruiterProfile"
    ADD CONSTRAINT "RecruiterProfile_pkey" PRIMARY KEY ("userId");


--
-- Name: Report Report_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_pkey" PRIMARY KEY (id);


--
-- Name: SourcingLead SourcingLead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SourcingLead"
    ADD CONSTRAINT "SourcingLead_pkey" PRIMARY KEY (id);


--
-- Name: SubscriptionPlan SubscriptionPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubscriptionPlan"
    ADD CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY (code);


--
-- Name: Subscription Subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY (id);


--
-- Name: TalentAccountProfile TalentAccountProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TalentAccountProfile"
    ADD CONSTRAINT "TalentAccountProfile_pkey" PRIMARY KEY ("userId");


--
-- Name: TalentLead TalentLead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TalentLead"
    ADD CONSTRAINT "TalentLead_pkey" PRIMARY KEY (id);


--
-- Name: TalentOpportunityProposal TalentOpportunityProposal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TalentOpportunityProposal"
    ADD CONSTRAINT "TalentOpportunityProposal_pkey" PRIMARY KEY (id);


--
-- Name: TalentProfile TalentProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TalentProfile"
    ADD CONSTRAINT "TalentProfile_pkey" PRIMARY KEY (id);


--
-- Name: TalentVerification TalentVerification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TalentVerification"
    ADD CONSTRAINT "TalentVerification_pkey" PRIMARY KEY (id);


--
-- Name: Transaction Transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Application_opportunityId_candidateId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Application_opportunityId_candidateId_key" ON public."Application" USING btree ("opportunityId", "candidateId");


--
-- Name: AuditLog_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_userId_idx" ON public."AuditLog" USING btree ("userId");


--
-- Name: Conversation_participantAId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Conversation_participantAId_idx" ON public."Conversation" USING btree ("participantAId");


--
-- Name: Conversation_participantAId_participantBId_opportunityId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Conversation_participantAId_participantBId_opportunityId_key" ON public."Conversation" USING btree ("participantAId", "participantBId", "opportunityId");


--
-- Name: Conversation_participantBId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Conversation_participantBId_idx" ON public."Conversation" USING btree ("participantBId");


--
-- Name: EmailVerification_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailVerification_email_idx" ON public."EmailVerification" USING btree (email);


--
-- Name: EmailVerification_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EmailVerification_token_key" ON public."EmailVerification" USING btree (token);


--
-- Name: MatchSuggestion_candidateId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MatchSuggestion_candidateId_idx" ON public."MatchSuggestion" USING btree ("candidateId");


--
-- Name: MatchSuggestion_opportunityId_candidateId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MatchSuggestion_opportunityId_candidateId_key" ON public."MatchSuggestion" USING btree ("opportunityId", "candidateId");


--
-- Name: MatchSuggestion_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MatchSuggestion_status_idx" ON public."MatchSuggestion" USING btree (status);


--
-- Name: Member_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Member_userId_key" ON public."Member" USING btree ("userId");


--
-- Name: Message_conversationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_conversationId_idx" ON public."Message" USING btree ("conversationId");


--
-- Name: ModerationAction_reportId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ModerationAction_reportId_key" ON public."ModerationAction" USING btree ("reportId");


--
-- Name: Notification_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_idx" ON public."Notification" USING btree ("userId");


--
-- Name: Opportunity_opportunityType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Opportunity_opportunityType_idx" ON public."Opportunity" USING btree ("opportunityType");


--
-- Name: Opportunity_province_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Opportunity_province_idx" ON public."Opportunity" USING btree (province);


--
-- Name: Placement_recruiterId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Placement_recruiterId_idx" ON public."Placement" USING btree ("recruiterId");


--
-- Name: Provider_district_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Provider_district_idx" ON public."Provider" USING btree (district);


--
-- Name: Provider_trade_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Provider_trade_idx" ON public."Provider" USING btree (trade);


--
-- Name: Recommendation_providerId_authorMemberId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Recommendation_providerId_authorMemberId_key" ON public."Recommendation" USING btree ("providerId", "authorMemberId");


--
-- Name: Recommendation_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Recommendation_providerId_idx" ON public."Recommendation" USING btree ("providerId");


--
-- Name: Report_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Report_status_idx" ON public."Report" USING btree (status);


--
-- Name: SourcingLead_agentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SourcingLead_agentId_idx" ON public."SourcingLead" USING btree ("agentId");


--
-- Name: SourcingLead_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SourcingLead_status_idx" ON public."SourcingLead" USING btree (status);


--
-- Name: Subscription_recruiterId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Subscription_recruiterId_key" ON public."Subscription" USING btree ("recruiterId");


--
-- Name: TalentAccountProfile_leadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TalentAccountProfile_leadId_key" ON public."TalentAccountProfile" USING btree ("leadId");


--
-- Name: TalentAccountProfile_talentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TalentAccountProfile_talentId_key" ON public."TalentAccountProfile" USING btree ("talentId");


--
-- Name: TalentLead_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TalentLead_status_idx" ON public."TalentLead" USING btree (status);


--
-- Name: TalentOpportunityProposal_opportunityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TalentOpportunityProposal_opportunityId_idx" ON public."TalentOpportunityProposal" USING btree ("opportunityId");


--
-- Name: TalentOpportunityProposal_talentId_opportunityId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TalentOpportunityProposal_talentId_opportunityId_key" ON public."TalentOpportunityProposal" USING btree ("talentId", "opportunityId");


--
-- Name: TalentProfile_agentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TalentProfile_agentId_idx" ON public."TalentProfile" USING btree ("agentId");


--
-- Name: TalentVerification_talentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TalentVerification_talentId_idx" ON public."TalentVerification" USING btree ("talentId");


--
-- Name: Transaction_recruiterId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Transaction_recruiterId_idx" ON public."Transaction" USING btree ("recruiterId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: AgentProfile AgentProfile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgentProfile"
    ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Application Application_candidateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Application"
    ADD CONSTRAINT "Application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Application Application_opportunityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Application"
    ADD CONSTRAINT "Application_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES public."Opportunity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Bookmark Bookmark_candidateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bookmark"
    ADD CONSTRAINT "Bookmark_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Bookmark Bookmark_opportunityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bookmark"
    ADD CONSTRAINT "Bookmark_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES public."Opportunity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CandidateProfile CandidateProfile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CandidateProfile"
    ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Conversation Conversation_participantAId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conversation"
    ADD CONSTRAINT "Conversation_participantAId_fkey" FOREIGN KEY ("participantAId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Conversation Conversation_participantBId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conversation"
    ADD CONSTRAINT "Conversation_participantBId_fkey" FOREIGN KEY ("participantBId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IndividualProfile IndividualProfile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IndividualProfile"
    ADD CONSTRAINT "IndividualProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MatchSuggestion MatchSuggestion_candidateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MatchSuggestion"
    ADD CONSTRAINT "MatchSuggestion_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MatchSuggestion MatchSuggestion_opportunityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MatchSuggestion"
    ADD CONSTRAINT "MatchSuggestion_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES public."Opportunity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Member Member_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Member"
    ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Message Message_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public."Conversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Message Message_senderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ModerationAction ModerationAction_adminId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ModerationAction"
    ADD CONSTRAINT "ModerationAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ModerationAction ModerationAction_reportId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ModerationAction"
    ADD CONSTRAINT "ModerationAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES public."Report"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ModerationAction ModerationAction_targetUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ModerationAction"
    ADD CONSTRAINT "ModerationAction_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Opportunity Opportunity_recruiterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Opportunity"
    ADD CONSTRAINT "Opportunity_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Placement Placement_candidateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Placement"
    ADD CONSTRAINT "Placement_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Placement Placement_opportunityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Placement"
    ADD CONSTRAINT "Placement_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES public."Opportunity"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Placement Placement_recruiterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Placement"
    ADD CONSTRAINT "Placement_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Placement Placement_talentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Placement"
    ADD CONSTRAINT "Placement_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES public."TalentProfile"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Provider Provider_addedByMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Provider"
    ADD CONSTRAINT "Provider_addedByMemberId_fkey" FOREIGN KEY ("addedByMemberId") REFERENCES public."Member"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Provider Provider_claimedByMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Provider"
    ADD CONSTRAINT "Provider_claimedByMemberId_fkey" FOREIGN KEY ("claimedByMemberId") REFERENCES public."Member"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RecommendationConfirmation RecommendationConfirmation_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecommendationConfirmation"
    ADD CONSTRAINT "RecommendationConfirmation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public."Member"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RecommendationConfirmation RecommendationConfirmation_recommendationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecommendationConfirmation"
    ADD CONSTRAINT "RecommendationConfirmation_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES public."Recommendation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Recommendation Recommendation_authorMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Recommendation"
    ADD CONSTRAINT "Recommendation_authorMemberId_fkey" FOREIGN KEY ("authorMemberId") REFERENCES public."Member"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Recommendation Recommendation_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Recommendation"
    ADD CONSTRAINT "Recommendation_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public."Provider"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RecruiterProfile RecruiterProfile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecruiterProfile"
    ADD CONSTRAINT "RecruiterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Report Report_reporterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Report Report_targetUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SourcingLead SourcingLead_agentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SourcingLead"
    ADD CONSTRAINT "SourcingLead_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SourcingLead SourcingLead_talentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SourcingLead"
    ADD CONSTRAINT "SourcingLead_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES public."TalentProfile"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Subscription Subscription_planCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_planCode_fkey" FOREIGN KEY ("planCode") REFERENCES public."SubscriptionPlan"(code) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Subscription Subscription_recruiterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TalentAccountProfile TalentAccountProfile_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TalentAccountProfile"
    ADD CONSTRAINT "TalentAccountProfile_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public."TalentLead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TalentAccountProfile TalentAccountProfile_talentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TalentAccountProfile"
    ADD CONSTRAINT "TalentAccountProfile_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES public."TalentProfile"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TalentAccountProfile TalentAccountProfile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TalentAccountProfile"
    ADD CONSTRAINT "TalentAccountProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TalentOpportunityProposal TalentOpportunityProposal_opportunityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TalentOpportunityProposal"
    ADD CONSTRAINT "TalentOpportunityProposal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES public."Opportunity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TalentOpportunityProposal TalentOpportunityProposal_talentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TalentOpportunityProposal"
    ADD CONSTRAINT "TalentOpportunityProposal_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES public."TalentProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TalentProfile TalentProfile_agentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TalentProfile"
    ADD CONSTRAINT "TalentProfile_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TalentVerification TalentVerification_talentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TalentVerification"
    ADD CONSTRAINT "TalentVerification_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES public."TalentProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Transaction Transaction_recruiterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict mKuUcIf9wG2FcrviL5gFdh5dM4f4nSEn5Riex6jk8HfVWuoqifU5hxyOZ2e2Hz4

