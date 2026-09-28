--
-- PostgreSQL database dump
--

\restrict wVSW5rupzOyu24g8hiqSE6oZeRz1HKocrZZeh48HLZStiUVD2YRNUPflIkVB6Za

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

ALTER TABLE IF EXISTS ONLY public."Transaction" DROP CONSTRAINT IF EXISTS "Transaction_recruiterId_fkey";
ALTER TABLE IF EXISTS ONLY public."TalentVerification" DROP CONSTRAINT IF EXISTS "TalentVerification_talentId_fkey";
ALTER TABLE IF EXISTS ONLY public."TalentProfile" DROP CONSTRAINT IF EXISTS "TalentProfile_agentId_fkey";
ALTER TABLE IF EXISTS ONLY public."TalentOpportunityProposal" DROP CONSTRAINT IF EXISTS "TalentOpportunityProposal_talentId_fkey";
ALTER TABLE IF EXISTS ONLY public."TalentOpportunityProposal" DROP CONSTRAINT IF EXISTS "TalentOpportunityProposal_opportunityId_fkey";
ALTER TABLE IF EXISTS ONLY public."TalentAccountProfile" DROP CONSTRAINT IF EXISTS "TalentAccountProfile_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."TalentAccountProfile" DROP CONSTRAINT IF EXISTS "TalentAccountProfile_talentId_fkey";
ALTER TABLE IF EXISTS ONLY public."TalentAccountProfile" DROP CONSTRAINT IF EXISTS "TalentAccountProfile_leadId_fkey";
ALTER TABLE IF EXISTS ONLY public."Subscription" DROP CONSTRAINT IF EXISTS "Subscription_recruiterId_fkey";
ALTER TABLE IF EXISTS ONLY public."Subscription" DROP CONSTRAINT IF EXISTS "Subscription_planCode_fkey";
ALTER TABLE IF EXISTS ONLY public."SourcingLead" DROP CONSTRAINT IF EXISTS "SourcingLead_talentId_fkey";
ALTER TABLE IF EXISTS ONLY public."SourcingLead" DROP CONSTRAINT IF EXISTS "SourcingLead_agentId_fkey";
ALTER TABLE IF EXISTS ONLY public."Report" DROP CONSTRAINT IF EXISTS "Report_targetUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."Report" DROP CONSTRAINT IF EXISTS "Report_reporterId_fkey";
ALTER TABLE IF EXISTS ONLY public."RecruiterProfile" DROP CONSTRAINT IF EXISTS "RecruiterProfile_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Recommendation" DROP CONSTRAINT IF EXISTS "Recommendation_providerId_fkey";
ALTER TABLE IF EXISTS ONLY public."Recommendation" DROP CONSTRAINT IF EXISTS "Recommendation_authorMemberId_fkey";
ALTER TABLE IF EXISTS ONLY public."RecommendationConfirmation" DROP CONSTRAINT IF EXISTS "RecommendationConfirmation_recommendationId_fkey";
ALTER TABLE IF EXISTS ONLY public."RecommendationConfirmation" DROP CONSTRAINT IF EXISTS "RecommendationConfirmation_memberId_fkey";
ALTER TABLE IF EXISTS ONLY public."Provider" DROP CONSTRAINT IF EXISTS "Provider_claimedByMemberId_fkey";
ALTER TABLE IF EXISTS ONLY public."Provider" DROP CONSTRAINT IF EXISTS "Provider_addedByMemberId_fkey";
ALTER TABLE IF EXISTS ONLY public."Placement" DROP CONSTRAINT IF EXISTS "Placement_talentId_fkey";
ALTER TABLE IF EXISTS ONLY public."Placement" DROP CONSTRAINT IF EXISTS "Placement_recruiterId_fkey";
ALTER TABLE IF EXISTS ONLY public."Placement" DROP CONSTRAINT IF EXISTS "Placement_opportunityId_fkey";
ALTER TABLE IF EXISTS ONLY public."Placement" DROP CONSTRAINT IF EXISTS "Placement_candidateId_fkey";
ALTER TABLE IF EXISTS ONLY public."Opportunity" DROP CONSTRAINT IF EXISTS "Opportunity_recruiterId_fkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."ModerationAction" DROP CONSTRAINT IF EXISTS "ModerationAction_targetUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."ModerationAction" DROP CONSTRAINT IF EXISTS "ModerationAction_reportId_fkey";
ALTER TABLE IF EXISTS ONLY public."ModerationAction" DROP CONSTRAINT IF EXISTS "ModerationAction_adminId_fkey";
ALTER TABLE IF EXISTS ONLY public."Message" DROP CONSTRAINT IF EXISTS "Message_senderId_fkey";
ALTER TABLE IF EXISTS ONLY public."Message" DROP CONSTRAINT IF EXISTS "Message_conversationId_fkey";
ALTER TABLE IF EXISTS ONLY public."Member" DROP CONSTRAINT IF EXISTS "Member_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."MatchSuggestion" DROP CONSTRAINT IF EXISTS "MatchSuggestion_opportunityId_fkey";
ALTER TABLE IF EXISTS ONLY public."MatchSuggestion" DROP CONSTRAINT IF EXISTS "MatchSuggestion_candidateId_fkey";
ALTER TABLE IF EXISTS ONLY public."IndividualProfile" DROP CONSTRAINT IF EXISTS "IndividualProfile_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Conversation" DROP CONSTRAINT IF EXISTS "Conversation_participantBId_fkey";
ALTER TABLE IF EXISTS ONLY public."Conversation" DROP CONSTRAINT IF EXISTS "Conversation_participantAId_fkey";
ALTER TABLE IF EXISTS ONLY public."CandidateProfile" DROP CONSTRAINT IF EXISTS "CandidateProfile_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Bookmark" DROP CONSTRAINT IF EXISTS "Bookmark_opportunityId_fkey";
ALTER TABLE IF EXISTS ONLY public."Bookmark" DROP CONSTRAINT IF EXISTS "Bookmark_candidateId_fkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Application" DROP CONSTRAINT IF EXISTS "Application_opportunityId_fkey";
ALTER TABLE IF EXISTS ONLY public."Application" DROP CONSTRAINT IF EXISTS "Application_candidateId_fkey";
ALTER TABLE IF EXISTS ONLY public."AgentProfile" DROP CONSTRAINT IF EXISTS "AgentProfile_userId_fkey";
DROP INDEX IF EXISTS public."User_email_key";
DROP INDEX IF EXISTS public."Transaction_recruiterId_idx";
DROP INDEX IF EXISTS public."TalentVerification_talentId_idx";
DROP INDEX IF EXISTS public."TalentProfile_agentId_idx";
DROP INDEX IF EXISTS public."TalentOpportunityProposal_talentId_opportunityId_key";
DROP INDEX IF EXISTS public."TalentOpportunityProposal_opportunityId_idx";
DROP INDEX IF EXISTS public."TalentLead_status_idx";
DROP INDEX IF EXISTS public."TalentAccountProfile_talentId_key";
DROP INDEX IF EXISTS public."TalentAccountProfile_leadId_key";
DROP INDEX IF EXISTS public."Subscription_recruiterId_key";
DROP INDEX IF EXISTS public."SourcingLead_status_idx";
DROP INDEX IF EXISTS public."SourcingLead_agentId_idx";
DROP INDEX IF EXISTS public."Report_status_idx";
DROP INDEX IF EXISTS public."Recommendation_providerId_idx";
DROP INDEX IF EXISTS public."Recommendation_providerId_authorMemberId_key";
DROP INDEX IF EXISTS public."Provider_trade_idx";
DROP INDEX IF EXISTS public."Provider_district_idx";
DROP INDEX IF EXISTS public."Placement_recruiterId_idx";
DROP INDEX IF EXISTS public."Opportunity_province_idx";
DROP INDEX IF EXISTS public."Opportunity_opportunityType_idx";
DROP INDEX IF EXISTS public."Notification_userId_idx";
DROP INDEX IF EXISTS public."ModerationAction_reportId_key";
DROP INDEX IF EXISTS public."Message_conversationId_idx";
DROP INDEX IF EXISTS public."Member_userId_key";
DROP INDEX IF EXISTS public."MatchSuggestion_status_idx";
DROP INDEX IF EXISTS public."MatchSuggestion_opportunityId_candidateId_key";
DROP INDEX IF EXISTS public."MatchSuggestion_candidateId_idx";
DROP INDEX IF EXISTS public."EmailVerification_token_key";
DROP INDEX IF EXISTS public."EmailVerification_email_idx";
DROP INDEX IF EXISTS public."Conversation_participantBId_idx";
DROP INDEX IF EXISTS public."Conversation_participantAId_participantBId_opportunityId_key";
DROP INDEX IF EXISTS public."Conversation_participantAId_idx";
DROP INDEX IF EXISTS public."AuditLog_userId_idx";
DROP INDEX IF EXISTS public."Application_opportunityId_candidateId_key";
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE IF EXISTS ONLY public."Transaction" DROP CONSTRAINT IF EXISTS "Transaction_pkey";
ALTER TABLE IF EXISTS ONLY public."TalentVerification" DROP CONSTRAINT IF EXISTS "TalentVerification_pkey";
ALTER TABLE IF EXISTS ONLY public."TalentProfile" DROP CONSTRAINT IF EXISTS "TalentProfile_pkey";
ALTER TABLE IF EXISTS ONLY public."TalentOpportunityProposal" DROP CONSTRAINT IF EXISTS "TalentOpportunityProposal_pkey";
ALTER TABLE IF EXISTS ONLY public."TalentLead" DROP CONSTRAINT IF EXISTS "TalentLead_pkey";
ALTER TABLE IF EXISTS ONLY public."TalentAccountProfile" DROP CONSTRAINT IF EXISTS "TalentAccountProfile_pkey";
ALTER TABLE IF EXISTS ONLY public."Subscription" DROP CONSTRAINT IF EXISTS "Subscription_pkey";
ALTER TABLE IF EXISTS ONLY public."SubscriptionPlan" DROP CONSTRAINT IF EXISTS "SubscriptionPlan_pkey";
ALTER TABLE IF EXISTS ONLY public."SourcingLead" DROP CONSTRAINT IF EXISTS "SourcingLead_pkey";
ALTER TABLE IF EXISTS ONLY public."Report" DROP CONSTRAINT IF EXISTS "Report_pkey";
ALTER TABLE IF EXISTS ONLY public."RecruiterProfile" DROP CONSTRAINT IF EXISTS "RecruiterProfile_pkey";
ALTER TABLE IF EXISTS ONLY public."Recommendation" DROP CONSTRAINT IF EXISTS "Recommendation_pkey";
ALTER TABLE IF EXISTS ONLY public."RecommendationConfirmation" DROP CONSTRAINT IF EXISTS "RecommendationConfirmation_pkey";
ALTER TABLE IF EXISTS ONLY public."Provider" DROP CONSTRAINT IF EXISTS "Provider_pkey";
ALTER TABLE IF EXISTS ONLY public."Placement" DROP CONSTRAINT IF EXISTS "Placement_pkey";
ALTER TABLE IF EXISTS ONLY public."Opportunity" DROP CONSTRAINT IF EXISTS "Opportunity_pkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_pkey";
ALTER TABLE IF EXISTS ONLY public."ModerationAction" DROP CONSTRAINT IF EXISTS "ModerationAction_pkey";
ALTER TABLE IF EXISTS ONLY public."Message" DROP CONSTRAINT IF EXISTS "Message_pkey";
ALTER TABLE IF EXISTS ONLY public."Member" DROP CONSTRAINT IF EXISTS "Member_pkey";
ALTER TABLE IF EXISTS ONLY public."MatchSuggestion" DROP CONSTRAINT IF EXISTS "MatchSuggestion_pkey";
ALTER TABLE IF EXISTS ONLY public."IndividualProfile" DROP CONSTRAINT IF EXISTS "IndividualProfile_pkey";
ALTER TABLE IF EXISTS ONLY public."EmailVerification" DROP CONSTRAINT IF EXISTS "EmailVerification_pkey";
ALTER TABLE IF EXISTS ONLY public."Conversation" DROP CONSTRAINT IF EXISTS "Conversation_pkey";
ALTER TABLE IF EXISTS ONLY public."CandidateProfile" DROP CONSTRAINT IF EXISTS "CandidateProfile_pkey";
ALTER TABLE IF EXISTS ONLY public."Bookmark" DROP CONSTRAINT IF EXISTS "Bookmark_pkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_pkey";
ALTER TABLE IF EXISTS ONLY public."Application" DROP CONSTRAINT IF EXISTS "Application_pkey";
ALTER TABLE IF EXISTS ONLY public."AiInteraction" DROP CONSTRAINT IF EXISTS "AiInteraction_pkey";
ALTER TABLE IF EXISTS ONLY public."AgentProfile" DROP CONSTRAINT IF EXISTS "AgentProfile_pkey";
DROP TABLE IF EXISTS public._prisma_migrations;
DROP TABLE IF EXISTS public."User";
DROP TABLE IF EXISTS public."Transaction";
DROP TABLE IF EXISTS public."TalentVerification";
DROP TABLE IF EXISTS public."TalentProfile";
DROP TABLE IF EXISTS public."TalentOpportunityProposal";
DROP TABLE IF EXISTS public."TalentLead";
DROP TABLE IF EXISTS public."TalentAccountProfile";
DROP TABLE IF EXISTS public."SubscriptionPlan";
DROP TABLE IF EXISTS public."Subscription";
DROP TABLE IF EXISTS public."SourcingLead";
DROP TABLE IF EXISTS public."Report";
DROP TABLE IF EXISTS public."RecruiterProfile";
DROP TABLE IF EXISTS public."RecommendationConfirmation";
DROP TABLE IF EXISTS public."Recommendation";
DROP TABLE IF EXISTS public."Provider";
DROP TABLE IF EXISTS public."Placement";
DROP TABLE IF EXISTS public."Opportunity";
DROP TABLE IF EXISTS public."Notification";
DROP TABLE IF EXISTS public."ModerationAction";
DROP TABLE IF EXISTS public."Message";
DROP TABLE IF EXISTS public."Member";
DROP TABLE IF EXISTS public."MatchSuggestion";
DROP TABLE IF EXISTS public."IndividualProfile";
DROP TABLE IF EXISTS public."EmailVerification";
DROP TABLE IF EXISTS public."Conversation";
DROP TABLE IF EXISTS public."CandidateProfile";
DROP TABLE IF EXISTS public."Bookmark";
DROP TABLE IF EXISTS public."AuditLog";
DROP TABLE IF EXISTS public."Application";
DROP TABLE IF EXISTS public."AiInteraction";
DROP TABLE IF EXISTS public."AgentProfile";
DROP TYPE IF EXISTS public."UserStatus";
DROP TYPE IF EXISTS public."UserRole";
DROP TYPE IF EXISTS public."TalentStatus";
DROP TYPE IF EXISTS public."SourcingLeadType";
DROP TYPE IF EXISTS public."Sector";
DROP TYPE IF EXISTS public."ReportTargetType";
DROP TYPE IF EXISTS public."ReportStatus";
DROP TYPE IF EXISTS public."ProofType";
DROP TYPE IF EXISTS public."PlacementStage";
DROP TYPE IF EXISTS public."OpportunityType";
DROP TYPE IF EXISTS public."ModerationActionType";
DROP TYPE IF EXISTS public."MatchSuggestionStatus";
DROP TYPE IF EXISTS public."LeadStatus";
DROP TYPE IF EXISTS public."Gender";
DROP TYPE IF EXISTS public."ExperienceLevel";
DROP TYPE IF EXISTS public."EducationLevel";
DROP TYPE IF EXISTS public."Availability";
DROP TYPE IF EXISTS public."ApplicationStatus";
DROP TYPE IF EXISTS public."AccountTier";
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
-- Data for Name: AgentProfile; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AgentProfile" ("userId", "fullName", phone, province, city) FROM stdin;
f4794845-1c80-4f95-8537-ca2e78c92798	Voninkazo Rasolofoson	+261 34 20 111 22	Antananarivo	Antananarivo
29ddf83e-3a02-4c66-9a94-faedac96be57	Tovonirina Andriamampianina	+261 33 21 333 44	Antananarivo	Antananarivo
\.


