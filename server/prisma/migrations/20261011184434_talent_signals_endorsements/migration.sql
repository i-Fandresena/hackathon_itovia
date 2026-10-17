-- CreateEnum
CREATE TYPE "EndorsementSubject" AS ENUM ('talent', 'entreprise');

-- CreateEnum
CREATE TYPE "EndorsementRelation" AS ENUM ('client', 'employeur', 'collegue', 'salarie', 'stagiaire', 'prestataire');

-- CreateEnum
CREATE TYPE "TalentSignalStatus" AS ENUM ('nouveau', 'pris_en_charge', 'converti', 'refuse', 'injoignable', 'expire', 'fusionne');

-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'endorsement';

-- CreateTable
CREATE TABLE "TalentSignal" (
    "id" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "sector" "Sector" NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "subjectName" TEXT,
    "contactPhone" TEXT,
    "phoneKey" TEXT,
    "contactHint" TEXT,
    "status" "TalentSignalStatus" NOT NULL DEFAULT 'nouveau',
    "agentId" TEXT,
    "talentId" TEXT,
    "mergedIntoId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "contactPurgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endorsement" (
    "id" TEXT NOT NULL,
    "subjectType" "EndorsementSubject" NOT NULL,
    "talentSignalId" TEXT,
    "authorMemberId" TEXT NOT NULL,
    "authorDistrict" TEXT NOT NULL,
    "relation" "EndorsementRelation" NOT NULL,
    "jobLabel" TEXT NOT NULL,
    "jobDate" TIMESTAMP(3) NOT NULL,
    "highlights" TEXT[],
    "comment" TEXT,
    "proof" "ProofType" NOT NULL DEFAULT 'aucune',
    "proofFileUrl" TEXT,
    "proofAccepted" BOOLEAN,
    "reviewedAt" TIMESTAMP(3),
    "hiddenJobLabel" BOOLEAN NOT NULL DEFAULT false,
    "excludedAt" TIMESTAMP(3),
    "excludedReason" TEXT,
    "excludedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Endorsement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TalentSignal_status_idx" ON "TalentSignal"("status");

-- CreateIndex
CREATE INDEX "TalentSignal_phoneKey_idx" ON "TalentSignal"("phoneKey");

-- CreateIndex
CREATE INDEX "TalentSignal_talentId_idx" ON "TalentSignal"("talentId");

-- CreateIndex
CREATE INDEX "TalentSignal_expiresAt_idx" ON "TalentSignal"("expiresAt");

-- CreateIndex
CREATE INDEX "Endorsement_authorMemberId_idx" ON "Endorsement"("authorMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "Endorsement_talentSignalId_authorMemberId_key" ON "Endorsement"("talentSignalId", "authorMemberId");

-- AddForeignKey
ALTER TABLE "TalentSignal" ADD CONSTRAINT "TalentSignal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentSignal" ADD CONSTRAINT "TalentSignal_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "TalentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentSignal" ADD CONSTRAINT "TalentSignal_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "TalentSignal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_talentSignalId_fkey" FOREIGN KEY ("talentSignalId") REFERENCES "TalentSignal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_authorMemberId_fkey" FOREIGN KEY ("authorMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
