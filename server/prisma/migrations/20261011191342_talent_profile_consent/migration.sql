-- AlterTable
ALTER TABLE "TalentProfile" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "district" TEXT,
ADD COLUMN     "phoneKey" TEXT;

-- CreateIndex
CREATE INDEX "TalentProfile_phoneKey_idx" ON "TalentProfile"("phoneKey");

-- Remplissage de "phoneKey" pour les profils existants, même règle que
-- `phoneKeyOf()` (server/src/lib/validation.ts) : chiffres seulement, `261`
-- ou `0` initial retiré, valide seulement s'il reste exactement 9 chiffres.
-- "consentAt" reste NULL : accord non tracé (profil antérieur).
UPDATE "TalentProfile" AS t
SET "phoneKey" = CASE WHEN length(s.stripped) = 9 THEN s.stripped ELSE NULL END
FROM (
  SELECT "id",
    CASE
      WHEN d LIKE '261%' THEN substr(d, 4)
      WHEN d LIKE '0%' THEN substr(d, 2)
      ELSE d
    END AS stripped
  FROM (SELECT "id", regexp_replace("phone", '\D', '', 'g') AS d FROM "TalentProfile") AS digits
) AS s
WHERE s."id" = t."id";
