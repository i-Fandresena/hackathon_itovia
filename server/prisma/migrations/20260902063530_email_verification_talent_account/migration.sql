-- Vérification d'email à l'inscription + compte de suivi pour les talents
-- non-diplômés (décision produit 2026-09-02, §7.3.14 inchangé : ce compte
-- n'a jamais de pouvoir d'écriture sur TalentProfile).

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'talent';

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "token" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_token_key" ON "EmailVerification"("token");

-- CreateIndex
CREATE INDEX "EmailVerification_email_idx" ON "EmailVerification"("email");

-- CreateTable
CREATE TABLE "TalentAccountProfile" (
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "leadId" TEXT,
    "talentId" TEXT,

    CONSTRAINT "TalentAccountProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TalentAccountProfile_leadId_key" ON "TalentAccountProfile"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "TalentAccountProfile_talentId_key" ON "TalentAccountProfile"("talentId");

-- AddForeignKey
ALTER TABLE "TalentAccountProfile" ADD CONSTRAINT "TalentAccountProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentAccountProfile" ADD CONSTRAINT "TalentAccountProfile_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "TalentLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentAccountProfile" ADD CONSTRAINT "TalentAccountProfile_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "TalentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
