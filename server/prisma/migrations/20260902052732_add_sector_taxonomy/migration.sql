-- Taxonomie secteur/métier transversale (filtre, jamais une section de
-- navigation séparée) + demande de contact "non-diplômé" en self-service.

-- CreateEnum
CREATE TYPE "Sector" AS ENUM ('btp', 'textile_artisanat', 'digital', 'agroalimentaire', 'services_commerce', 'autre');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('nouveau', 'contacte', 'converti', 'ignore');

-- AlterTable: CandidateProfile — tag de filtrage optionnel
ALTER TABLE "CandidateProfile" ADD COLUMN "sector" "Sector";

-- AlterTable: RecruiterProfile.sector : text libre -> enum, avec backfill
-- des valeurs existantes plutôt qu'un drop-and-recreate (perte de données).
ALTER TABLE "RecruiterProfile" ADD COLUMN "sector_new" "Sector" NOT NULL DEFAULT 'autre';

UPDATE "RecruiterProfile" SET "sector_new" = CASE "sector"
  WHEN 'IT / Digital' THEN 'digital'
  WHEN 'Design / Communication' THEN 'digital'
  WHEN 'Plateforme freelance' THEN 'digital'
  WHEN 'Logistique / Portuaire' THEN 'services_commerce'
  WHEN 'Commerce / Distribution' THEN 'services_commerce'
  WHEN 'Services administratifs' THEN 'services_commerce'
  WHEN 'Tourisme' THEN 'services_commerce'
  WHEN 'Logistique / Livraison' THEN 'services_commerce'
  ELSE 'autre'
END::"Sector";

ALTER TABLE "RecruiterProfile" DROP COLUMN "sector";
ALTER TABLE "RecruiterProfile" RENAME COLUMN "sector_new" TO "sector";

-- AlterTable: Opportunity — nouveau champ requis, backfill depuis category.
ALTER TABLE "Opportunity" ADD COLUMN "sector" "Sector" NOT NULL DEFAULT 'autre';

UPDATE "Opportunity" SET "sector" = CASE "category"
  WHEN 'Marketing' THEN 'digital'
  WHEN 'IT / Digital' THEN 'digital'
  WHEN 'Design' THEN 'digital'
  WHEN 'Community management' THEN 'digital'
  WHEN 'Saisie de données' THEN 'digital'
  WHEN 'Services freelance' THEN 'digital'
  WHEN 'Administration' THEN 'services_commerce'
  WHEN 'Ventes' THEN 'services_commerce'
  WHEN 'Logistique' THEN 'services_commerce'
  ELSE 'autre'
END::"Sector";

-- AlterTable: TalentProfile — métier déclaré (pilote la grille standardisée).
ALTER TABLE "TalentProfile" ADD COLUMN "trade" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TalentProfile" ADD COLUMN "sector" "Sector" NOT NULL DEFAULT 'autre';

-- CreateTable: demande de contact "non-diplômé" en self-service — ne crée
-- jamais de TalentProfile directement (§7.3.14), voir server/src/routes/public.routes.ts.
CREATE TABLE "TalentLead" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "trade" TEXT NOT NULL,
    "sector" "Sector" NOT NULL,
    "message" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'nouveau',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TalentLead_status_idx" ON "TalentLead"("status");