--
-- Data for Name: AiInteraction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AiInteraction" (id, "userId", feature, "promptSummary", flagged, "createdAt") FROM stdin;
\.


--
-- Data for Name: Application; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Application" (id, "opportunityId", "candidateId", message, "createdAt", status) FROM stdin;
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AuditLog" (id, "userId", action, metadata, "createdAt") FROM stdin;
\.


--
-- Data for Name: Bookmark; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Bookmark" ("candidateId", "opportunityId", "createdAt") FROM stdin;
\.


--
-- Data for Name: CandidateProfile; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CandidateProfile" ("userId", "fullName", phone, province, city, "educationLevel", skills, "experienceLevel", "desiredOpportunityTypes", availability, "cvSkillsSuggested", "cvUrl", gender, sector) FROM stdin;
d2d55685-4998-48d3-93cc-2e3b44528a08	Miora Rakoto	+261 34 12 345 67	Antananarivo	Antananarivo	licence	{Excel,Communication,"Réseaux sociaux",Canva,Français}	junior	{emploi,stage,mission}	immediate	{}	\N	femme	\N
633effba-66ad-44a8-af6f-ba33e085405f	Faniry Andrianarivo	+261 33 45 678 12	Antananarivo	Antananarivo	master	{JavaScript,React,Git,Python,SQL}	intermediaire	{emploi,freelance}	flexible	{}	\N	homme	\N
ef308614-dcef-4ad6-b2a6-860f9fb9d32f	Tahiana Razafy	+261 32 56 789 23	Toamasina	Toamasina	bac	{Excel,"Vente terrain",Malagasy,Français}	debutant	{emploi,stage}	m1	{}	\N	femme	\N
288ebec0-a036-4496-8a99-493d82a412b2	Nomena Faralahy	+261 34 67 890 34	Fianarantsoa	Fianarantsoa	technique	{Photoshop,Canva,Rédaction}	junior	{freelance,mission}	flexible	{}	\N	homme	\N
44da9eb6-82d6-4def-858c-0d49d5ddafef	Sitraka Ravonjiarison	+261 33 78 901 45	Mahajanga	Mahajanga	autodidacte	{Livraison,Communication,"Service client"}	debutant	{emploi}	immediate	{}	\N	femme	\N
\.


