-- Migration: 20261115000000_init
-- Baseline database schema for Stokiffy

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isin" TEXT,
    "sector" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialStatement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "fiscalQuarter" TEXT,
    "revenue" DECIMAL(65,30),
    "netProfit" DECIMAL(65,30),
    "operatingProfit" DECIMAL(65,30),
    "totalAssets" DECIMAL(65,30),
    "totalLiabilities" DECIMAL(65,30),
    "totalEquity" DECIMAL(65,30),
    "totalDebt" DECIMAL(65,30),
    "currentAssets" DECIMAL(65,30),
    "currentLiabilities" DECIMAL(65,30),
    "interestExpense" DECIMAL(65,30),
    "ebit" DECIMAL(65,30),
    "eps" DECIMAL(65,30),
    "depreciationAmortization" DECIMAL(65,30),
    "capitalExpenditure" DECIMAL(65,30),
    "changeInWorkingCapital" DECIMAL(65,30),
    "fcf" DECIMAL(65,30),
    "dividendPerShare" DECIMAL(65,30),
    "sharesOutstanding" DECIMAL(65,30),
    "bookValuePerShare" DECIMAL(65,30),
    "promoterPledgePct" DECIMAL(65,30),
    "relatedPartyTxn" DECIMAL(65,30),
    "auditorQualification" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "unit" TEXT NOT NULL DEFAULT 'CRORE',
    "adjustmentStatus" TEXT NOT NULL DEFAULT 'reported',
    "quality" TEXT NOT NULL DEFAULT 'verified',
    "isMissing" BOOLEAN NOT NULL DEFAULT false,
    "sourceDocumentRef" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "reportedPeriod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBar" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(65,30) NOT NULL,
    "high" DECIMAL(65,30) NOT NULL,
    "low" DECIMAL(65,30) NOT NULL,
    "close" DECIMAL(65,30) NOT NULL,
    "volume" BIGINT NOT NULL,
    "adjusted" BOOLEAN NOT NULL DEFAULT false,
    "corporateActionType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceBar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateAction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ratio" TEXT,
    "amount" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorporateAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shareholding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "promoterPct" DECIMAL(65,30) NOT NULL,
    "fiiPct" DECIMAL(65,30) NOT NULL,
    "diiPct" DECIMAL(65,30) NOT NULL,
    "publicPct" DECIMAL(65,30) NOT NULL,
    "promoterPledgePct" DECIMAL(65,30),
    "dataQuality" TEXT NOT NULL DEFAULT 'verified',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shareholding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "totalPoints" DECIMAL(65,30) NOT NULL,
    "maxPoints" DECIMAL(65,30) NOT NULL,
    "verdict" TEXT NOT NULL,
    "ruleSetVersion" TEXT NOT NULL,
    "dataSnapshotId" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisStageA" (
    "id" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "maxPossibleScore" DECIMAL(65,30) NOT NULL,
    "minPassScore" DECIMAL(65,30) NOT NULL,
    "bankVariant" BOOLEAN NOT NULL DEFAULT false,
    "unsuitableRules" JSONB,

    CONSTRAINT "AnalysisStageA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisStageB" (
    "id" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "quarterlySalesTrend" TEXT NOT NULL,
    "quarterlyOpmTrend" TEXT NOT NULL,
    "annualSales5yTrend" TEXT NOT NULL,
    "annualOpm5yTrend" TEXT NOT NULL,
    "netProfitTrend" TEXT NOT NULL,
    "reservesBorrowingsTrend" TEXT NOT NULL,
    "cfoTrend" TEXT NOT NULL,
    "debtorDaysTrend" TEXT NOT NULL,
    "roceTrend" TEXT NOT NULL,
    "shareholdingScore" DECIMAL(65,30) NOT NULL,
    "shareholdingHardFlags" JSONB NOT NULL,

    CONSTRAINT "AnalysisStageB_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisStageC" (
    "id" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "moatScore" DECIMAL(65,30) NOT NULL,
    "moatPass" BOOLEAN NOT NULL,
    "businessModelComplete" BOOLEAN NOT NULL,
    "overallConfidence" TEXT NOT NULL,

    CONSTRAINT "AnalysisStageC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisStageD" (
    "id" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "primaryMethod" TEXT NOT NULL,
    "fairValue" DECIMAL(65,30) NOT NULL,
    "valuationRangeLow" DECIMAL(65,30) NOT NULL,
    "valuationRangeHigh" DECIMAL(65,30) NOT NULL,
    "maxBuyPrice" DECIMAL(65,30) NOT NULL,
    "marginOfSafetyPct" DECIMAL(65,30) NOT NULL,
    "buyReady" BOOLEAN NOT NULL,
    "confidence" TEXT NOT NULL,

    CONSTRAINT "AnalysisStageD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisStageE" (
    "id" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "currentPrice" DECIMAL(65,30) NOT NULL,
    "maxBuyPrice" DECIMAL(65,30) NOT NULL,
    "inBuyZone" BOOLEAN NOT NULL,
    "distanceToMaxBuyPct" DECIMAL(65,30) NOT NULL,
    "dailyTrend" TEXT NOT NULL,
    "weeklyTrend" TEXT NOT NULL,
    "volumeProfile" TEXT NOT NULL,
    "rsVsBenchmark" TEXT NOT NULL,

    CONSTRAINT "AnalysisStageE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisStageF" (
    "id" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "positionSize" DECIMAL(65,30) NOT NULL,
    "riskBudget" DECIMAL(65,30) NOT NULL,
    "portfolioExposurePct" DECIMAL(65,30) NOT NULL,
    "sectorExposurePct" DECIMAL(65,30) NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "ruleSetVersion" TEXT NOT NULL,

    CONSTRAINT "AnalysisStageF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisStageG" (
    "id" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "concentrationOk" BOOLEAN NOT NULL,
    "drawdownOk" BOOLEAN NOT NULL,
    "cashBufferOk" BOOLEAN NOT NULL,
    "correlationRisk" TEXT NOT NULL,

    CONSTRAINT "AnalysisStageG_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedFlag" (
    "id" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "flagKey" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "ruleKey" TEXT,
    "class" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "message" TEXT NOT NULL,
    "threshold" TEXT NOT NULL,
    "actualValue" JSONB NOT NULL,
    "expectedValue" JSONB,
    "source" TEXT NOT NULL,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "originalFlagId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "acknowledgedReason" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "overriddenBy" TEXT,
    "overrideReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionReason" TEXT,

    CONSTRAINT "RedFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlagOverride" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "beforeState" JSONB NOT NULL,
    "afterState" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlagOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradePlan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "expectedHoldingPeriod" TEXT NOT NULL,
    "entryRationale" TEXT NOT NULL,
    "entryZoneLow" DECIMAL(65,30) NOT NULL,
    "entryZoneHigh" DECIMAL(65,30) NOT NULL,
    "stopLoss" DECIMAL(65,30) NOT NULL,
    "targets" JSONB NOT NULL,
    "positionSize" DECIMAL(65,30) NOT NULL,
    "entryPriceEst" DECIMAL(65,30) NOT NULL,
    "riskBudget" DECIMAL(65,30) NOT NULL,
    "plannedLossAtStop" DECIMAL(65,30) NOT NULL,
    "portfolioExposurePct" DECIMAL(65,30) NOT NULL,
    "sectorExposurePct" DECIMAL(65,30) NOT NULL,
    "cashRemaining" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "ruleSetVersion" TEXT NOT NULL,
    "valuationMaxBuyPrice" DECIMAL(65,30) NOT NULL,
    "technicalSetupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "executedPrice" DECIMAL(65,30),
    "executedQuantity" DECIMAL(65,30),

    CONSTRAINT "TradePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradePlanOverride" (
    "id" TEXT NOT NULL,
    "tradePlanId" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "overriddenBy" TEXT NOT NULL,
    "beforeState" JSONB NOT NULL,
    "afterState" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradePlanOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "avgPrice" DECIMAL(65,30) NOT NULL,
    "currentPrice" DECIMAL(65,30) NOT NULL,
    "marketValue" DECIMAL(65,30) NOT NULL,
    "sector" TEXT NOT NULL,
    "unrealisedPnl" DECIMAL(65,30) NOT NULL,
    "unrealisedPnlPct" DECIMAL(65,30) NOT NULL,
    "stopLoss" DECIMAL(65,30) NOT NULL,
    "targets" JSONB NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "companyId" TEXT NOT NULL,
    "tradePlanId" TEXT,
    "action" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "fees" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxes" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "tradePlanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "action" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "fees" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxes" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "ruleTriggers" JSONB NOT NULL,
    "realisedPnl" DECIMAL(65,30),
    "unrealisedPnl" DECIMAL(65,30),
    "returnPct" DECIMAL(65,30),
    "corporateActions" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "companyId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "data" JSONB NOT NULL,
    "relatedTradePlanId" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "reason" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "financials" JSONB NOT NULL,
    "marketData" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Company_userId_idx" ON "Company"("userId");

-- CreateIndex
CREATE INDEX "Company_symbol_idx" ON "Company"("symbol");

-- CreateIndex
CREATE INDEX "Company_userId_symbol_idx" ON "Company"("userId", "symbol");

-- CreateIndex
CREATE INDEX "FinancialStatement_companyId_idx" ON "FinancialStatement"("companyId");

-- CreateIndex
CREATE INDEX "FinancialStatement_companyId_periodType_fiscalYear_fiscalQu_idx" ON "FinancialStatement"("companyId", "periodType", "fiscalYear", "fiscalQuarter");

-- CreateIndex
CREATE INDEX "FinancialStatement_reportedPeriod_idx" ON "FinancialStatement"("reportedPeriod");

-- CreateIndex
CREATE INDEX "PriceBar_companyId_idx" ON "PriceBar"("companyId");

-- CreateIndex
CREATE INDEX "PriceBar_companyId_date_idx" ON "PriceBar"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBar_companyId_date_key" ON "PriceBar"("companyId", "date");

-- CreateIndex
CREATE INDEX "CorporateAction_companyId_idx" ON "CorporateAction"("companyId");

-- CreateIndex
CREATE INDEX "CorporateAction_companyId_date_idx" ON "CorporateAction"("companyId", "date");

-- CreateIndex
CREATE INDEX "Shareholding_companyId_idx" ON "Shareholding"("companyId");

-- CreateIndex
CREATE INDEX "Shareholding_companyId_period_idx" ON "Shareholding"("companyId", "period");

-- CreateIndex
CREATE INDEX "AnalysisRun_companyId_idx" ON "AnalysisRun"("companyId");

-- CreateIndex
CREATE INDEX "AnalysisRun_userId_idx" ON "AnalysisRun"("userId");

-- CreateIndex
CREATE INDEX "AnalysisRun_companyId_stage_idx" ON "AnalysisRun"("companyId", "stage");

-- CreateIndex
CREATE INDEX "AnalysisRun_ruleSetVersion_idx" ON "AnalysisRun"("ruleSetVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisStageA_analysisRunId_key" ON "AnalysisStageA"("analysisRunId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisStageB_analysisRunId_key" ON "AnalysisStageB"("analysisRunId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisStageC_analysisRunId_key" ON "AnalysisStageC"("analysisRunId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisStageD_analysisRunId_key" ON "AnalysisStageD"("analysisRunId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisStageE_analysisRunId_key" ON "AnalysisStageE"("analysisRunId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisStageF_analysisRunId_key" ON "AnalysisStageF"("analysisRunId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisStageG_analysisRunId_key" ON "AnalysisStageG"("analysisRunId");

-- CreateIndex
CREATE INDEX "RedFlag_analysisRunId_idx" ON "RedFlag"("analysisRunId");

-- CreateIndex
CREATE INDEX "RedFlag_companyId_idx" ON "RedFlag"("companyId");

-- CreateIndex
CREATE INDEX "RedFlag_status_idx" ON "RedFlag"("status");

-- CreateIndex
CREATE INDEX "RedFlag_class_idx" ON "RedFlag"("class");

-- CreateIndex
CREATE INDEX "FlagOverride_flagId_idx" ON "FlagOverride"("flagId");

-- CreateIndex
CREATE INDEX "FlagOverride_userId_idx" ON "FlagOverride"("userId");

-- CreateIndex
CREATE INDEX "FlagOverride_decision_idx" ON "FlagOverride"("decision");

-- CreateIndex
CREATE INDEX "TradePlan_userId_idx" ON "TradePlan"("userId");

-- CreateIndex
CREATE INDEX "TradePlan_companyId_idx" ON "TradePlan"("companyId");

-- CreateIndex
CREATE INDEX "TradePlan_status_idx" ON "TradePlan"("status");

-- CreateIndex
CREATE INDEX "TradePlanOverride_tradePlanId_idx" ON "TradePlanOverride"("tradePlanId");

-- CreateIndex
CREATE INDEX "PortfolioHolding_userId_idx" ON "PortfolioHolding"("userId");

-- CreateIndex
CREATE INDEX "PortfolioHolding_companyId_idx" ON "PortfolioHolding"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_companyId_idx" ON "Transaction"("companyId");

-- CreateIndex
CREATE INDEX "Transaction_idempotencyKey_idx" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "JournalEntry_tradePlanId_idx" ON "JournalEntry"("tradePlanId");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_idx" ON "JournalEntry"("userId");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- CreateIndex
CREATE INDEX "Alert_companyId_idx" ON "Alert"("companyId");

-- CreateIndex
CREATE INDEX "Alert_triggeredAt_idx" ON "Alert"("triggeredAt");

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE INDEX "AuditEvent_userId_idx" ON "AuditEvent"("userId");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "DataSnapshot_companyId_idx" ON "DataSnapshot"("companyId");

-- CreateIndex
CREATE INDEX "DataSnapshot_asOfDate_idx" ON "DataSnapshot"("asOfDate");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStatement" ADD CONSTRAINT "FinancialStatement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBar" ADD CONSTRAINT "PriceBar_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateAction" ADD CONSTRAINT "CorporateAction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shareholding" ADD CONSTRAINT "Shareholding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisStageA" ADD CONSTRAINT "AnalysisStageA_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisStageB" ADD CONSTRAINT "AnalysisStageB_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisStageC" ADD CONSTRAINT "AnalysisStageC_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisStageD" ADD CONSTRAINT "AnalysisStageD_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisStageE" ADD CONSTRAINT "AnalysisStageE_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisStageF" ADD CONSTRAINT "AnalysisStageF_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisStageG" ADD CONSTRAINT "AnalysisStageG_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedFlag" ADD CONSTRAINT "RedFlag_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlagOverride" ADD CONSTRAINT "FlagOverride_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "RedFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlagOverride" ADD CONSTRAINT "FlagOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradePlan" ADD CONSTRAINT "TradePlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradePlan" ADD CONSTRAINT "TradePlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradePlanOverride" ADD CONSTRAINT "TradePlanOverride_tradePlanId_fkey" FOREIGN KEY ("tradePlanId") REFERENCES "TradePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioHolding" ADD CONSTRAINT "PortfolioHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioHolding" ADD CONSTRAINT "PortfolioHolding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tradePlanId_fkey" FOREIGN KEY ("tradePlanId") REFERENCES "TradePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_tradePlanId_fkey" FOREIGN KEY ("tradePlanId") REFERENCES "TradePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSnapshot" ADD CONSTRAINT "DataSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
