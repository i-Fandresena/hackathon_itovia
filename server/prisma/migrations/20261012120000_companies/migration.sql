-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'company';

-- AlterTable
ALTER TABLE "Endorsement" ADD COLUMN     "companyId" TEXT;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "sector" "Sector" NOT NULL DEFAULT 'autre',
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "recruiterUserId" TEXT,
    "createdByMemberId" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "hiddenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_recruiterUserId_key" ON "Company"("recruiterUserId");

-- CreateIndex
CREATE INDEX "Company_nameKey_idx" ON "Company"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "Company_nameKey_city_key" ON "Company"("nameKey", "city");

-- CreateIndex
CREATE UNIQUE INDEX "Endorsement_companyId_authorMemberId_key" ON "Endorsement"("companyId", "authorMemberId");

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_recruiterUserId_fkey" FOREIGN KEY ("recruiterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