--
-- Data for Name: Conversation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Conversation" (id, "participantAId", "participantBId", "opportunityId", "createdAt") FROM stdin;
f5dbe6be-83b3-47c2-9da1-38d489858196	37e08a9d-3c1e-406e-b11f-64a15a95977c	3f9a8f81-938e-4362-b4dd-6aad3ec12818	\N	2026-09-28 08:47:03.901
\.


--
-- Data for Name: EmailVerification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."EmailVerification" (id, email, "codeHash", attempts, "expiresAt", "verifiedAt", token, "createdAt") FROM stdin;
\.


--
-- Data for Name: IndividualProfile; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."IndividualProfile" ("userId", "fullName", phone, province, city) FROM stdin;
c89aab6d-6651-4d44-b5fc-d4c471f15ba0	Njaka Randriamampionona	+261 34 99 111 22	Antananarivo	Antananarivo
59a26894-8d93-445c-be7b-0b1c23af8fbd	Hery R.	+261 34 00 000 00	Antananarivo	Antananarivo
103565d3-10ca-472c-8c50-aea522f2dfde	Fanja N.	+261 34 00 000 00	Antananarivo	Antananarivo
acccf0ab-e519-4f0c-b95c-9028a75f10b4	Tojo A.	+261 34 00 000 00	Antananarivo	Antananarivo
61b4e8fe-1606-4897-844f-bf690ebd7368	Voahangy M.	+261 34 00 000 00	Antananarivo	Antananarivo
a60a608b-9a86-481a-8212-336274c7452a	Rija S.	+261 34 00 000 00	Antananarivo	Antananarivo
3f0a267a-10f4-4611-8e5d-68a44b92ed28	Lalaina P.	+261 34 00 000 00	Antananarivo	Antananarivo
a3f9e31f-2f28-45bd-a8ff-b840cff540d0	Naly R.	+261 34 00 000 00	Antananarivo	Antananarivo
d3997c01-3853-4a90-8264-360f2087c474	Mamy T.	+261 34 00 000 00	Antananarivo	Antananarivo
\.


--
-- Data for Name: MatchSuggestion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."MatchSuggestion" (id, "opportunityId", "candidateId", score, reasons, status, "createdAt", "updatedAt") FROM stdin;
76012977-f3bf-45fc-a4ff-868e3d900ac2	d713b0a4-0b2c-4eed-8ed5-5ba72d7e2bdb	d2d55685-4998-48d3-93cc-2e3b44528a08	92	{"Compétences réseaux sociaux/Canva alignées","Basée à Antananarivo, disponible immédiatement"}	mise_en_relation	2026-09-28 08:47:03.715	2026-09-28 08:47:03.715
af1eb1b5-8d92-4e41-b49c-f13215cbbd73	84790bba-3924-464f-bead-018ecde52cdd	633effba-66ad-44a8-af6f-ba33e085405f	88	{"Trois ans d’expérience React","Disponibilité immédiate"}	interet_candidat	2026-09-28 08:47:03.727	2026-09-28 08:47:03.727
b961368b-15a6-4b65-a4ee-e32e11f52682	c81aeb42-661f-49f5-92b1-84ee4db9c711	ef308614-dcef-4ad6-b2a6-860f9fb9d32f	74	{"Expérience vente terrain à Toamasina","Mobile sur la région de Mahajanga"}	proposee_candidat	2026-09-28 08:47:03.732	2026-09-28 08:47:03.732
\.


--
-- Data for Name: Member; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Member" (id, "userId", "displayName", district, city, "phoneVerified", "joinedAt") FROM stdin;
504da96b-dc6d-4a20-96ad-05c0b7f0001d	59a26894-8d93-445c-be7b-0b1c23af8fbd	Hery R.	Alasora	Antananarivo	t	2024-09-02 00:00:00
cf33cf61-f0f8-4fd1-a0e7-893a749506a4	103565d3-10ca-472c-8c50-aea522f2dfde	Fanja N.	Ambohimangakely	Antananarivo	t	2025-01-18 00:00:00
4017447c-eeb6-4f26-8614-7295d853cac3	acccf0ab-e519-4f0c-b95c-9028a75f10b4	Tojo A.	Tanjombato	Antananarivo	t	2025-03-24 00:00:00
00fcb469-30cc-412e-b0e9-9d4636c409b0	61b4e8fe-1606-4897-844f-bf690ebd7368	Voahangy M.	Analamahitsy	Antananarivo	f	2025-06-11 00:00:00
caf85938-90db-4b1f-982e-393e8edd3474	a60a608b-9a86-481a-8212-336274c7452a	Rija S.	Itaosy	Antananarivo	t	2024-11-05 00:00:00
74e32d51-0467-4e5a-a6da-a1ac325c3fd9	3f0a267a-10f4-4611-8e5d-68a44b92ed28	Lalaina P.	Ankadikely Ilafy	Antananarivo	f	2026-04-02 00:00:00
c77147c1-69e5-42ec-b1ff-36b0f64f512e	a3f9e31f-2f28-45bd-a8ff-b840cff540d0	Naly R.	Alasora	Antananarivo	t	2025-08-19 00:00:00
b410b76c-29f7-4e36-a084-9326405398d6	d3997c01-3853-4a90-8264-360f2087c474	Mamy T.	Andraharo	Antananarivo	t	2025-10-30 00:00:00
\.


--
-- Data for Name: Message; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Message" (id, "conversationId", "senderId", content, "readAt", "createdAt") FROM stdin;
7f6032a0-c608-4c44-8a63-c51fbd420207	f5dbe6be-83b3-47c2-9da1-38d489858196	3f9a8f81-938e-4362-b4dd-6aad3ec12818	Bonjour, où en est le profil que vous nous avez proposé pour l’offre d’assistant·e marketing digital ?	\N	2026-09-28 08:47:03.905
cc37a848-93be-4bc0-8f32-5759fb2b6366	f5dbe6be-83b3-47c2-9da1-38d489858196	37e08a9d-3c1e-406e-b11f-64a15a95977c	Bonjour, la candidate a confirmé son intérêt de son côté — nous finalisons la mise en relation d’ici peu.	\N	2026-09-28 08:47:03.908
\.


--
-- Data for Name: ModerationAction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ModerationAction" (id, "reportId", "adminId", "targetUserId", action, note, "createdAt") FROM stdin;
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, "userId", title, message, read, "createdAt", link) FROM stdin;
\.


