-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('MARKET_CREATED', 'MARKET_UPDATED', 'MARKET_ARCHIVED', 'ALERT_CLOSED', 'ALERT_RECALCULATED', 'ANALYSIS_STARTED', 'ANALYSIS_VALIDATED', 'DOCUMENT_UPLOADED', 'DOCUMENT_VERIFIED', 'SCORE_CALCULATED', 'ACTION_CREATED', 'ACTION_UPDATED', 'EVENT_CREATED', 'USER_LOGIN');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "marketId" TEXT,
    "label" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_marketId_idx" ON "AuditLog"("marketId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;
