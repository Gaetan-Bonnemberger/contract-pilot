-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DIRECTEUR', 'RESPONSABLE_MARCHE', 'EXPLOITATION', 'QSE', 'LECTURE');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Criticality" AS ENUM ('FAIBLE', 'MOYEN', 'FORT', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('MINEUR', 'MAJEUR', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('A_PLANIFIER', 'EN_COURS', 'TERMINE', 'RECEPTIONNE', 'CLOTURE');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PENALITE', 'BONUS', 'INCIDENT', 'NON_CONFORMITE', 'INDEMNITE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "marketCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "lotName" TEXT,
    "marketType" TEXT NOT NULL,
    "status" "MarketStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "firmAmountHt" DECIMAL(14,2),
    "optionAmountHt" DECIMAL(14,2),
    "renewalCount" INTEGER NOT NULL DEFAULT 0,
    "qualityThreshold" DECIMAL(5,2),
    "safetyThreshold" DECIMAL(5,2),
    "consumptionThresholdYear1" DECIMAL(5,2),
    "consumptionThresholdNext" DECIMAL(5,2),
    "receptionThresholdYear1" DECIMAL(5,2),
    "receptionThresholdNext" DECIMAL(5,2),
    "responsibleUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketFile" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAnalysisRun" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "sourceFileId" TEXT,
    "status" TEXT NOT NULL,
    "rawExtractedText" TEXT,
    "llmPrompt" TEXT,
    "llmRawResponse" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ContractAnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSummary" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "executiveSummary" TEXT,
    "criticalClauses" TEXT,
    "majorRisks" TEXT,
    "financialMechanisms" TEXT,
    "clarificationsNeeded" TEXT,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClauseReference" (
    "id" TEXT NOT NULL,
    "clauseCode" TEXT NOT NULL,
    "articleRef" TEXT,
    "title" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "criticality" "Criticality" NOT NULL,
    "impactType" TEXT,
    "defaultEvidence" TEXT,
    "defaultAlertType" TEXT,
    "defaultPenaltyFormula" TEXT,
    "defaultBonusFormula" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClauseReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketClause" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "clauseReferenceId" TEXT,
    "articleRef" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "criticality" "Criticality" NOT NULL,
    "isContractual" BOOLEAN NOT NULL DEFAULT true,
    "requiresFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketClause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiReference" (
    "id" TEXT NOT NULL,
    "kpiCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kpiType" TEXT NOT NULL,
    "description" TEXT,
    "formulaLogic" TEXT,
    "unit" TEXT,
    "frequency" TEXT,
    "defaultGreenThreshold" DECIMAL(10,2),
    "defaultOrangeThreshold" DECIMAL(10,2),
    "defaultRedThreshold" DECIMAL(10,2),
    "ownerRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketKpi" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "kpiReferenceId" TEXT,
    "kpiCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kpiType" TEXT NOT NULL,
    "description" TEXT,
    "formulaLogic" TEXT,
    "unit" TEXT,
    "frequency" TEXT,
    "greenThreshold" DECIMAL(10,2),
    "orangeThreshold" DECIMAL(10,2),
    "redThreshold" DECIMAL(10,2),
    "currentValue" DECIMAL(10,2),
    "targetValue" DECIMAL(10,2),
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketKpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTypeReference" (
    "id" TEXT NOT NULL,
    "docTypeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isMandatoryDefault" BOOLEAN NOT NULL DEFAULT false,
    "triggerCondition" TEXT,
    "defaultDueDays" INTEGER,
    "criticality" "Criticality" NOT NULL,
    "ownerRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTypeReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketObligation" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "clauseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "criticality" "Criticality" NOT NULL,
    "frequency" TEXT,
    "triggerCondition" TEXT,
    "expectedEvidence" TEXT,
    "dueRule" TEXT,
    "ownerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'A_FAIRE',
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "orderNumber" TEXT,
    "siteName" TEXT,
    "zoneName" TEXT,
    "plannedDate" TIMESTAMP(3),
    "performedDate" TIMESTAMP(3),
    "receptionDate" TIMESTAMP(3),
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "isUrgentLate" BOOLEAN NOT NULL DEFAULT false,
    "isDeprogrammed" BOOLEAN NOT NULL DEFAULT false,
    "deprogrammingResponsibility" TEXT,
    "damageCount" INTEGER NOT NULL DEFAULT 0,
    "topoRequired" BOOLEAN NOT NULL DEFAULT false,
    "topoDelivered" BOOLEAN NOT NULL DEFAULT false,
    "aatSigned" BOOLEAN NOT NULL DEFAULT false,
    "aatDate" TIMESTAMP(3),
    "patReceived" BOOLEAN NOT NULL DEFAULT false,
    "reelRequired" BOOLEAN NOT NULL DEFAULT false,
    "reelDelivered" BOOLEAN NOT NULL DEFAULT false,
    "drumInvolved" BOOLEAN NOT NULL DEFAULT false,
    "drumRecoveryRequestedAt" TIMESTAMP(3),
    "orderedAmountHt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "performedAmountHt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "receivedAmountHt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "ProjectStatus" NOT NULL DEFAULT 'A_PLANIFIER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "fileId" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "isValid" BOOLEAN,
    "verifiedById" TEXT,
    "lateDays" INTEGER,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketEvent" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "projectId" TEXT,
    "eventType" "EventType" NOT NULL,
    "eventSubtype" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "articleRef" TEXT,
    "amountHt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rootCause" TEXT,
    "responsibility" TEXT,
    "correctiveAction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "projectId" TEXT,
    "alertType" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "cause" TEXT,
    "responsibleUserId" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "expectedAction" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionPlan" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "alertId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL,
    "category" TEXT,
    "riskCovered" TEXT,
    "responsibleUserId" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'TODO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "expectedResult" TEXT,
    "comments" TEXT,

    CONSTRAINT "ActionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreModelLine" (
    "id" TEXT NOT NULL,
    "scoreModelId" TEXT NOT NULL,
    "metricCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "calculationRule" TEXT,
    "greenRule" TEXT,
    "orangeRule" TEXT,
    "redRule" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreModelLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketScore" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "scoreModelId" TEXT NOT NULL,
    "scoreValue" DECIMAL(5,2) NOT NULL,
    "scoreLabel" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "MarketScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Market_marketCode_key" ON "Market"("marketCode");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSummary_marketId_key" ON "MarketSummary"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSummary_analysisRunId_key" ON "MarketSummary"("analysisRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ClauseReference_clauseCode_key" ON "ClauseReference"("clauseCode");

-- CreateIndex
CREATE UNIQUE INDEX "KpiReference_kpiCode_key" ON "KpiReference"("kpiCode");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTypeReference_docTypeCode_key" ON "DocumentTypeReference"("docTypeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Project_marketId_projectCode_key" ON "Project"("marketId", "projectCode");

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketFile" ADD CONSTRAINT "MarketFile_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketFile" ADD CONSTRAINT "MarketFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAnalysisRun" ADD CONSTRAINT "ContractAnalysisRun_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAnalysisRun" ADD CONSTRAINT "ContractAnalysisRun_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "MarketFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAnalysisRun" ADD CONSTRAINT "ContractAnalysisRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSummary" ADD CONSTRAINT "MarketSummary_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSummary" ADD CONSTRAINT "MarketSummary_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "ContractAnalysisRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSummary" ADD CONSTRAINT "MarketSummary_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketClause" ADD CONSTRAINT "MarketClause_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketClause" ADD CONSTRAINT "MarketClause_clauseReferenceId_fkey" FOREIGN KEY ("clauseReferenceId") REFERENCES "ClauseReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketKpi" ADD CONSTRAINT "MarketKpi_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketKpi" ADD CONSTRAINT "MarketKpi_kpiReferenceId_fkey" FOREIGN KEY ("kpiReferenceId") REFERENCES "KpiReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketObligation" ADD CONSTRAINT "MarketObligation_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketObligation" ADD CONSTRAINT "MarketObligation_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "MarketClause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentTypeReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "MarketFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketEvent" ADD CONSTRAINT "MarketEvent_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketEvent" ADD CONSTRAINT "MarketEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreModelLine" ADD CONSTRAINT "ScoreModelLine_scoreModelId_fkey" FOREIGN KEY ("scoreModelId") REFERENCES "ScoreModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketScore" ADD CONSTRAINT "MarketScore_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketScore" ADD CONSTRAINT "MarketScore_scoreModelId_fkey" FOREIGN KEY ("scoreModelId") REFERENCES "ScoreModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
