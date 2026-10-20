-- Sous-lot 1 « après l'entretien » — temps A (expand), 2026-10-16.
-- Purement additif : nouveaux enums, nouvelles colonnes (nullables ou avec
-- valeur par défaut), nouvelle table HireProposal, nouveaux index uniques sur
-- des colonnes neuves. Compatible avec l'ancien code et l'ancien client
-- Prisma (aucune colonne existante n'est modifiée ni supprimée ; la
-- contrainte « un entretien par dossier » reste en place jusqu'au temps B,
-- 20261016100000_interview_rounds). Les reprises de données ne remplissent
-- que des colonnes neuves encore vides (rejouables sans effet).

-- CreateEnum
CREATE TYPE "MatchClosedReason" AS ENUM ('offre_pourvue');

-- CreateEnum
CREATE TYPE "InterviewResult" AS ENUM ('retenu', 'second_entretien', 'non_retenu', 'absent');

-- CreateEnum
CREATE TYPE "InterviewResultReason" AS ENUM ('competences_techniques', 'experience', 'disponibilite', 'pretentions_salariales', 'savoir_etre', 'autre_candidat_retenu', 'poste_modifie', 'points_forts', 'autre');

-- CreateEnum
CREATE TYPE "HireProposalStatus" AS ENUM ('envoyee', 'acceptee', 'refusee', 'expiree', 'retiree');

-- CreateEnum
CREATE TYPE "HireProposalWithdrawReason" AS ENUM ('recruteur', 'poste_pourvu', 'compte_inactif');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('cdi', 'cdd', 'stage', 'alternance', 'freelance');

-- CreateEnum
CREATE TYPE "HireDeclineReason" AS ENUM ('salaire', 'date_debut', 'type_contrat', 'autre_offre_acceptee', 'localisation', 'raisons_personnelles', 'autre');

-- CreateEnum
CREATE TYPE "PlacementOrigin" AS ENUM ('declaration', 'proposition_acceptee');

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "filledAt" TIMESTAMP(3),
ADD COLUMN     "filledBy" TEXT,
ADD COLUMN     "positions" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "MatchSuggestion" ADD COLUMN     "closedReason" "MatchClosedReason",
ADD COLUMN     "connectedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "absenceReply" TEXT,
ADD COLUMN     "absenceReplyAt" TIMESTAMP(3),
ADD COLUMN     "activeSuggestionId" TEXT,
ADD COLUMN     "outcome" "InterviewResult",
ADD COLUMN     "outcomeAt" TIMESTAMP(3),
ADD COLUMN     "outcomeById" TEXT,
ADD COLUMN     "outcomeNote" TEXT,
ADD COLUMN     "outcomeReason" "InterviewResultReason",
ADD COLUMN     "outcomeReminderAt" TIMESTAMP(3),
ADD COLUMN     "round" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Placement" ADD COLUMN     "contractType" "ContractType",
ADD COLUMN     "hireProposalId" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "origin" "PlacementOrigin" NOT NULL DEFAULT 'declaration',
ADD COLUMN     "startDate" DATE,
ADD COLUMN     "suggestionId" TEXT;

-- Reprise : chaque entretien existant devient le tour 1 (valeur par défaut
-- de "round"), ACTIF puisqu'aucun n'a d'issue. Un seul entretien par dossier
-- à ce stade ("Interview_suggestionId_key"), donc un seul tour actif.
UPDATE "Interview" SET "activeSuggestionId" = "suggestionId"
WHERE "activeSuggestionId" IS NULL AND "outcome" IS NULL;

-- Reprise : date de mise en relation des dossiers déjà mis en relation =
-- date de la transition dans le journal d'audit, sinon "updatedAt" (même
-- approximation que les tableaux de bord jusqu'ici).
UPDATE "MatchSuggestion" ms
SET "connectedAt" = COALESCE(
  (SELECT min(a."createdAt") FROM "AuditLog" a
   WHERE a."action" = 'match_suggestion_status'
     AND a."metadata"->>'suggestionId' = ms."id"
     AND a."metadata"->>'to' = 'mise_en_relation'),
  ms."updatedAt")
WHERE ms."status" = 'mise_en_relation' AND ms."connectedAt" IS NULL;

-- Reprise : lien placement → dossier diplômé, pour le plus ancien placement
-- non annulé de chaque paire offre/candidat (à défaut, le plus ancien
-- annulé). Les autres placements de la paire restent sans lien (contrainte
-- unique) ; aucun placement de talent n'est concerné.
UPDATE "Placement" p SET "suggestionId" = ms."id"
FROM "MatchSuggestion" ms
WHERE p."suggestionId" IS NULL
  AND p."candidateId" IS NOT NULL AND p."opportunityId" IS NOT NULL
  AND ms."candidateId" = p."candidateId" AND ms."opportunityId" = p."opportunityId"
  AND NOT EXISTS (SELECT 1 FROM "Placement" px WHERE px."suggestionId" = ms."id")
  AND p."id" = (SELECT p2."id" FROM "Placement" p2
                WHERE p2."candidateId" = p."candidateId" AND p2."opportunityId" = p."opportunityId"
                ORDER BY (p2."stage" = 'annule'), p2."createdAt", p2."id" LIMIT 1);

-- CreateTable
CREATE TABLE "HireProposal" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "pendingSuggestionId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "jobTitle" TEXT NOT NULL,
    "monthlySalaryAr" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "contractDurationMonths" INTEGER,
    "message" TEXT,
    "status" "HireProposalStatus" NOT NULL DEFAULT 'envoyee',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "respondedAt" TIMESTAMP(3),
    "declineReason" "HireDeclineReason",
    "declineNote" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawReason" "HireProposalWithdrawReason",
    "expiryReminderAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HireProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HireProposal_pendingSuggestionId_key" ON "HireProposal"("pendingSuggestionId");

-- CreateIndex
CREATE INDEX "HireProposal_status_expiresAt_idx" ON "HireProposal"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "HireProposal_suggestionId_version_key" ON "HireProposal"("suggestionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Interview_activeSuggestionId_key" ON "Interview"("activeSuggestionId");

-- CreateIndex
CREATE INDEX "Interview_outcome_idx" ON "Interview"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "Placement_suggestionId_key" ON "Placement"("suggestionId");

-- CreateIndex
CREATE UNIQUE INDEX "Placement_hireProposalId_key" ON "Placement"("hireProposalId");

-- AddForeignKey
ALTER TABLE "HireProposal" ADD CONSTRAINT "HireProposal_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "MatchSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "MatchSuggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_hireProposalId_fkey" FOREIGN KEY ("hireProposalId") REFERENCES "HireProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
