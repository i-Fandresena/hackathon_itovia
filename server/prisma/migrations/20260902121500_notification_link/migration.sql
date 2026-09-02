-- Notifications cliquables : chaque notification porte le chemin frontend
-- vers sa source (message, offre, ...) plutôt qu'un type générique à
-- interpréter côté client.

ALTER TABLE "Notification" ADD COLUMN "link" TEXT;