--
-- Data for Name: Opportunity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Opportunity" (id, "recruiterId", "companyName", title, category, description, province, city, "opportunityType", "requiredSkills", level, deadline, featured, "createdAt", sector, "sectorDetails") FROM stdin;
d713b0a4-0b2c-4eed-8ed5-5ba72d7e2bdb	3f9a8f81-938e-4362-b4dd-6aad3ec12818	TechMada Solutions	Assistant·e marketing digital	Marketing	Rejoignez une équipe agile à Antananarivo. Vous participerez à la création de contenus, à la gestion des réseaux sociaux et au suivi des campagnes locales. Idéal pour un·e jeune diplômé·e motivé·e.	Antananarivo	Antananarivo	emploi	{"Réseaux sociaux",Canva,Communication,Français}	junior	2026-06-30 00:00:00	t	2026-09-28 08:47:03.67	digital	\N
84790bba-3924-464f-bead-018ecde52cdd	3f9a8f81-938e-4362-b4dd-6aad3ec12818	TechMada Solutions	Développeur·se React junior	IT / Digital	Construisez des interfaces web modernes pour des clients malgaches. Stack : React, TypeScript, API REST. Mentorat assuré.	Antananarivo	Antananarivo	emploi	{JavaScript,React,Git,Français}	junior	2026-07-15 00:00:00	t	2026-09-28 08:47:03.675	digital	\N
6c1c88ba-b7b5-4d77-9602-ab766ef9e888	e7cae0a4-37c4-4063-861e-c536fca65d97	Port Logistique Toamasina	Stagiaire administration logistique	Logistique	Stage de 3 mois au port. Soutien à la coordination des flux, saisie de données et relation fournisseurs.	Toamasina	Toamasina	stage	{Excel,Communication,Français}	debutant	2026-05-20 00:00:00	t	2026-09-28 08:47:03.677	services_commerce	\N
f58607e1-59a6-4e68-bdfd-d74ce84ec4a0	e4a02e29-8b93-4610-ab94-a2318ba428d1	Agence Créative Fianar	Graphiste freelance — affiches événementielles	Design	Mission ponctuelle pour une série d’événements culturels. Livrables : 5 visuels print et web. Télétravail possible.	Fianarantsoa	Fianarantsoa	freelance	{Photoshop,Canva,Communication}	junior	2026-04-30 00:00:00	f	2026-09-28 08:47:03.679	digital	\N
c81aeb42-661f-49f5-92b1-84ee4db9c711	6e533429-db16-4ba6-8093-ed7d3ccc3197	Mahajanga Commerce Plus	Commercial·e terrain — produits locaux	Ventes	Développez un réseau de détaillants sur Mahajanga et environs. Véhicule fourni. Prime sur objectifs.	Mahajanga	Mahajanga	emploi	{"Vente terrain",Communication,Malagasy,Français}	intermediaire	2026-08-01 00:00:00	f	2026-09-28 08:47:03.682	services_commerce	\N
e3622f11-b364-4357-a788-f3efc5993ff9	63145bef-b6c5-456b-9450-5de91448fd16	ONG Éducation Sud	Community manager bénévole (mi-temps)	Community management	Animez les pages Facebook et TikTok d’une ONG éducative. 15 h/semaine, possibilité de télétravail partiel.	Toliara	Toliara	mission	{"Réseaux sociaux",Rédaction,Français,Malagasy}	debutant	2026-05-01 00:00:00	f	2026-09-28 08:47:03.685	digital	\N
b61ade62-6d17-4c73-9f4d-39f1969385d2	bdaf1e6d-b6d4-4156-b7e8-aa64866481d1	DataEntry MG	Agent saisie de données (télétravail)	Saisie de données	Saisie et vérification de formulaires clients. Connexion internet stable requise. Formation rapide fournie.	Antananarivo	Remote	mission	{Excel,Français,Saisie}	debutant	2026-06-01 00:00:00	t	2026-09-28 08:47:03.689	digital	\N
93c25329-73c3-4b4e-9a2f-a1b67da64eeb	440b9c4b-4767-41a3-a1c5-e2fcfc896235	Tourisme Nord Madagascar	Assistant·e accueil & réservations	Administration	Accueil clients, gestion des réservations et support administratif pour une agence à Antsiranana.	Antsiranana	Antsiranana	emploi	{"Service client",Français,Anglais,Excel}	junior	2026-07-01 00:00:00	f	2026-09-28 08:47:03.693	services_commerce	\N
4f75dce5-f6d1-472d-94c4-bcfa840cd00a	d459d35f-9fe4-47bb-8521-ce9438577fd1	Startup Livraison Tana	Livreur·se / coordinatrice logistique	Logistique	Rejoignez une équipe de livraison urbaine. Horaires flexibles, bon pour débuter dans la logistique.	Antananarivo	Antananarivo	emploi	{Livraison,Communication}	debutant	2026-05-15 00:00:00	f	2026-09-28 08:47:03.698	services_commerce	\N
049c39b9-d85a-4a23-a1c1-90118ca2d98a	167b4c07-e40a-46a0-a651-1cda727a1d9a	Freelance Hub Mada	Rédacteur·rice web SEO (freelance)	Services freelance	Rédaction d’articles en français pour sites locaux. Rémunération à l’article. Portfolio souhaité.	Toamasina	Remote	freelance	{Rédaction,SEO,Français}	intermediaire	2026-06-15 00:00:00	f	2026-09-28 08:47:03.701	digital	\N
4b5a1a37-d74c-4728-9c78-555b4ad2adf5	3f9a8f81-938e-4362-b4dd-6aad3ec12818	TechMada Solutions	Stage développement Python / data	IT / Digital	Stage de 6 mois : scripts d’automatisation, nettoyage de données et tableaux de bord simples.	Antananarivo	Antananarivo	stage	{Python,Excel,SQL}	debutant	2026-04-20 00:00:00	f	2026-09-28 08:47:03.705	digital	\N
07b08c09-f487-477e-a4e0-663463abf445	472bcbb1-6aee-4f62-8ec4-f2d742c2bf1c	Association Jeunes Fianar	Animateur·rice ateliers numériques	Community management	Encadrez des ateliers initiation au numérique pour jeunes. Contrat mission 4 mois.	Fianarantsoa	Fianarantsoa	mission	{Communication,Français,Malagasy}	junior	2026-05-30 00:00:00	f	2026-09-28 08:47:03.71	digital	\N
\.


--
-- Data for Name: Placement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Placement" (id, "opportunityId", "recruiterId", "candidateId", "talentId", "monthlySalaryAr", stage, "createdAt", "updatedAt") FROM stdin;
1aad38e0-31ba-43fd-9190-61fa77dd48c7	d713b0a4-0b2c-4eed-8ed5-5ba72d7e2bdb	3f9a8f81-938e-4362-b4dd-6aad3ec12818	d2d55685-4998-48d3-93cc-2e3b44528a08	\N	450000	etape1_payee	2026-09-28 08:47:03.953	2026-09-28 08:47:03.953
f799cbdd-7bcd-4fb8-845d-e36d74b3ccae	f58607e1-59a6-4e68-bdfd-d74ce84ec4a0	e4a02e29-8b93-4610-ab94-a2318ba428d1	\N	bfaa6fa7-3909-428e-98d4-3c5ea755dd40	320000	etape1_due	2026-09-28 08:47:03.956	2026-09-28 08:47:03.956
35d75490-4193-4f12-bb33-debfef886509	c81aeb42-661f-49f5-92b1-84ee4db9c711	6e533429-db16-4ba6-8093-ed7d3ccc3197	\N	ccfd7de4-47d5-416b-bc2e-8ddec4d3db21	300000	etape2_due	2026-09-28 08:47:03.958	2026-09-28 08:47:03.958
\.


--
-- Data for Name: Provider; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Provider" (id, name, trade, description, district, city, province, phone, whatsapp, "addedByMemberId", "claimedByMemberId", "createdAt") FROM stdin;
530f762a-d93a-482c-a799-bd2cd2b280b9	Briqueterie Rasoa	Fournisseur de briques	Briques cuites fabriquées sur place à Alasora. Livraison par camion sur l’agglomération, chargement compris.	Alasora	Antananarivo	Antananarivo	+261 34 05 112 34	+261 34 05 112 34	504da96b-dc6d-4a20-96ad-05c0b7f0001d	\N	2025-02-10 00:00:00
597d42eb-c35d-423a-a5d3-246eddb121e3	Quincaillerie Fanilo	Fournisseur ciment / fer	Ciment, fer à béton, tôles. Prix affichés, possibilité de livraison sur chantier à partir de 20 sacs.	Andraharo	Antananarivo	Antananarivo	+261 32 47 889 01	\N	b410b76c-29f7-4e36-a084-9326405398d6	b410b76c-29f7-4e36-a084-9326405398d6	2025-04-22 00:00:00
29e30a06-d16c-4feb-90a3-199c3c24102b	Équipe Randria — maçonnerie	Maçon	Chef de chantier et équipe de 5 maçons. Fondations, élévation, chape. Devis écrit avant démarrage.	Ambohimangakely	Antananarivo	Antananarivo	+261 33 12 556 78	+261 33 12 556 78	cf33cf61-f0f8-4fd1-a0e7-893a749506a4	\N	2025-05-03 00:00:00
20691bc2-4fd0-43d3-9d6b-2c59271127a7	Transport Tsiky — camion benne	Transport de matériaux	Camion benne 6 m³ pour sable, gravillon, briques et évacuation de gravats. Zone Tana et périphérie.	Tanjombato	Antananarivo	Antananarivo	+261 34 78 220 45	+261 34 78 220 45	4017447c-eeb6-4f26-8614-7295d853cac3	\N	2025-07-14 00:00:00
fe705e3e-0c64-4a06-b8b5-bc705d56ea56	Plomberie Nirina	Plombier	Installation sanitaire complète et dépannage fuite. Intervient principalement sur le nord de Tana.	Analamahitsy	Antananarivo	Antananarivo	+261 32 90 334 12	\N	00fcb469-30cc-412e-b0e9-9d4636c409b0	\N	2026-05-28 00:00:00
0e5a5333-652f-4024-af0d-34b644464a0b	Élec Andry	Électricien	Installation électrique domestique, tableau et mise aux normes. Devis gratuit.	Ivandry	Antananarivo	Antananarivo	+261 33 65 447 90	\N	74e32d51-0467-4e5a-a6da-a1ac325c3fd9	\N	2026-01-09 00:00:00
bf537a36-1100-4897-bde0-e4aa28ab9e59	Menuiserie Hery	Menuisier	Portes, fenêtres et placards sur mesure en bois local. Atelier à Itaosy.	Itaosy	Antananarivo	Antananarivo	+261 34 33 771 26	\N	caf85938-90db-4b1f-982e-393e8edd3474	\N	2024-06-18 00:00:00
3d496242-5f3f-46e7-8fc0-5a66bb301831	Carrelage Miora	Carreleur	Pose de carrelage sol et mur, finition soignée. Travaille souvent avec l’équipe Randria.	Ankadikely Ilafy	Antananarivo	Antananarivo	+261 34 19 662 03	+261 34 19 662 03	c77147c1-69e5-42ec-b1ff-36b0f64f512e	\N	2025-11-12 00:00:00
4e8c0b63-25a8-4ccc-bbf0-464abed21940	Terrassement Jaona	Terrassement	Décapage, nivellement et fouilles de fondation. Mini-pelle et main-d’œuvre.	Sabotsy Namehana	Antananarivo	Antananarivo	+261 32 55 908 77	\N	504da96b-dc6d-4a20-96ad-05c0b7f0001d	\N	2026-02-20 00:00:00
c6ef94d9-8a3d-4cdc-a4ec-f7983196a92a	Charpente Lova	Charpentier	Charpente traditionnelle et pose de tôles. Fiche créée par un membre, en attente de premiers retours.	Ambohibao	Antananarivo	Antananarivo	+261 33 27 145 58	\N	cf33cf61-f0f8-4fd1-a0e7-893a749506a4	\N	2026-07-30 00:00:00
\.


