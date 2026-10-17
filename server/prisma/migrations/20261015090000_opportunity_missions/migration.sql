-- Missions des offres (liste ordonnée, facultative) : colonne ajoutée avec
-- une valeur par défaut. Migration purement additive : aucune donnée
-- existante modifiée, les offres existantes reçoivent une liste vide.
ALTER TABLE "Opportunity" ADD COLUMN     "missions" TEXT[] DEFAULT ARRAY[]::TEXT[];
