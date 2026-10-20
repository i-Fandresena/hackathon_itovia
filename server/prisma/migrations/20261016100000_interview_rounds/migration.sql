-- Sous-lot 1 « après l'entretien » — temps B (contract), 2026-10-16.
-- Retire la contrainte « un entretien par dossier » au profit de « un tour
-- par numéro et par dossier ». L'unicité du tour ACTIF reste garantie par
-- "Interview_activeSuggestionId_key" (temps A).
--
-- À appliquer SEULEMENT avec un client Prisma régénéré (npm run
-- prisma:generate) : le code écrit alors "activeSuggestionId" à chaque
-- création de tour. Avec un client antérieur, ce code ne renseigne pas la
-- colonne (la réparation au démarrage la remplit ensuite) et la création
-- d'un entretien s'appuie, en plus de son verrou de ligne, sur l'ancienne
-- contrainte que ce fichier supprime.

-- DropIndex
DROP INDEX "Interview_suggestionId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Interview_suggestionId_round_key" ON "Interview"("suggestionId", "round");
