-- Listes « Entretiens » (recruteur, admin) : tri et filtres par date.
-- Migration purement additive : un index, aucune donnée modifiée.
CREATE INDEX "Interview_scheduledAt_idx" ON "Interview"("scheduledAt");
