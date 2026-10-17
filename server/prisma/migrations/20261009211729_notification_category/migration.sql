-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('candidat', 'recruteur', 'agent', 'systeme', 'moderation', 'annuaire');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "category" "NotificationCategory";
