-- CreateEnum
CREATE TYPE "ContactRequestStatus" AS ENUM ('nouvelle', 'transmise', 'close');

-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'talent';

-- AlterTable
ALTER TABLE "TalentProfile" ADD COLUMN     "publicConsentAt" TIMESTAMP(3),
ADD COLUMN     "publicRef" TEXT;

-- CreateTable
CREATE TABLE "TalentContactRequest" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "need" TEXT NOT NULL,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'nouvelle',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TalentContactRequest_talentId_idx" ON "TalentContactRequest"("talentId");

-- CreateIndex
CREATE INDEX "TalentContactRequest_status_idx" ON "TalentContactRequest"("status");

-- CreateIndex
CREATE INDEX "TalentContactRequest_requesterId_idx" ON "TalentContactRequest"("requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "TalentProfile_publicRef_key" ON "TalentProfile"("publicRef");

-- AddForeignKey
ALTER TABLE "TalentContactRequest" ADD CONSTRAINT "TalentContactRequest_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentContactRequest" ADD CONSTRAINT "TalentContactRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentContactRequest" ADD CONSTRAINT "TalentContactRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