--
-- Data for Name: Recommendation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Recommendation" (id, "providerId", "authorMemberId", "authorDistrict", rating, "wouldUseAgain", "jobLabel", "jobDate", "pricePaid", "priceUnit", comment, proof, "createdAt") FROM stdin;
da4bda97-aeab-4bfe-9cba-278b4a7b0ed6	530f762a-d93a-482c-a799-bd2cd2b280b9	504da96b-dc6d-4a20-96ad-05c0b7f0001d	Alasora	5	t	Livraison de 3 000 briques pour une maison R+1	2026-06-12 00:00:00	480	par brique	Briques bien cuites, très peu de casse à la livraison (moins de 2 %). Camion arrivé le jour convenu. Le prix annoncé au téléphone était le prix payé.	facture	2026-09-28 08:47:03.775
0e63a8a8-392b-4d3f-9693-3fdea5f865fb	530f762a-d93a-482c-a799-bd2cd2b280b9	c77147c1-69e5-42ec-b1ff-36b0f64f512e	Alasora	5	t	Livraison de 1 200 briques, mur de clôture	2026-07-02 00:00:00	470	par brique	Deuxième commande chez eux. Qualité constante. Ils acceptent le paiement en deux fois pour les grosses quantités.	photo	2026-09-28 08:47:03.794
e6779a38-3bd3-4154-8719-b98015ca8d67	530f762a-d93a-482c-a799-bd2cd2b280b9	cf33cf61-f0f8-4fd1-a0e7-893a749506a4	Ambohimangakely	4	t	Livraison de 2 000 briques	2026-04-18 00:00:00	500	par brique	Bonne qualité mais livraison décalée de deux jours à cause de la pluie. Prévenus à l’avance, donc pas de mauvaise surprise.	facture	2026-09-28 08:47:03.8
99e909c8-4a13-4ee0-92f1-3fd62ee9fefd	530f762a-d93a-482c-a799-bd2cd2b280b9	4017447c-eeb6-4f26-8614-7295d853cac3	Tanjombato	4	t	Livraison de 800 briques	2026-02-27 00:00:00	490	par brique	Livraison jusqu’à Tanjombato sans supplément excessif. Compter 15 000 Ar de plus pour le déchargement à la main.	aucune	2026-09-28 08:47:03.806
3c9d3e1a-fd3b-4d1b-8195-cfa09082e63a	530f762a-d93a-482c-a799-bd2cd2b280b9	b410b76c-29f7-4e36-a084-9326405398d6	Andraharo	5	t	Commande régulière pour deux chantiers	2026-05-30 00:00:00	475	par brique	Je travaille avec eux depuis un an. Jamais eu de litige sur les quantités livrées, ce qui est rare.	facture	2026-09-28 08:47:03.816
d72d0ce5-6221-46a8-b4e9-da9342a1caa9	530f762a-d93a-482c-a799-bd2cd2b280b9	caf85938-90db-4b1f-982e-393e8edd3474	Itaosy	4	t	Livraison de 1 500 briques à Itaosy	2026-01-16 00:00:00	520	par brique	Plus cher pour moi à cause de la distance depuis Alasora. Reste intéressant par rapport aux briqueteries de l’ouest.	photo	2026-09-28 08:47:03.824
f10ab250-bf31-4a7c-8b8d-ddc9158f8a50	597d42eb-c35d-423a-a5d3-246eddb121e3	504da96b-dc6d-4a20-96ad-05c0b7f0001d	Alasora	4	t	Achat de 60 sacs de ciment	2026-06-05 00:00:00	39000	par sac	Prix corrects et stock disponible. Livraison sur chantier incluse au-delà de 20 sacs, comme annoncé.	facture	2026-09-28 08:47:03.826
5341170c-824c-42f2-b889-23f23155e143	597d42eb-c35d-423a-a5d3-246eddb121e3	4017447c-eeb6-4f26-8614-7295d853cac3	Tanjombato	4	t	Fer à béton et 25 sacs de ciment	2026-05-11 00:00:00	40000	par sac	Conseil utile sur les diamètres de fer. Facture détaillée fournie sans la demander.	facture	2026-09-28 08:47:03.83
f97411cb-eb16-4c72-8ed8-6dfce0903804	597d42eb-c35d-423a-a5d3-246eddb121e3	caf85938-90db-4b1f-982e-393e8edd3474	Itaosy	3	t	Achat de tôles	2026-03-20 00:00:00	42000	par sac	Correct sur le ciment, moins compétitif sur les tôles. Comparez avant de prendre tout au même endroit.	aucune	2026-09-28 08:47:03.832
f3e82094-007d-46e0-b4bf-10e76d6b3b3f	597d42eb-c35d-423a-a5d3-246eddb121e3	cf33cf61-f0f8-4fd1-a0e7-893a749506a4	Ambohimangakely	5	t	Ciment et fer pour dalle	2026-07-19 00:00:00	38500	par sac	Ils ont repris deux sacs abîmés sans discuter. Sérieux.	photo	2026-09-28 08:47:03.836
6485c65c-3b7c-455c-af1b-7e79a84e5a50	597d42eb-c35d-423a-a5d3-246eddb121e3	c77147c1-69e5-42ec-b1ff-36b0f64f512e	Alasora	4	t	Ciment pour chape	2026-04-08 00:00:00	39500	par sac	Rien à signaler, commande conforme.	aucune	2026-09-28 08:47:03.84
ec8d7f58-8076-4207-8c69-dadf43821f21	597d42eb-c35d-423a-a5d3-246eddb121e3	b410b76c-29f7-4e36-a084-9326405398d6	Andraharo	5	t	Notre quincaillerie	2026-07-01 00:00:00	\N	\N	Meilleurs prix de Tana, venez nombreux !	aucune	2026-09-28 08:47:03.842
8f633620-af15-4010-9589-a33e95a21149	29e30a06-d16c-4feb-90a3-199c3c24102b	cf33cf61-f0f8-4fd1-a0e7-893a749506a4	Ambohimangakely	5	t	Fondations et élévation, maison 90 m²	2026-05-04 00:00:00	32000	par jour	Chantier tenu dans les délais annoncés. Le chef d’équipe explique ce qu’il fait et accepte d’être repris.	facture	2026-09-28 08:47:03.843
a685aba6-69ff-41a5-bd99-1019d789ee6e	29e30a06-d16c-4feb-90a3-199c3c24102b	b410b76c-29f7-4e36-a084-9326405398d6	Andraharo	4	t	Mur de clôture 40 m	2026-06-22 00:00:00	30000	par jour	Bon travail. Prévoir vous-même l’approvisionnement, ils ne gèrent pas les achats.	photo	2026-09-28 08:47:03.847
f7441f3c-7aef-4446-a4f7-576ee1f5cf52	29e30a06-d16c-4feb-90a3-199c3c24102b	00fcb469-30cc-412e-b0e9-9d4636c409b0	Analamahitsy	4	t	Chape et enduit	2026-03-15 00:00:00	35000	par jour	Finition correcte. Un peu plus cher que d’autres équipes mais moins de reprises à faire.	aucune	2026-09-28 08:47:03.849
443230e3-15a0-4500-b35b-4376229d21ed	29e30a06-d16c-4feb-90a3-199c3c24102b	504da96b-dc6d-4a20-96ad-05c0b7f0001d	Alasora	5	t	Extension d’une pièce	2026-07-10 00:00:00	31000	par jour	Deuxième fois que je les prends. Devis écrit respecté au chiffre près.	facture	2026-09-28 08:47:03.85
930db43b-7624-47a2-ad31-a4be31669a43	20691bc2-4fd0-43d3-9d6b-2c59271127a7	4017447c-eeb6-4f26-8614-7295d853cac3	Tanjombato	5	t	Six voyages de sable	2026-06-30 00:00:00	145000	par voyage	Ponctuel, benne pleine à chaque fois. Il prévient par WhatsApp quand il part.	facture	2026-09-28 08:47:03.853
0acbca43-55e6-452b-a5f2-07f2d96e9fba	20691bc2-4fd0-43d3-9d6b-2c59271127a7	c77147c1-69e5-42ec-b1ff-36b0f64f512e	Alasora	4	t	Évacuation de gravats	2026-05-19 00:00:00	160000	par voyage	Un peu cher pour l’évacuation, mais il fait le travail proprement.	photo	2026-09-28 08:47:03.858
13c1d475-cea0-4310-8c24-0f619f9db273	20691bc2-4fd0-43d3-9d6b-2c59271127a7	cf33cf61-f0f8-4fd1-a0e7-893a749506a4	Ambohimangakely	4	t	Trois voyages de gravillon	2026-04-02 00:00:00	140000	par voyage	Rien à redire. Négociable si vous commandez plusieurs voyages.	aucune	2026-09-28 08:47:03.86
a7b87140-e9b9-4cb8-b678-b0d05d0082e7	fe705e3e-0c64-4a06-b8b5-bc705d56ea56	00fcb469-30cc-412e-b0e9-9d4636c409b0	Analamahitsy	5	t	Installation sanitaire complète	2026-05-25 00:00:00	850000	forfait	Travail rapide et propre, je recommande vivement.	aucune	2026-09-28 08:47:03.861
aa1fe7f4-5878-4a72-b7e5-99ac487be417	0e5a5333-652f-4024-af0d-34b644464a0b	74e32d51-0467-4e5a-a6da-a1ac325c3fd9	Ankadikely Ilafy	2	f	Installation tableau électrique	2026-06-08 00:00:00	420000	forfait	Travail fait mais devis dépassé de 30 % sans prévenir. Il a fallu insister pour obtenir une facture.	facture	2026-09-28 08:47:03.863
f618c035-d6e4-497e-86b2-7a5bf7c0f518	0e5a5333-652f-4024-af0d-34b644464a0b	00fcb469-30cc-412e-b0e9-9d4636c409b0	Analamahitsy	3	f	Mise aux normes prises et interrupteurs	2026-02-14 00:00:00	380000	forfait	Compétent techniquement, mais très difficile à joindre après le chantier.	aucune	2026-09-28 08:47:03.865
cf1f6415-dc3f-4bcf-b286-71b8fdb194e8	bf537a36-1100-4897-bde0-e4aa28ab9e59	caf85938-90db-4b1f-982e-393e8edd3474	Itaosy	5	t	Six fenêtres et deux portes sur mesure	2024-09-10 00:00:00	240000	par unité	Très beau travail à l’époque, bois bien choisi.	photo	2026-09-28 08:47:03.867
2f05b859-cde9-48a0-990f-75d9e0ce9ca6	bf537a36-1100-4897-bde0-e4aa28ab9e59	504da96b-dc6d-4a20-96ad-05c0b7f0001d	Alasora	4	t	Placard sur mesure	2024-11-22 00:00:00	310000	par unité	Bon rapport qualité-prix. Délai un peu long (5 semaines).	aucune	2026-09-28 08:47:03.871
5d8fc052-8c17-48b9-aa77-73d352fee34b	bf537a36-1100-4897-bde0-e4aa28ab9e59	cf33cf61-f0f8-4fd1-a0e7-893a749506a4	Ambohimangakely	4	t	Porte d’entrée	2024-12-05 00:00:00	280000	par unité	Satisfaite. Je ne sais pas s’il travaille encore, je n’ai plus de nouvelles.	photo	2026-09-28 08:47:03.873
4e6417eb-4ccf-485e-b2d3-9c1bc0bdb9ea	3d496242-5f3f-46e7-8fc0-5a66bb301831	c77147c1-69e5-42ec-b1ff-36b0f64f512e	Alasora	5	t	Carrelage 65 m² séjour et couloir	2026-06-18 00:00:00	16000	par m²	Joints réguliers, aucune reprise nécessaire. Il protège le chantier avant de commencer.	photo	2026-09-28 08:47:03.875
9392b96a-2a5f-4a93-836b-93538715088c	3d496242-5f3f-46e7-8fc0-5a66bb301831	cf33cf61-f0f8-4fd1-a0e7-893a749506a4	Ambohimangakely	4	t	Carrelage salle de bain et cuisine	2026-07-25 00:00:00	15000	par m²	Travail soigné. Prévoyez 10 % de carreaux en plus, il ne récupère pas les chutes.	facture	2026-09-28 08:47:03.879
625667ca-92bc-4afc-91b1-dfa8f87d30f4	4e8c0b63-25a8-4ccc-bbf0-464abed21940	504da96b-dc6d-4a20-96ad-05c0b7f0001d	Alasora	4	t	Fouilles de fondation, terrain de 300 m²	2026-03-09 00:00:00	45000	par m³	Mini-pelle en bon état, chantier terminé en deux jours comme prévu.	facture	2026-09-28 08:47:03.881
f3ca646d-d860-43ef-acf9-9fa736d2b2da	4e8c0b63-25a8-4ccc-bbf0-464abed21940	4017447c-eeb6-4f26-8614-7295d853cac3	Tanjombato	4	t	Décapage et nivellement	2026-05-02 00:00:00	48000	par m³	Correct. Le devis est au m³, faites mesurer avant de signer.	aucune	2026-09-28 08:47:03.884
\.


