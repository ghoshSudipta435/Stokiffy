-- Migration: make_financial_fields_nullable
-- Makes 16 core FinancialStatement Decimal columns nullable
-- Safe widening migration — no data loss, no conflict with existing non-null rows

ALTER TABLE "FinancialStatement" ALTER COLUMN "revenue" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "netProfit" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "operatingProfit" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "totalAssets" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "totalLiabilities" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "totalEquity" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "totalDebt" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "currentAssets" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "currentLiabilities" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "interestExpense" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "ebit" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "eps" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "depreciationAmortization" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "capitalExpenditure" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "changeInWorkingCapital" DROP NOT NULL;
ALTER TABLE "FinancialStatement" ALTER COLUMN "fcf" DROP NOT NULL;
