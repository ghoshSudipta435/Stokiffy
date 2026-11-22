-- Migration: add_watchlists_and_rulesets
-- Creates Watchlist, WatchlistItem, RuleSet, and IndustryBenchmark tables
-- Adds review column to JournalEntry

-- CreateTable Watchlist
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable WatchlistItem
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "notes" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable RuleSet
CREATE TABLE "RuleSet" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "configJson" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable IndustryBenchmark
CREATE TABLE "IndustryBenchmark" (
    "id" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "opmMinPct" DECIMAL(65,30),
    "opmMaxPct" DECIMAL(65,30),
    "typicalPE" DECIMAL(65,30),
    "minRoaPct" DECIMAL(65,30),
    "sourceNote" TEXT,

    CONSTRAINT "IndustryBenchmark_pkey" PRIMARY KEY ("id")
);

-- AlterTable JournalEntry add review
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "review" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_name_key" ON "Watchlist"("userId", "name");
CREATE INDEX "Watchlist_userId_idx" ON "Watchlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_watchlistId_companyId_key" ON "WatchlistItem"("watchlistId", "companyId");
CREATE INDEX "WatchlistItem_watchlistId_idx" ON "WatchlistItem"("watchlistId");
CREATE INDEX "WatchlistItem_companyId_idx" ON "WatchlistItem"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSet_version_key" ON "RuleSet"("version");
CREATE INDEX "RuleSet_status_idx" ON "RuleSet"("status");
CREATE INDEX "RuleSet_version_idx" ON "RuleSet"("version");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryBenchmark_ruleSetId_industry_key" ON "IndustryBenchmark"("ruleSetId", "industry");
CREATE INDEX "IndustryBenchmark_ruleSetId_idx" ON "IndustryBenchmark"("ruleSetId");
CREATE INDEX "IndustryBenchmark_industry_idx" ON "IndustryBenchmark"("industry");

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryBenchmark" ADD CONSTRAINT "IndustryBenchmark_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
