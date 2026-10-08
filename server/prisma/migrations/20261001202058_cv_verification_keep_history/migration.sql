-- DropForeignKey
ALTER TABLE "CvVerification" DROP CONSTRAINT "CvVerification_verifierId_fkey";

-- AlterTable
ALTER TABLE "CvVerification" ALTER COLUMN "verifierId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CvVerification" ADD CONSTRAINT "CvVerification_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
