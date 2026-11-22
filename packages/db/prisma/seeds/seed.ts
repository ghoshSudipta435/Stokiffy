/**
 * Idempotent Prisma seed for @stock-assistant/db.
 *
 * Seeds (using upsert / find-or-update so re-runs never duplicate):
 *   - Default personal user (owner_user_01, matching apps/web/lib/auth.ts)
 *   - 4 Indian equities with 5 years of annual FinancialStatement + Shareholding records
 *   - An AnalysisRun + AnalysisStageA + RedFlags for the distressed company (YESBANK)
 *
 * Run:  DATABASE_URL=... pnpm --filter @stock-assistant/db db:seed
 */

import { prisma } from '../../src/client.js';

const OWNER_USER_ID = 'owner_user_01';
const OWNER_EMAIL = 'investor@stokiffy.local';
const OWNER_NAME = 'Stokiffy Investor';

const COMPANIES = [
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services Ltd.',
    isin: 'INE467B01029',
    sector: 'Information Technology',
    exchange: 'NSE',
    isinSource: 'BSE',
    statements: [
      { fiscalYear: 'FY2020', revenue: '456000', netProfit: '78000', operatingProfit: '92000', totalAssets: '240000', totalLiabilities: '85000', totalEquity: '155000', totalDebt: '6000', currentAssets: '110000', currentLiabilities: '65000', interestExpense: '500', ebit: '92500', eps: '205.00', depreciationAmortization: '11000', capitalExpenditure: '7000', changeInWorkingCapital: '-1500', fcf: '84000' },
      { fiscalYear: 'FY2021', revenue: '482000', netProfit: '84000', operatingProfit: '98000', totalAssets: '252000', totalLiabilities: '88000', totalEquity: '164000', totalDebt: '5500', currentAssets: '118000', currentLiabilities: '68000', interestExpense: '450', ebit: '98450', eps: '218.00', depreciationAmortization: '11500', capitalExpenditure: '7500', changeInWorkingCapital: '-1000', fcf: '90000' },
      { fiscalYear: 'FY2022', revenue: '510000', netProfit: '91000', operatingProfit: '106000', totalAssets: '262000', totalLiabilities: '90000', totalEquity: '172000', totalDebt: '5000', currentAssets: '125000', currentLiabilities: '70000', interestExpense: '420', ebit: '106420', eps: '235.00', depreciationAmortization: '12000', capitalExpenditure: '8000', changeInWorkingCapital: '0', fcf: '98000' },
      { fiscalYear: 'FY2023', revenue: '560000', netProfit: '102000', operatingProfit: '118000', totalAssets: '275000', totalLiabilities: '93000', totalEquity: '182000', totalDebt: '6000', currentAssets: '135000', currentLiabilities: '75000', interestExpense: '380', ebit: '118380', eps: '265.00', depreciationAmortization: '12500', capitalExpenditure: '8500', changeInWorkingCapital: '1500', fcf: '109000' },
      { fiscalYear: 'FY2024', revenue: '612000', netProfit: '138000', operatingProfit: '148000', totalAssets: '285000', totalLiabilities: '95000', totalEquity: '190000', totalDebt: '8000', currentAssets: '140000', currentLiabilities: '60000', interestExpense: '400', ebit: '148400', eps: '370.00', depreciationAmortization: '13000', capitalExpenditure: '9000', changeInWorkingCapital: '3000', fcf: '129000' },
    ],
    shareholdings: [
      { period: 'FY2020', promoterPct: '72.5', fiiPct: '11.0', diiPct: '10.5', publicPct: '6.0' },
      { period: 'FY2021', promoterPct: '72.3', fiiPct: '11.5', diiPct: '10.2', publicPct: '6.0' },
      { period: 'FY2022', promoterPct: '72.1', fiiPct: '12.0', diiPct: '10.0', publicPct: '5.9' },
      { period: 'FY2023', promoterPct: '72.0', fiiPct: '12.5', diiPct: '9.8', publicPct: '5.7' },
      { period: 'FY2024', promoterPct: '71.8', fiiPct: '13.0', diiPct: '9.5', publicPct: '5.7' },
    ],
  },
  {
    symbol: 'HINDUNILVR',
    name: 'Hindustan Unilever Ltd.',
    isin: 'INE030A01027',
    sector: 'FMCG',
    exchange: 'NSE',
    statements: [
      { fiscalYear: 'FY2020', revenue: '380000', netProfit: '62000', operatingProfit: '70000', totalAssets: '110000', totalLiabilities: '55000', totalEquity: '55000', totalDebt: '4000', currentAssets: '55000', currentLiabilities: '42000', interestExpense: '150', ebit: '70150', eps: '255.00', depreciationAmortization: '3500', capitalExpenditure: '2500', changeInWorkingCapital: '-500', fcf: '67000' },
      { fiscalYear: 'FY2021', revenue: '410000', netProfit: '68000', operatingProfit: '77000', totalAssets: '120000', totalLiabilities: '58000', totalEquity: '62000', totalDebt: '3800', currentAssets: '60000', currentLiabilities: '45000', interestExpense: '140', ebit: '77140', eps: '280.00', depreciationAmortization: '3700', capitalExpenditure: '2700', changeInWorkingCapital: '-300', fcf: '74000' },
      { fiscalYear: 'FY2022', revenue: '440000', netProfit: '75000', operatingProfit: '85000', totalAssets: '128000', totalLiabilities: '62000', totalEquity: '66000', totalDebt: '3500', currentAssets: '65000', currentLiabilities: '48000', interestExpense: '130', ebit: '85130', eps: '310.00', depreciationAmortization: '3900', capitalExpenditure: '2900', changeInWorkingCapital: '200', fcf: '81000' },
      { fiscalYear: 'FY2023', revenue: '480000', netProfit: '84000', operatingProfit: '95000', totalAssets: '135000', totalLiabilities: '65000', totalEquity: '70000', totalDebt: '4000', currentAssets: '70000', currentLiabilities: '52000', interestExpense: '180', ebit: '95180', eps: '345.00', depreciationAmortization: '4000', capitalExpenditure: '3100', changeInWorkingCapital: '1000', fcf: '90000' },
      { fiscalYear: 'FY2024', revenue: '530000', netProfit: '92000', operatingProfit: '105000', totalAssets: '140000', totalLiabilities: '70000', totalEquity: '70000', totalDebt: '5000', currentAssets: '70000', currentLiabilities: '50000', interestExpense: '200', ebit: '105200', eps: '380.00', depreciationAmortization: '4000', capitalExpenditure: '3000', changeInWorkingCapital: '-1000', fcf: '99000' },
    ],
    shareholdings: [
      { period: 'FY2020', promoterPct: '67.2', fiiPct: '14.5', diiPct: '10.3', publicPct: '8.0' },
      { period: 'FY2021', promoterPct: '67.1', fiiPct: '14.8', diiPct: '10.1', publicPct: '8.0' },
      { period: 'FY2022', promoterPct: '67.0', fiiPct: '15.0', diiPct: '10.0', publicPct: '8.0' },
      { period: 'FY2023', promoterPct: '67.0', fiiPct: '15.2', diiPct: '9.8', publicPct: '8.0' },
      { period: 'FY2024', promoterPct: '67.0', fiiPct: '15.0', diiPct: '10.0', publicPct: '8.0' },
    ],
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    isin: 'INE040A01034',
    sector: 'Financial Services',
    exchange: 'NSE',
    statements: [
      { fiscalYear: 'FY2020', revenue: '220000', netProfit: '42000', operatingProfit: '90000', totalAssets: '3000000', totalLiabilities: '2750000', totalEquity: '250000', totalDebt: '500000', currentAssets: '350000', currentLiabilities: '280000', interestExpense: '110000', ebit: '100000', eps: '72.00', depreciationAmortization: '4500', capitalExpenditure: '3500', changeInWorkingCapital: '0', fcf: '96000' },
      { fiscalYear: 'FY2021', revenue: '240000', netProfit: '46000', operatingProfit: '98000', totalAssets: '3200000', totalLiabilities: '2920000', totalEquity: '280000', totalDebt: '520000', currentAssets: '380000', currentLiabilities: '300000', interestExpense: '115000', ebit: '108000', eps: '78.00', depreciationAmortization: '4700', capitalExpenditure: '3700', changeInWorkingCapital: '0', fcf: '104000' },
      { fiscalYear: 'FY2022', revenue: '260000', netProfit: '50000', operatingProfit: '105000', totalAssets: '3400000', totalLiabilities: '3100000', totalEquity: '300000', totalDebt: '550000', currentAssets: '400000', currentLiabilities: '320000', interestExpense: '120000', ebit: '115000', eps: '84.00', depreciationAmortization: '4900', capitalExpenditure: '3900', changeInWorkingCapital: '0', fcf: '111000' },
      { fiscalYear: 'FY2023', revenue: '270000', netProfit: '53000', operatingProfit: '108000', totalAssets: '3450000', totalLiabilities: '3150000', totalEquity: '300000', totalDebt: '580000', currentAssets: '400000', currentLiabilities: '310000', interestExpense: '130000', ebit: '118000', eps: '88.00', depreciationAmortization: '5000', capitalExpenditure: '4000', changeInWorkingCapital: '0', fcf: '114000' },
      { fiscalYear: 'FY2024', revenue: '280000', netProfit: '56000', operatingProfit: '110000', totalAssets: '3500000', totalLiabilities: '3200000', totalEquity: '300000', totalDebt: '600000', currentAssets: '400000', currentLiabilities: '300000', interestExpense: '140000', ebit: '120000', eps: '80.00', depreciationAmortization: '5000', capitalExpenditure: '4000', changeInWorkingCapital: '0', fcf: '116000' },
    ],
    shareholdings: [
      { period: 'FY2020', promoterPct: '26.0', fiiPct: '38.0', diiPct: '20.0', publicPct: '16.0' },
      { period: 'FY2021', promoterPct: '26.0', fiiPct: '39.0', diiPct: '19.0', publicPct: '16.0' },
      { period: 'FY2022', promoterPct: '26.0', fiiPct: '40.0', diiPct: '20.0', publicPct: '14.0' },
      { period: 'FY2023', promoterPct: '26.0', fiiPct: '40.5', diiPct: '19.5', publicPct: '14.0' },
      { period: 'FY2024', promoterPct: '26.0', fiiPct: '40.0', diiPct: '20.0', publicPct: '14.0' },
    ],
  },
  {
    symbol: 'YESBANK',
    name: 'Yes Bank Ltd.',
    isin: 'INE528G01035',
    sector: 'Financial Services',
    exchange: 'NSE',
    statements: [
      { fiscalYear: 'FY2020', revenue: '110000', netProfit: '18000', operatingProfit: '30000', totalAssets: '210000', totalLiabilities: '130000', totalEquity: '80000', totalDebt: '120000', currentAssets: '55000', currentLiabilities: '70000', interestExpense: '12000', ebit: '30000', eps: '18.00', depreciationAmortization: '2800', capitalExpenditure: '1800', changeInWorkingCapital: '800', fcf: '27000' },
      { fiscalYear: 'FY2021', revenue: '105000', netProfit: '12000', operatingProfit: '25000', totalAssets: '205000', totalLiabilities: '132000', totalEquity: '73000', totalDebt: '130000', currentAssets: '52000', currentLiabilities: '75000', interestExpense: '13000', ebit: '25000', eps: '12.00', depreciationAmortization: '2900', capitalExpenditure: '1900', changeInWorkingCapital: '900', fcf: '22000' },
      { fiscalYear: 'FY2022', revenue: '98000', netProfit: '6000', operatingProfit: '20000', totalAssets: '200000', totalLiabilities: '125000', totalEquity: '75000', totalDebt: '135000', currentAssets: '50000', currentLiabilities: '78000', interestExpense: '13500', ebit: '21000', eps: '6.00', depreciationAmortization: '3000', capitalExpenditure: '2000', changeInWorkingCapital: '1000', fcf: '18000' },
      { fiscalYear: 'FY2023', revenue: '92000', netProfit: '3000', operatingProfit: '15000', totalAssets: '200000', totalLiabilities: '122000', totalEquity: '78000', totalDebt: '145000', currentAssets: '48000', currentLiabilities: '82000', interestExpense: '14000', ebit: '16000', eps: '3.00', depreciationAmortization: '3100', capitalExpenditure: '2100', changeInWorkingCapital: '1100', fcf: '14000' },
      { fiscalYear: 'FY2024', revenue: '90000', netProfit: '4000', operatingProfit: '15000', totalAssets: '200000', totalLiabilities: '120000', totalEquity: '80000', totalDebt: '150000', currentAssets: '50000', currentLiabilities: '80000', interestExpense: '14000', ebit: '18000', eps: '4.00', depreciationAmortization: '3000', capitalExpenditure: '2000', changeInWorkingCapital: '1000', fcf: '12000' },
    ],
    shareholdings: [
      { period: 'FY2020', promoterPct: '20.0', fiiPct: '28.0', diiPct: '25.0', publicPct: '27.0', promoterPledgePct: '40.0' },
      { period: 'FY2021', promoterPct: '18.0', fiiPct: '26.0', diiPct: '27.0', publicPct: '29.0', promoterPledgePct: '50.0' },
      { period: 'FY2022', promoterPct: '16.0', fiiPct: '25.0', diiPct: '29.0', publicPct: '30.0', promoterPledgePct: '55.0' },
      { period: 'FY2023', promoterPct: '15.0', fiiPct: '25.0', diiPct: '30.0', publicPct: '30.0', promoterPledgePct: '58.0' },
      { period: 'FY2024', promoterPct: '15.0', fiiPct: '25.0', diiPct: '30.0', publicPct: '30.0', promoterPledgePct: '60.0' },
    ],
  },
] as const;

