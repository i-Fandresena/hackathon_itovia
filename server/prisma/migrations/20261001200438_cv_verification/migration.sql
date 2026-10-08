-- CreateEnum
CREATE TYPE "CvVerificationStatus" AS ENUM ('non_verifie', 'verifie', 'rejete');

-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "cvAttestedAt" TIMESTAMP(3),
ADD COLUMN     "cvFileHash" TEXT,
ADD COLUMN     "cvFlags" JSONB,
ADD COLUMN     "cvVerificationNote" TEXT,
ADD COLUMN     "cvVerificationStatus" "CvVerificationStatus" NOT NULL DEFAULT 'non_verifie',
ADD COLUMN     "cvVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "cvVerifiedById" TEXT;

-- CreateTable
CREATE TABLE "CvSubmission" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "flags" JSONB NOT NULL,
    "attestedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvVerification" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "verifierId" TEXT NOT NULL,
    "decision" "CvVerificationStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvVerifierRole" (
    "role" "UserRole" NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvVerifierRole_pkey" PRIMARY KEY ("role")
);

-- CreateIndex
CREATE INDEX "CvSubmission_candidateId_idx" ON "CvSubmission"("candidateId");

-- CreateIndex
CREATE INDEX "CvSubmission_fileHash_idx" ON "CvSubmission"("fileHash");

-- CreateIndex
CREATE INDEX "CvVerification_candidateId_idx" ON "CvVerification"("candidateId");

-- AddForeignKey
ALTER TABLE "CvSubmission" ADD CONSTRAINT "CvSubmission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvVerification" ADD CONSTRAINT "CvVerification_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvVerification" ADD CONSTRAINT "CvVerification_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
