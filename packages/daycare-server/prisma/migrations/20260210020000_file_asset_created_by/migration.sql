-- AlterTable
ALTER TABLE "FileAsset" ADD COLUMN "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "FileAsset_createdByUserId_idx" ON "FileAsset"("createdByUserId");

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
