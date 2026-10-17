-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('planifie', 'confirme', 'empechement', 'annule');

-- CreateEnum
CREATE TYPE "InterviewProvider" AS ENUM ('google', 'simule');

-- CreateEnum
CREATE TYPE "InterviewMeetStatus" AS ENUM ('disponible', 'en_attente', 'simule');

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "message" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'planifie',
    "provider" "InterviewProvider" NOT NULL,
    "meetStatus" "InterviewMeetStatus" NOT NULL,
    "meetUrl" TEXT,
    "googleEventId" TEXT,
    "calendarError" TEXT,
    "declineReason" TEXT,
    "respondedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Interview_suggestionId_key" ON "Interview"("suggestionId");

-- CreateIndex
CREATE INDEX "Interview_status_idx" ON "Interview"("status");

-- CreateIndex
CREATE INDEX "Interview_meetStatus_idx" ON "Interview"("meetStatus");

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "MatchSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