--
-- Data for Name: RecommendationConfirmation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RecommendationConfirmation" ("recommendationId", "memberId", "createdAt") FROM stdin;
da4bda97-aeab-4bfe-9cba-278b4a7b0ed6	c77147c1-69e5-42ec-b1ff-36b0f64f512e	2026-09-28 08:47:03.783
da4bda97-aeab-4bfe-9cba-278b4a7b0ed6	cf33cf61-f0f8-4fd1-a0e7-893a749506a4	2026-09-28 08:47:03.789
0e63a8a8-392b-4d3f-9693-3fdea5f865fb	504da96b-dc6d-4a20-96ad-05c0b7f0001d	2026-09-28 08:47:03.797
99e909c8-4a13-4ee0-92f1-3fd62ee9fefd	b410b76c-29f7-4e36-a084-9326405398d6	2026-09-28 08:47:03.811
3c9d3e1a-fd3b-4d1b-8195-cfa09082e63a	504da96b-dc6d-4a20-96ad-05c0b7f0001d	2026-09-28 08:47:03.819
3c9d3e1a-fd3b-4d1b-8195-cfa09082e63a	c77147c1-69e5-42ec-b1ff-36b0f64f512e	2026-09-28 08:47:03.822
f10ab250-bf31-4a7c-8b8d-ddc9158f8a50	4017447c-eeb6-4f26-8614-7295d853cac3	2026-09-28 08:47:03.828
f97411cb-eb16-4c72-8ed8-6dfce0903804	cf33cf61-f0f8-4fd1-a0e7-893a749506a4	2026-09-28 08:47:03.834
f3e82094-007d-46e0-b4bf-10e76d6b3b3f	504da96b-dc6d-4a20-96ad-05c0b7f0001d	2026-09-28 08:47:03.837
8f633620-af15-4010-9589-a33e95a21149	b410b76c-29f7-4e36-a084-9326405398d6	2026-09-28 08:47:03.845
8f633620-af15-4010-9589-a33e95a21149	00fcb469-30cc-412e-b0e9-9d4636c409b0	2026-09-28 08:47:03.846
443230e3-15a0-4500-b35b-4376229d21ed	cf33cf61-f0f8-4fd1-a0e7-893a749506a4	2026-09-28 08:47:03.852
930db43b-7624-47a2-ad31-a4be31669a43	c77147c1-69e5-42ec-b1ff-36b0f64f512e	2026-09-28 08:47:03.856
aa1fe7f4-5878-4a72-b7e5-99ac487be417	00fcb469-30cc-412e-b0e9-9d4636c409b0	2026-09-28 08:47:03.864
cf1f6415-dc3f-4bcf-b286-71b8fdb194e8	504da96b-dc6d-4a20-96ad-05c0b7f0001d	2026-09-28 08:47:03.869
4e6417eb-4ccf-485e-b2d3-9c1bc0bdb9ea	cf33cf61-f0f8-4fd1-a0e7-893a749506a4	2026-09-28 08:47:03.877
625667ca-92bc-4afc-91b1-dfa8f87d30f4	4017447c-eeb6-4f26-8614-7295d853cac3	2026-09-28 08:47:03.883
\.