type StatementInput = (typeof COMPANIES)[number]['statements'][number];

function statementData(companyId: string, s: StatementInput) {
  const missing = s.revenue === '' || s.netProfit === '';
  return {
    companyId,
    periodType: 'Annual',
    fiscalYear: s.fiscalYear,
    fiscalQuarter: null,
    revenue: s.revenue,
    netProfit: s.netProfit,
    operatingProfit: s.operatingProfit,
    totalAssets: s.totalAssets,
    totalLiabilities: s.totalLiabilities,
    totalEquity: s.totalEquity,
    totalDebt: s.totalDebt,
    currentAssets: s.currentAssets,
    currentLiabilities: s.currentLiabilities,
    interestExpense: s.interestExpense,
    ebit: s.ebit,
    eps: s.eps,
    depreciationAmortization: s.depreciationAmortization,
    capitalExpenditure: s.capitalExpenditure,
    changeInWorkingCapital: s.changeInWorkingCapital,
    fcf: s.fcf,
    currency: 'INR',
    unit: 'CRORE',
    adjustmentStatus: 'reported',
    quality: missing ? 'missing' : 'verified',
    isMissing: missing,
    sourceDocumentRef: 'SEED',
    fetchedAt: new Date(),
    reportedPeriod: s.fiscalYear,
  };
}

