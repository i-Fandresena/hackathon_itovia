-- Champs additionnels conditionnels par secteur sur une offre (ex. outils/
-- chantier/transport pour le BTP, stack technique/télétravail pour le
-- digital) — colonne nullable, même pattern que TalentVerification.checklist.

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "sectorDetails" JSONB;