--
-- Data for Name: RecruiterProfile; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RecruiterProfile" ("userId", "companyName", phone, province, city, tier, sector) FROM stdin;
3f9a8f81-938e-4362-b4dd-6aad3ec12818	TechMada Solutions	+261 32 98 765 43	Antananarivo	Antananarivo	gratuit	digital
e7cae0a4-37c4-4063-861e-c536fca65d97	Port Logistique Toamasina	+261 33 11 222 33	Toamasina	Toamasina	gratuit	services_commerce
e4a02e29-8b93-4610-ab94-a2318ba428d1	Agence Créative Fianar	+261 34 22 333 44	Fianarantsoa	Fianarantsoa	gratuit	digital
6e533429-db16-4ba6-8093-ed7d3ccc3197	Mahajanga Commerce Plus	+261 32 33 444 55	Mahajanga	Mahajanga	gratuit	services_commerce
63145bef-b6c5-456b-9450-5de91448fd16	ONG Éducation Sud	+261 33 44 555 66	Toliara	Toliara	gratuit	autre
bdaf1e6d-b6d4-4156-b7e8-aa64866481d1	DataEntry MG	+261 34 55 666 77	Antananarivo	Remote	gratuit	services_commerce
440b9c4b-4767-41a3-a1c5-e2fcfc896235	Tourisme Nord Madagascar	+261 32 66 777 88	Antsiranana	Antsiranana	gratuit	services_commerce
d459d35f-9fe4-47bb-8521-ce9438577fd1	Startup Livraison Tana	+261 33 77 888 99	Antananarivo	Antananarivo	gratuit	services_commerce
167b4c07-e40a-46a0-a651-1cda727a1d9a	Freelance Hub Mada	+261 34 88 999 00	Toamasina	Remote	gratuit	digital
472bcbb1-6aee-4f62-8ec4-f2d742c2bf1c	Association Jeunes Fianar	+261 32 99 000 11	Fianarantsoa	Fianarantsoa	gratuit	autre
\.


--
-- Data for Name: Report; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Report" (id, "reporterId", "targetType", "targetId", "targetUserId", reason, status, "createdAt") FROM stdin;
\.


--
-- Data for Name: SourcingLead; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SourcingLead" (id, "agentId", type, source, "sourceUrl", trade, sector, province, city, description, status, "talentId", "createdAt", "updatedAt") FROM stdin;
a7e95673-c8b1-433e-a01a-097c440afe78	f4794845-1c80-4f95-8537-ca2e78c92798	talent	Groupe Facebook « Bâtiment Antananarivo »	\N	Peintre en bâtiment	btp	Antananarivo	Antananarivo	Plusieurs photos de chantiers récents postées par la même personne, à contacter pour évaluer.	nouveau	\N	2026-09-28 08:47:03.936	2026-09-28 08:47:03.936
6d029266-03ad-42df-bbfe-7406f21f9dc1	f4794845-1c80-4f95-8537-ca2e78c92798	talent	Affiche quartier Analamahitsy	\N	Couturière	textile_artisanat	Antananarivo	Antananarivo	Atelier de couture repéré près du marché — contact établi, profil créé et vérifié.	converti	bfaa6fa7-3909-428e-98d4-3c5ea755dd40	2026-09-28 08:47:03.941	2026-09-28 08:47:03.941
54354428-ef7f-4217-89d8-4afabca53f00	29ddf83e-3a02-4c66-9a94-faedac96be57	opportunity	Annonce WhatsApp — Quincaillerie locale	\N	Livreur / manutentionnaire	services_commerce	Antananarivo	Antananarivo	La quincaillerie cherche un livreur régulier, pas encore de compte recruteur — premier contact fait.	contacte	\N	2026-09-28 08:47:03.944	2026-09-28 08:47:03.944
\.


--
-- Data for Name: Subscription; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Subscription" (id, "recruiterId", "planCode", "startedAt") FROM stdin;
e30a4c63-9a9d-4dde-a61f-06ec6dec18bc	3f9a8f81-938e-4362-b4dd-6aad3ec12818	PRO	2026-09-28 08:47:03.891
ac731ba3-3155-4157-a1f1-f4c9868801d0	e7cae0a4-37c4-4063-861e-c536fca65d97	STARTER	2026-09-28 08:47:03.896
\.


--
-- Data for Name: SubscriptionPlan; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SubscriptionPlan" (code, name, "priceAr", "maxActiveOpportunities", features) FROM stdin;
FREE	Free	0	2	{"Profil entreprise","Candidatures reçues","Statistiques basiques"}
STARTER	Starter	100000	10	{"Plus d’offres","Matching amélioré","Recherche avancée",Shortlist}
PRO	Pro	250000	30	{"Matching avancé","Recommandations prioritaires",Analytics,"Outils RH avancés"}
BUSINESS	Business	500000	\N	{"Volume élevé","Analytics avancés","Support prioritaire"}
\.


--
-- Data for Name: TalentAccountProfile; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TalentAccountProfile" ("userId", "fullName", phone, province, city, gender, "leadId", "talentId") FROM stdin;
\.


--
-- Data for Name: TalentLead; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TalentLead" (id, "fullName", phone, province, city, gender, trade, sector, message, status, "createdAt") FROM stdin;
\.


--
-- Data for Name: TalentOpportunityProposal; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TalentOpportunityProposal" (id, "talentId", "opportunityId", "proposedAt") FROM stdin;
cfaa2728-4931-48ce-a182-c886a2db943f	bfaa6fa7-3909-428e-98d4-3c5ea755dd40	f58607e1-59a6-4e68-bdfd-d74ce84ec4a0	2026-09-28 08:47:03.946
d9c06c85-48ac-4764-8fb2-fdefa02a0e5e	dbef627c-7f3b-4eaa-b709-2b7908c0cd1e	4f75dce5-f6d1-472d-94c4-bcfa840cd00a	2026-09-28 08:47:03.949
a7739619-5a8e-409f-8ade-edcd5b48d678	ccfd7de4-47d5-416b-bc2e-8ddec4d3db21	c81aeb42-661f-49f5-92b1-84ee4db9c711	2026-09-28 08:47:03.951
\.


--
-- Data for Name: TalentProfile; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TalentProfile" (id, "agentId", "fullName", phone, province, city, gender, skills, availability, status, "createdAt", "updatedAt", trade, sector) FROM stdin;
bfaa6fa7-3909-428e-98d4-3c5ea755dd40	f4794845-1c80-4f95-8537-ca2e78c92798	Vololona Randria	+261 34 40 111 22	Antananarivo	Antananarivo	femme	{Couture,Broderie,Retouche}	immediate	place	2026-09-28 08:47:03.91	2026-09-28 08:47:03.91	Couturière	textile_artisanat
dbef627c-7f3b-4eaa-b709-2b7908c0cd1e	f4794845-1c80-4f95-8537-ca2e78c92798	Herimanana Rakotoson	+261 33 41 222 33	Antananarivo	Antananarivo	homme	{"Installation électrique",Dépannage}	flexible	recommande	2026-09-28 08:47:03.918	2026-09-28 08:47:03.918	Électricien	btp
0d9d1d87-6bbc-47b9-bbf6-0eb8fe7e7ced	f4794845-1c80-4f95-8537-ca2e78c92798	Sahondra Rabemananjara	+261 32 42 333 44	Antananarivo	Antananarivo	femme	{"Cuisine malgache","Hygiène alimentaire"}	immediate	verifie	2026-09-28 08:47:03.922	2026-09-28 08:47:03.922	Cuisine / restauration	agroalimentaire
ccfd7de4-47d5-416b-bc2e-8ddec4d3db21	29ddf83e-3a02-4c66-9a94-faedac96be57	Fenosoa Andriamihaja	+261 34 43 444 55	Antananarivo	Antananarivo	femme	{"Vente terrain",Caisse,"Relation client"}	immediate	recommande	2026-09-28 08:47:03.925	2026-09-28 08:47:03.925	Vente / commerce	services_commerce
5ef5980b-c6b1-4627-95b2-3ba90abdf8fc	29ddf83e-3a02-4c66-9a94-faedac96be57	Rado Ramanantsoa	+261 33 44 555 66	Antananarivo	Antananarivo	homme	{"Permis B",Livraison,Ponctualité}	immediate	verifie	2026-09-28 08:47:03.928	2026-09-28 08:47:03.928	Conduite / livraison	services_commerce
bf86ead2-6364-4cb2-b3e5-a27ad1d80ab9	29ddf83e-3a02-4c66-9a94-faedac96be57	Onja Rasoanirina	+261 32 45 666 77	Antananarivo	Antananarivo	femme	{Nettoyage,Repassage,Organisation}	m1	en_attente	2026-09-28 08:47:03.932	2026-09-28 08:47:03.932	Ménage / entretien	services_commerce
\.


