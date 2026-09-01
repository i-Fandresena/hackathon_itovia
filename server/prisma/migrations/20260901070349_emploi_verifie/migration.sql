/*
  Warnings:

  - Added the required column `gender` to the `CandidateProfile` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('femme', 'homme', 'autre');

-- CreateEnum
CREATE TYPE "TalentStatus" AS ENUM ('en_attente', 'verifie', 'recommande', 'place');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('envoyee', 'vue', 'contactee', 'refusee');

-- CreateEnum
CREATE TYPE "AccountTier" AS ENUM ('gratuit', 'premium');

-- CreateEnum
CREATE TYPE "PlacementStage" AS ENUM ('etape1_due', 'etape1_payee', 'etape2_due', 'etape2_payee', 'annule');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'agent';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "status" "ApplicationStatus" NOT NULL DEFAULT 'envoyee';

-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "cvSkillsSuggested" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cvUrl" TEXT,
ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'autre';

-- La base de dev est réinitialisée et reseedée juste après cette migration
-- (voir server/prisma/seed.ts) ; ce défaut temporaire n'a donc pas vocation
-- à masquer un genre réel en production.
ALTER TABLE "CandidateProfile" ALTER COLUMN "gender" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RecruiterProfile" ADD COLUMN     "tier" "AccountTier" NOT NULL DEFAULT 'gratuit';

-- CreateTable
CREATE TABLE "AgentProfile" (
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TalentProfile" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "skills" TEXT[],
    "availability" "Availability" NOT NULL,
    "status" "TalentStatus" NOT NULL DEFAULT 'en_attente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentVerification" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "note" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentOpportunityProposal" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentOpportunityProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT,
    "recruiterId" TEXT NOT NULL,
    "candidateId" TEXT,
    "talentId" TEXT,
    "monthlySalaryAr" INTEGER,
    "stage" "PlacementStage" NOT NULL DEFAULT 'etape1_due',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TalentProfile_agentId_idx" ON "TalentProfile"("agentId");

-- CreateIndex
CREATE INDEX "TalentVerification_talentId_idx" ON "TalentVerification"("talentId");

-- CreateIndex
CREATE INDEX "TalentOpportunityProposal_opportunityId_idx" ON "TalentOpportunityProposal"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "TalentOpportunityProposal_talentId_opportunityId_key" ON "TalentOpportunityProposal"("talentId", "opportunityId");

-- CreateIndex
CREATE INDEX "Placement_recruiterId_idx" ON "Placement"("recruiterId");

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentProfile" ADD CONSTRAINT "TalentProfile_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentVerification" ADD CONSTRAINT "TalentVerification_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentOpportunityProposal" ADD CONSTRAINT "TalentOpportunityProposal_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentOpportunityProposal" ADD CONSTRAINT "TalentOpportunityProposal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "TalentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
