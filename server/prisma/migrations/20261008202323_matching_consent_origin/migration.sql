-- CreateEnum
CREATE TYPE "MatchSuggestionOrigin" AS ENUM ('systeme', 'admin');

-- AlterEnum
ALTER TYPE "MatchSuggestionStatus" ADD VALUE 'suggeree';

-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "matchingConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MatchSuggestion" ADD COLUMN     "origin" "MatchSuggestionOrigin" NOT NULL DEFAULT 'admin';