--
-- Data for Name: TalentVerification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TalentVerification" (id, "talentId", trade, checklist, note, "verifiedAt") FROM stdin;
54eb60fc-b2ba-4e58-9ded-a76201d14d8c	bfaa6fa7-3909-428e-98d4-3c5ea755dd40	Couturière	{"Couture": true, "Broderie": true, "Retouche": true}	Compétences vérifiées sur le terrain par Voninkazo Rasolofoson.	2026-09-28 08:47:03.915
084deb71-5e96-4066-93ae-9867e26106c2	dbef627c-7f3b-4eaa-b709-2b7908c0cd1e	Électricien	{"Dépannage": true, "Installation électrique": true}	Compétences vérifiées sur le terrain par Voninkazo Rasolofoson.	2026-09-28 08:47:03.92
70455083-c9f5-41d8-b983-0e90e19ee184	0d9d1d87-6bbc-47b9-bbf6-0eb8fe7e7ced	Cuisine / restauration	{"Cuisine malgache": true, "Hygiène alimentaire": true}	Compétences vérifiées sur le terrain par Voninkazo Rasolofoson.	2026-09-28 08:47:03.923
991c6039-9b26-46aa-9daf-e863a8509410	ccfd7de4-47d5-416b-bc2e-8ddec4d3db21	Vente / commerce	{"Caisse": true, "Vente terrain": true, "Relation client": true}	Compétences vérifiées sur le terrain par Tovonirina Andriamampianina.	2026-09-28 08:47:03.927
b2e6373e-f8b7-4437-8379-930a40b1ceda	5ef5980b-c6b1-4627-95b2-3ba90abdf8fc	Conduite / livraison	{"Permis B": true, "Livraison": true, "Ponctualité": true}	Compétences vérifiées sur le terrain par Tovonirina Andriamampianina.	2026-09-28 08:47:03.93
\.


--
-- Data for Name: Transaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Transaction" (id, "recruiterId", type, "amountAr", description, "createdAt") FROM stdin;
2703d629-8a6f-43a7-bf4d-e17d2c98e5f2	3f9a8f81-938e-4362-b4dd-6aad3ec12818	subscription	250000	Abonnement Pro	2026-09-28 08:47:03.894
77be59d9-eeaf-46e1-925a-3e103a6ef578	e7cae0a4-37c4-4063-861e-c536fca65d97	subscription	100000	Abonnement Starter	2026-09-28 08:47:03.898
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, email, "passwordHash", role, "createdAt", status) FROM stdin;
3f9a8f81-938e-4362-b4dd-6aad3ec12818	recruteur@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	recruiter	2026-09-28 08:47:03.51	active
e7cae0a4-37c4-4063-861e-c536fca65d97	contact@port-toamasina.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	recruiter	2026-09-28 08:47:03.522	active
e4a02e29-8b93-4610-ab94-a2318ba428d1	contact@agence-fianar.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	recruiter	2026-09-28 08:47:03.53	active
6e533429-db16-4ba6-8093-ed7d3ccc3197	contact@mahajanga-commerce.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	recruiter	2026-09-28 08:47:03.543	active
63145bef-b6c5-456b-9450-5de91448fd16	contact@education-sud.org	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	recruiter	2026-09-28 08:47:03.549	active
bdaf1e6d-b6d4-4156-b7e8-aa64866481d1	contact@dataentry.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	recruiter	2026-09-28 08:47:03.553	active
440b9c4b-4767-41a3-a1c5-e2fcfc896235	contact@tourisme-nord.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	recruiter	2026-09-28 08:47:03.556	active
d459d35f-9fe4-47bb-8521-ce9438577fd1	contact@livraison-tana.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	recruiter	2026-09-28 08:47:03.559	active
167b4c07-e40a-46a0-a651-1cda727a1d9a	contact@freelance-hub.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	recruiter	2026-09-28 08:47:03.562	active
472bcbb1-6aee-4f62-8ec4-f2d742c2bf1c	contact@jeunes-fianar.org	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	recruiter	2026-09-28 08:47:03.564	active
d2d55685-4998-48d3-93cc-2e3b44528a08	candidat@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	candidate	2026-09-28 08:47:03.568	active
633effba-66ad-44a8-af6f-ba33e085405f	faniry.andria@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	candidate	2026-09-28 08:47:03.575	active
ef308614-dcef-4ad6-b2a6-860f9fb9d32f	tahiana.raz@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	candidate	2026-09-28 08:47:03.581	active
288ebec0-a036-4496-8a99-493d82a412b2	nomena.fara@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	candidate	2026-09-28 08:47:03.584	active
44da9eb6-82d6-4def-858c-0d49d5ddafef	sitraka.ravo@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	candidate	2026-09-28 08:47:03.59	active
f4794845-1c80-4f95-8537-ca2e78c92798	agent.analamanga@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	agent	2026-09-28 08:47:03.596	active
29ddf83e-3a02-4c66-9a94-faedac96be57	agent.terrain2@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	agent	2026-09-28 08:47:03.6	active
c89aab6d-6651-4d44-b5fc-d4c471f15ba0	particulier@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	particulier	2026-09-28 08:47:03.604	active
37e08a9d-3c1e-406e-b11f-64a15a95977c	admin@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	admin	2026-09-28 08:47:03.61	active
59a26894-8d93-445c-be7b-0b1c23af8fbd	member-1@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	particulier	2026-09-28 08:47:03.612	active
103565d3-10ca-472c-8c50-aea522f2dfde	member-2@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	particulier	2026-09-28 08:47:03.621	active
acccf0ab-e519-4f0c-b95c-9028a75f10b4	member-3@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	particulier	2026-09-28 08:47:03.627	active
61b4e8fe-1606-4897-844f-bf690ebd7368	member-4@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	particulier	2026-09-28 08:47:03.634	active
a60a608b-9a86-481a-8212-336274c7452a	member-5@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	particulier	2026-09-28 08:47:03.64	active
3f0a267a-10f4-4611-8e5d-68a44b92ed28	member-6@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	particulier	2026-09-28 08:47:03.649	active
a3f9e31f-2f28-45bd-a8ff-b840cff540d0	member-7@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	particulier	2026-09-28 08:47:03.658	active
d3997c01-3853-4a90-8264-360f2087c474	member-8@demo.mg	$2a$10$S.YZXElEPLB6SI9Ea0t14OUCIuapUvMeJfgUeyE1r9Bnx/R1AvLXO	particulier	2026-09-28 08:47:03.665	active
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
243f8e24-efe7-4c7f-8f8b-573c7c8962d6	2ec13a6d67b2fa0f4cd43c47ba9fc55c886f91f36bed67fa68e109d75d876957	2026-09-28 08:46:30.46637+00	20260831230624_init	\N	\N	2026-09-28 08:46:30.266291+00	1
fa321af1-4563-4f99-95da-595ba4071db8	913f2729faf75f413b4ceada77cb1c1ba8a2db6974a322bd4b32060c63c670ae	2026-09-28 08:46:30.548556+00	20260831234951_messaging_billing	\N	\N	2026-09-28 08:46:30.468217+00	1
00943c8b-c824-4b4d-b1ba-a78cc69f72ed	1019378311926c42d758bf4625b1ed929bb0501c15cd9bceaab12ac9e4d071c0	2026-09-28 08:46:30.587226+00	20260901000324_moderation	\N	\N	2026-09-28 08:46:30.549913+00	1
96d82a20-a6aa-4899-b949-e7a7629bdd71	82fb2f0b18fa60fcd10c14eaa0c42d60ec03f8075917f9da3c95b402c9aa847d	2026-09-28 08:46:30.666005+00	20260901070349_emploi_verifie	\N	\N	2026-09-28 08:46:30.589175+00	1
ee8420d2-8350-4688-87b5-63629f0f0eb7	baf4b9f41561f37cbc8b67d45f84ba93cd4cd9a7b7b8f000b8d200e143214929	2026-09-28 08:46:30.695694+00	20260902052732_add_sector_taxonomy	\N	\N	2026-09-28 08:46:30.66749+00	1
4386748b-bde2-4a87-86a8-fc4c32a6224d	9de8f0afcb7052e3bf6c579a655f501e6ed7ea5e519d16e0eafbdd002d62005e	2026-09-28 08:46:30.703979+00	20260902054241_opportunity_sector_details	\N	\N	2026-09-28 08:46:30.698147+00	1
4ea069af-118c-4524-8b3c-70b76f825cf4	89c9b19f1843eae8445d569eee8821d2f1036639fb316ad005429875346bd8b5	2026-09-28 08:46:30.742802+00	20260902063530_email_verification_talent_account	\N	\N	2026-09-28 08:46:30.705861+00	1
735e8d16-99d2-49cb-97d0-f68588e60c3c	7ba68412e4318ac8466179222c4c8d76b0ce645013805a3a6fe1684852daeb45	2026-09-28 08:46:30.769404+00	20260902075352_match_suggestions	\N	\N	2026-09-28 08:46:30.74473+00	1
ad3749c8-9ea0-4943-af79-922aaa962dcd	4e85f3ecfa64f8e0d7608d7113951aa8e5290d8df244078c7f819fbdcdb1165b	2026-09-28 08:46:30.777487+00	20260902121500_notification_link	\N	\N	2026-09-28 08:46:30.771183+00	1
d98fc791-d019-46b0-86e5-ecdee3302d1c	8640fd99e4fa5b7f58ce0a53571bf35b05a5bc5019aebd4e559c0cbe950613c6	2026-09-28 08:46:30.806287+00	20260902235000_sourcing_lead	\N	\N	2026-09-28 08:46:30.779142+00	1
\.


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

\unrestrict wVSW5rupzOyu24g8hiqSE6oZeRz1HKocrZZeh48HLZStiUVD2YRNUPflIkVB6Za