async function upsertUser() {
  return prisma.user.upsert({
    where: { id: OWNER_USER_ID },
    create: {
      id: OWNER_USER_ID,
      email: OWNER_EMAIL,
      name: OWNER_NAME,
      role: 'OWNER',
    },
    update: {
      email: OWNER_EMAIL,
      name: OWNER_NAME,
      role: 'OWNER',
    },
  });
}

async function upsertCompany(userId: string, c: (typeof COMPANIES)[number]) {
  const existing = await prisma.company.findFirst({ where: { symbol: c.symbol, userId } });
  if (existing) {
    return prisma.company.update({
      where: { id: existing.id },
      data: {
        name: c.name,
        isin: c.isin,
        sector: c.sector,
        exchange: c.exchange,
        isActive: true,
      },
    });
  }
  return prisma.company.create({
    data: {
      userId,
      symbol: c.symbol,
      name: c.name,
      isin: c.isin,
      sector: c.sector,
      exchange: c.exchange,
      isActive: true,
    },
  });
}

async function upsertStatement(prismaClient: typeof prisma, companyId: string, s: StatementInput) {
  const existing = await prismaClient.financialStatement.findFirst({
    where: {
      companyId,
      periodType: 'Annual',
      fiscalYear: s.fiscalYear,
      fiscalQuarter: null,
    },
  });
  const data = statementData(companyId, s);
  if (existing) {
    return prismaClient.financialStatement.update({ where: { id: existing.id }, data });
  }
  return prismaClient.financialStatement.create({ data });
}

