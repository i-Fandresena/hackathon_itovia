-- OffRec devient l'intermédiaire de toute mise en relation (décision
-- produit 2026-09-02) : plus de candidature directe, plus de contact
-- direct candidat/recruteur — tout passe par une décision admin.

-- CreateEnum
CREATE TYPE "MatchSuggestionStatus" AS ENUM ('proposee_candidat', 'interet_candidat', 'proposee_recruteur', 'interet_recruteur', 'mise_en_relation', 'ecartee');

-- CreateTable
CREATE TABLE "MatchSuggestion" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" TEXT[],
    "status" "MatchSuggestionStatus" NOT NULL DEFAULT 'proposee_candidat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchSuggestion_opportunityId_candidateId_key" ON "MatchSuggestion"("opportunityId", "candidateId");

-- CreateIndex
CREATE INDEX "MatchSuggestion_status_idx" ON "MatchSuggestion"("status");

-- CreateIndex
CREATE INDEX "MatchSuggestion_candidateId_idx" ON "MatchSuggestion"("candidateId");

-- AddForeignKey
ALTER TABLE "MatchSuggestion" ADD CONSTRAINT "MatchSuggestion_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSuggestion" ADD CONSTRAINT "MatchSuggestion_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
