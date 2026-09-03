-- Veille agent : signaux repérés (en ligne ou sur le terrain) pour étoffer
-- l'annuaire, jamais un profil ou une offre en soi tant qu'un agent n'a pas
-- vérifié réellement (§7.3.15) — distinct de TalentLead (self-service).

-- CreateEnum
CREATE TYPE "SourcingLeadType" AS ENUM ('talent', 'opportunity');

-- CreateTable
CREATE TABLE "SourcingLead" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "type" "SourcingLeadType" NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "trade" TEXT NOT NULL,
    "sector" "Sector" NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'nouveau',
    "talentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourcingLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourcingLead_agentId_idx" ON "SourcingLead"("agentId");

-- CreateIndex
CREATE INDEX "SourcingLead_status_idx" ON "SourcingLead"("status");

-- AddForeignKey
ALTER TABLE "SourcingLead" ADD CONSTRAINT "SourcingLead_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingLead" ADD CONSTRAINT "SourcingLead_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "TalentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