async function upsertShareholding(prismaClient: typeof prisma, companyId: string, sh: (typeof COMPANIES)[number]['shareholdings'][number]) {
  const existing = await prismaClient.shareholding.findFirst({ where: { companyId, period: sh.period } });
  const data: any = {
    companyId,
    period: sh.period,
    promoterPct: sh.promoterPct,
    fiiPct: sh.fiiPct,
    diiPct: sh.diiPct,
    publicPct: sh.publicPct,
    dataQuality: 'verified',
  };
  if (sh.promoterPledgePct !== undefined) {
    data.promoterPledgePct = sh.promoterPledgePct;
  }
  if (existing) {
    return prismaClient.shareholding.update({ where: { id: existing.id }, data });
  }
  return prismaClient.shareholding.create({ data });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run the seed script');
  }

  console.log('[seed] Upserting default personal user...');
  const user = await upsertUser();
  console.log(`[seed] User ${user.id} (${user.email}) ready`);

  for (const c of COMPANIES) {
    console.log(`[seed] Upserting company ${c.symbol}...`);
    const company = await upsertCompany(OWNER_USER_ID, c);

    for (const s of c.statements) {
      await upsertStatement(prisma, company.id, s);
    }
    for (const sh of c.shareholdings) {
      await upsertShareholding(prisma, company.id, sh);
    }
    console.log(`[seed] Company ${c.symbol} (${company.id}) ready with ${c.statements.length} statements and ${c.shareholdings.length} shareholdings`);
  }

  // Distressed company (YESBANK): Stage A run with hard-stop red flags.
  const yesbank = COMPANIES.find((c) => c.symbol === 'YESBANK')!;
  const company = await prisma.company.findFirst({ where: { symbol: 'YESBANK', userId: OWNER_USER_ID } });
  if (!company) {
    throw new Error('YESBANK company not found after seeding');
  }

  console.log('[seed] Upserting Stage A analysis run and red flags for YESBANK...');
  const snapshot = await prisma.dataSnapshot.upsert({
    where: { id: `seed-yesbank-snapshot` },
    create: {
      id: `seed-yesbank-snapshot`,
      companyId: company.id,
      asOfDate: new Date(),
      financials: { source: 'SEED', fiscalYear: 'FY2024' },
      marketData: { source: 'SEED' },
      provenance: { source: 'SEED', capturedAt: new Date().toISOString() },
    },
    update: {
      asOfDate: new Date(),
      financials: { source: 'SEED', fiscalYear: 'FY2024' },
      marketData: { source: 'SEED' },
      provenance: { source: 'SEED', capturedAt: new Date().toISOString() },
    },
  });

  const run = await prisma.analysisRun.upsert({
    where: { id: `seed-yesbank-stage-a` },
    create: {
      id: `seed-yesbank-stage-a`,
      companyId: company.id,
      userId: OWNER_USER_ID,
      stage: 'A',
      totalPoints: 45,
      maxPoints: 90,
      verdict: 'FAIL',
      ruleSetVersion: 'v1.0.0',
      dataSnapshotId: snapshot.id,
      configHash: 'seed-yesbank-a-v1',
    },
    update: {
      stage: 'A',
      totalPoints: 45,
      maxPoints: 90,
      verdict: 'FAIL',
      ruleSetVersion: 'v1.0.0',
      dataSnapshotId: snapshot.id,
      configHash: 'seed-yesbank-a-v1',
    },
  });

  await prisma.analysisStageA.upsert({
    where: { analysisRunId: run.id },
    create: {
      analysisRunId: run.id,
      sector: 'Financial Services',
      maxPossibleScore: 90,
      minPassScore: 60,
      bankVariant: false,
      unsuitableRules: ['HARD_DEBT_TO_EQUITY_LIMIT', 'HARD_MIN_ROE_LIMIT'],
    },
    update: {
      sector: 'Financial Services',
      maxPossibleScore: 90,
      minPassScore: 60,
      bankVariant: false,
      unsuitableRules: ['HARD_DEBT_TO_EQUITY_LIMIT', 'HARD_MIN_ROE_LIMIT'],
    },
  });

  // Idempotent: clear existing flags for this run, then recreate.
  await prisma.redFlag.deleteMany({ where: { analysisRunId: run.id } });

  await prisma.redFlag.create({
    data: {
      analysisRunId: run.id,
      companyId: company.id,
      flagKey: 'HARD_DEBT_TO_EQUITY_LIMIT',
      stage: 'A',
      ruleKey: 'HARD_DEBT_TO_EQUITY_LIMIT',
      class: 'FINANCIAL_STRUCTURE',
      severity: 'HARD',
      status: 'ACTIVE',
      message: 'Debt-to-equity ratio 1.88 exceeds the hard-stop limit of 1.25',
      threshold: '1.25',
      actualValue: { debtToEquity: 1.875, totalDebt: '150000', totalEquity: '80000' },
      expectedValue: { maxDebtToEquity: 1.25 },
      source: 'Stage A Engine',
      isOverride: false,
    },
  });
  await prisma.redFlag.create({
    data: {
      analysisRunId: run.id,
      companyId: company.id,
      flagKey: 'HARD_MIN_ROE_LIMIT',
      stage: 'A',
      ruleKey: 'HARD_MIN_ROE_LIMIT',
      class: 'PROFITABILITY',
      severity: 'HARD',
      status: 'ACTIVE',
      message: 'Return on equity 5.00% is below the minimum required 10.00%',
      threshold: '10.00',
      actualValue: { roe: 5.0, netProfit: '4000', totalEquity: '80000' },
      expectedValue: { minRoe: 10.0 },
      source: 'Stage A Engine',
      isOverride: false,
    },
  });
  await prisma.redFlag.create({
    data: {
      analysisRunId: run.id,
      companyId: company.id,
      flagKey: 'HIGH_PROMOTER_PLEDGE',
      stage: 'A',
      ruleKey: 'HIGH_PROMOTER_PLEDGE',
      class: 'GOVERNANCE',
      severity: 'WARNING',
      status: 'ACTIVE',
      message: 'Promoter share pledge 60.00% exceeds the 50.00% caution threshold',
      threshold: '50.00',
      actualValue: { promoterPledgePct: 60.0 },
      expectedValue: { maxPromoterPledgePct: 50.0 },
      source: 'Shareholding Engine',
      isOverride: false,
    },
  });

  console.log('[seed] YESBANK Stage A run and 3 red flags ready');

  // ============================================================
  // Seed Default RuleSet v1.0.0 and Industry Benchmarks
  // ============================================================
  const ruleSet = await prisma.ruleSet.upsert({
    where: { version: 'v1.0.0' },
    create: {
      version: 'v1.0.0',
      name: 'Stokiffy Default Rule Set v1.0.0',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      configJson: {
        stageA: {
          minSalesGrowthYoY: 0.10,
          minPatGrowthYoY: 0.12,
          minRoce: 0.15,
          minRoe: 0.15,
          maxDebtToEquity: 1.0,
          minInterestCoverage: 3.0,
          minCfoToPat: 0.70,
          maxPromoterPledge: 0.10,
        },
        stageB: {
          quarterlyYoYQuarters: 8,
          annualHistoryYears: 5,
        },
        stageC: {
          moatLongevityYears: 10,
        },
        stageD: {
          defaultMarginOfSafety: 0.20,
          defaultTerminalGrowthRate: 0.04,
          defaultCostOfEquity: 0.12,
        },
        stageE: {
          minRiskReward: 1.5,
          smaFast: 20,
          smaMid: 50,
          smaSlow: 200,
        },
        stageF: {
          riskPerTradePct: 0.01,
          maxStockExposurePct: 0.10,
          maxSectorExposurePct: 0.30,
          minRiskReward: 1.5,
          maxPositionPctOfADV: 0.05,
        },
        stageG: {
          overvaluationThresholdPct: 0.20,
          portfolioDrawdownLimitPct: 0.15,
          cashBufferMinPct: 0.05,
        },
      },
    },
    update: {
      name: 'Stokiffy Default Rule Set v1.0.0',
      status: 'PUBLISHED',
    },
  });

  const BENCHMARKS = [
    { industry: 'IT services', opmMinPct: '0.22', opmMaxPct: '0.28', typicalPE: '20', minRoaPct: '0.20', sourceNote: 'OPM 22-28%, P/E 20, Min ROA 20%' },
    { industry: 'Pharma', opmMinPct: '0.25', opmMaxPct: '0.35', typicalPE: '25', sourceNote: 'OPM 25-35%, P/E 25' },
    { industry: 'FMCG', opmMinPct: '0.18', opmMaxPct: '0.25', typicalPE: '30', minRoaPct: '0.15', sourceNote: 'OPM 18-25%, P/E 30, Min ROA 15%' },
    { industry: 'Paints', opmMinPct: '0.18', opmMaxPct: '0.28', typicalPE: '30', sourceNote: 'OPM 18-28%, P/E 30' },
    { industry: 'Automobiles', opmMinPct: '0.08', opmMaxPct: '0.12', typicalPE: '15', sourceNote: 'OPM 8-12%, P/E 15' },
    { industry: 'Retail', opmMinPct: '0.05', opmMaxPct: '0.08', sourceNote: 'OPM 5-8%' },
    { industry: 'Steel & metals', opmMinPct: '0.08', opmMaxPct: '0.15', sourceNote: 'OPM 8-15%' },
    { industry: 'Banks', typicalPE: '15', minRoaPct: '0.008', sourceNote: 'P/E 15, Min ROA 0.8%' },
    { industry: 'Commodities', typicalPE: '8', sourceNote: 'P/E 8' },
    { industry: 'Manufacturing', minRoaPct: '0.08', sourceNote: 'Min ROA 8%' },
    { industry: 'Capital intensive', minRoaPct: '0.05', sourceNote: 'Min ROA 5%' },
  ];

  for (const b of BENCHMARKS) {
    await prisma.industryBenchmark.upsert({
      where: {
        ruleSetId_industry: {
          ruleSetId: ruleSet.id,
          industry: b.industry,
        },
      },
      create: {
        ruleSetId: ruleSet.id,
        industry: b.industry,
        opmMinPct: b.opmMinPct ?? null,
        opmMaxPct: b.opmMaxPct ?? null,
        typicalPE: b.typicalPE ?? null,
        minRoaPct: b.minRoaPct ?? null,
        sourceNote: b.sourceNote,
      },
      update: {
        opmMinPct: b.opmMinPct ?? null,
        opmMaxPct: b.opmMaxPct ?? null,
        typicalPE: b.typicalPE ?? null,
        minRoaPct: b.minRoaPct ?? null,
        sourceNote: b.sourceNote,
      },
    });
  }
  console.log(`[seed] Seeded RuleSet v1.0.0 and ${BENCHMARKS.length} industry benchmarks`);

  // ============================================================
  // Seed Starter Watchlist: "Core Indian Equities"
  // ============================================================
  const watchlist = await prisma.watchlist.upsert({
    where: {
      userId_name: {
        userId: OWNER_USER_ID,
        name: 'Core Indian Equities',
      },
    },
    create: {
      userId: OWNER_USER_ID,
      name: 'Core Indian Equities',
      description: 'Starter portfolio watchlist containing Indian blue-chip market leaders',
    },
    update: {
      description: 'Starter portfolio watchlist containing Indian blue-chip market leaders',
    },
  });

  const watchlistSymbols = [
    { symbol: 'TCS', notes: 'IT Services market leader with pristine cash conversion' },
    { symbol: 'HINDUNILVR', notes: 'FMCG titan with unmatched distribution moat' },
    { symbol: 'HDFCBANK', notes: 'Premier private sector banking institution' },
  ];

  for (const item of watchlistSymbols) {
    const company = await prisma.company.findFirst({
      where: { symbol: item.symbol, userId: OWNER_USER_ID },
    });
    if (company) {
      await prisma.watchlistItem.upsert({
        where: {
          watchlistId_companyId: {
            watchlistId: watchlist.id,
            companyId: company.id,
          },
        },
        create: {
          watchlistId: watchlist.id,
          companyId: company.id,
          notes: item.notes,
        },
        update: {
          notes: item.notes,
        },
      });
    }
  }
  console.log('[seed] Seeded starter Watchlist "Core Indian Equities" with 3 items');

  console.log('[seed] Seed complete.');
}

main()
  .then(() => {
    console.log('[seed] Done.');
    void prisma.$disconnect();
  })
  .catch((err) => {
    console.error('[seed] Failed:', err);
    void prisma.$disconnect();
    process.exit(1);
  });
