-- CreateEnum
CREATE TYPE "NcType" AS ENUM ('QUALITE', 'SECURITE', 'ENVIRONNEMENT');

-- CreateEnum
CREATE TYPE "NcSeverity" AS ENUM ('MINEURE', 'MAJEURE', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "NcStatus" AS ENUM ('OUVERTE', 'EN_COURS', 'CLOTUREE');

-- CreateEnum
CREATE TYPE "AvenantStatus" AS ENUM ('EN_COURS', 'SIGNE', 'REFUSE');

-- CreateEnum
CREATE TYPE "DefenseTrend" AS ENUM ('HAUSSE', 'STABLE', 'BAISSE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'AVENANT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'AVENANT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'AVENANT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'NC_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'NC_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'NC_CLOSED';

-- CreateTable
CREATE TABLE "Avenant" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "avenantNumber" INTEGER NOT NULL,
    "signedAt" TIMESTAMP(3),
    "nature" TEXT NOT NULL,
    "deltaAmountHt" DECIMAL(14,2),
    "deltaDelayDays" INTEGER,
    "status" "AvenantStatus" NOT NULL DEFAULT 'EN_COURS',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Avenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NonConformite" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "projectId" TEXT,
    "ncType" "NcType" NOT NULL,
    "severity" "NcSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "status" "NcStatus" NOT NULL DEFAULT 'OUVERTE',
    "closedAt" TIMESTAMP(3),
    "scoreImpact" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NonConformite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketScoreWeight" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "metricCode" TEXT NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketScoreWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketDefenseNote" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "metricCode" TEXT NOT NULL,
    "justification" TEXT,
    "actionPlan" TEXT,
    "trend" "DefenseTrend" NOT NULL DEFAULT 'STABLE',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketDefenseNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Avenant_marketId_idx" ON "Avenant"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Avenant_marketId_avenantNumber_key" ON "Avenant"("marketId", "avenantNumber");

-- CreateIndex
CREATE INDEX "NonConformite_marketId_idx" ON "NonConformite"("marketId");

-- CreateIndex
CREATE INDEX "NonConformite_status_idx" ON "NonConformite"("status");

-- CreateIndex
CREATE INDEX "MarketScoreWeight_marketId_idx" ON "MarketScoreWeight"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketScoreWeight_marketId_metricCode_key" ON "MarketScoreWeight"("marketId", "metricCode");

-- CreateIndex
CREATE INDEX "MarketDefenseNote_marketId_idx" ON "MarketDefenseNote"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketDefenseNote_marketId_metricCode_key" ON "MarketDefenseNote"("marketId", "metricCode");

-- AddForeignKey
ALTER TABLE "Avenant" ADD CONSTRAINT "Avenant_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avenant" ADD CONSTRAINT "Avenant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformite" ADD CONSTRAINT "NonConformite_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformite" ADD CONSTRAINT "NonConformite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformite" ADD CONSTRAINT "NonConformite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketScoreWeight" ADD CONSTRAINT "MarketScoreWeight_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketDefenseNote" ADD CONSTRAINT "MarketDefenseNote_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
