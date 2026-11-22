/**
 * Batch Rescore Service
 * Re-runs deterministic Stage A (and Stage B if eligible) scoring for a user's companies,
 * persists immutable DataSnapshot, AnalysisRun, AnalysisStageA/B, and RedFlag records inside a transaction,
 * and provides per-company error isolation so batch runs do not fail as a whole.
 */

import { prisma as defaultPrisma, RuleSetRepository } from '@stock-assistant/db';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  scoreStageA,
  scoreStageB,
  findIndustryBenchmark,
  type StageAInput,
  type StageAOutput,
  type StageAConfig,
  type StageBInput,
  type StageBOutput,
  type Sector,
  type DataProvenance,
  type QuarterlyPoint,
  type AnnualPoint,
  type ShareholdingPoint,
} from '@stock-assistant/core';
import type { BatchRescoreCompaniesPayload } from '../types.js';
import type { WorkerLogger } from '../../lib/logger.js';

export interface CompanyRescoreError {
  companyId: string;
  symbol: string;
  error: string;
}

export interface BatchRescoreResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: CompanyRescoreError[];
}

function toDecimalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function safeRatio(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0 || den < 0) return null;
  return num / den;
}

function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

function mapSectorToCore(dbSector: string): Sector {
  const s = dbSector.toLowerCase();
  if (s.includes('nbfc')) return 'nbfc';
  if (s.includes('bank') || s === 'financial services') return 'bank';
  if (s.includes('insurance')) return 'insurance';
  if (s.includes('financial')) return 'other-financial';
  return 'non-financial';
}

function makeProvenance(source = 'batch-rescore-job'): DataProvenance {
  return {
    source,
    fetchedAt: new Date().toISOString(),
    reportedPeriod: 'HISTORICAL',
    currency: 'INR',
    unit: 'CRORE',
    adjustmentStatus: 'reported',
    quality: 'verified',
    isMissing: false,
  };
}

export class BatchRescoreService {
  private ruleSetRepo: RuleSetRepository;

  constructor(private readonly prisma: PrismaClient = defaultPrisma as unknown as PrismaClient) {
    this.ruleSetRepo = new RuleSetRepository(this.prisma);
  }

  public async rescore(
    payload: BatchRescoreCompaniesPayload,
    logger: WorkerLogger
  ): Promise<BatchRescoreResult> {
    const { userId, companyIds, ruleSetVersion, stages = ['A', 'B'], asOfDate } = payload;

    // 1. Resolve RuleSet & Benchmarks
    let ruleSet = null;
    if (ruleSetVersion) {
      ruleSet = await this.ruleSetRepo.getByVersion(ruleSetVersion);
    } else {
      ruleSet = await this.ruleSetRepo.getActivePublished();
    }

    const effectiveRuleSetVersion = ruleSet?.version ?? ruleSetVersion ?? 'v1.0.0';
    logger.info(`Batch rescoring for user ${userId} using RuleSet version ${effectiveRuleSetVersion}`);

    // 2. Fetch target companies
    const companies = await this.prisma.company.findMany({
      where: {
        userId,
        isActive: true,
        ...(companyIds && companyIds.length > 0 ? { id: { in: companyIds } } : {}),
      },
      orderBy: { symbol: 'asc' },
    });

    logger.info(`Found ${companies.length} company/companies to rescore for user ${userId}`);

    let succeeded = 0;
    let failed = 0;
    const errors: CompanyRescoreError[] = [];

    // 3. Process each company with error isolation
    for (const company of companies) {
      try {
        logger.info(`Rescoring company ${company.symbol} (${company.id})...`);

        // Fetch annual statements (up to 10 years)
        const annualStatements = await this.prisma.financialStatement.findMany({
          where: { companyId: company.id, periodType: 'Annual' },
          orderBy: { fiscalYear: 'desc' },
          take: 10,
        });

        // Fetch quarterly statements (up to 12 quarters)
        const quarterlyStatements = await this.prisma.financialStatement.findMany({
          where: { companyId: company.id, periodType: 'Quarterly' },
          orderBy: [{ fiscalYear: 'desc' }, { fiscalQuarter: 'desc' }],
          take: 12,
        });

        // Fetch shareholdings
        const shareholdings = await this.prisma.shareholding.findMany({
          where: { companyId: company.id },
          orderBy: { period: 'desc' },
          take: 8,
        });

        // Fetch latest price bar
        const latestPriceBar = await this.prisma.priceBar.findFirst({
          where: { companyId: company.id },
          orderBy: { date: 'desc' },
        });

        // Resolve benchmark
        const dbBenchmark = ruleSet?.benchmarks?.find(
          (b) => b.industry.toLowerCase() === company.sector.toLowerCase()
        );
        const coreBenchmark = findIndustryBenchmark(company.sector);

        const peRatioValue =
          dbBenchmark?.typicalPE != null
            ? Number(dbBenchmark.typicalPE)
            : coreBenchmark?.peMedian ?? 20;

        const opmMinValue =
          dbBenchmark?.opmMinPct != null
            ? Number(dbBenchmark.opmMinPct)
            : coreBenchmark?.opmMin ?? 0.15;

        const roaMinValue =
          dbBenchmark?.minRoaPct != null
            ? Number(dbBenchmark.minRoaPct)
            : coreBenchmark?.minRoa ?? 0.10;

        const latest = annualStatements[0] as Record<string, unknown> | undefined;
        const prior = annualStatements[1] as Record<string, unknown> | undefined;
        const fiveYearsAgo =
          annualStatements.length >= 5
            ? (annualStatements[4] as Record<string, unknown>)
            : annualStatements[annualStatements.length - 1] as Record<string, unknown> | undefined;

        const revLatest = toDecimalNumber(latest?.revenue);
        const npLatest = toDecimalNumber(latest?.netProfit);
        const opLatest = toDecimalNumber(latest?.operatingProfit);
        const assetsLatest = toDecimalNumber(latest?.totalAssets);
        const equityLatest = toDecimalNumber(latest?.totalEquity);
        const clLatest = toDecimalNumber(latest?.currentLiabilities);
        const ebitLatest = toDecimalNumber(latest?.ebit);
        const epsLatest = toDecimalNumber(latest?.eps);

        // Compute 5Y averages
        const roeValues: (number | null)[] = [];
        const roceValues: (number | null)[] = [];
        const opmValues: (number | null)[] = [];
        const roaValues: (number | null)[] = [];

        for (const s of annualStatements as Array<Record<string, unknown>>) {
          const sNp = toDecimalNumber(s.netProfit);
          const sEq = toDecimalNumber(s.totalEquity);
          const sEbit = toDecimalNumber(s.ebit);
          const sAssets = toDecimalNumber(s.totalAssets);
          const sCl = toDecimalNumber(s.currentLiabilities);
          const sOp = toDecimalNumber(s.operatingProfit);
          const sRev = toDecimalNumber(s.revenue);

          roeValues.push(safeRatio(sNp, sEq));
          roceValues.push(safeRatio(sEbit, sAssets !== null && sCl !== null ? sAssets - sCl : null));
          opmValues.push(safeRatio(sOp, sRev));
          roaValues.push(safeRatio(sNp, sAssets));
        }

        const latestPrice = latestPriceBar ? toDecimalNumber(latestPriceBar.close) : null;
        const peRatio = latestPrice !== null && epsLatest !== null && epsLatest > 0 ? latestPrice / epsLatest : null;

        // Build Stage A Input
        const stageAInput: StageAInput = {
          companyId: company.id,
          asOfDate: asOfDate || new Date().toISOString(),
          sector: mapSectorToCore(company.sector),
          financials: {
            revenue: {
              latestFy: revLatest,
              priorFy: toDecimalNumber(prior?.revenue),
              fy5yAgo: toDecimalNumber(fiveYearsAgo?.revenue),
            },
            netProfit: {
              latestFy: npLatest,
              priorFy: toDecimalNumber(prior?.netProfit),
              fy5yAgo: toDecimalNumber(fiveYearsAgo?.netProfit),
            },
            operatingProfit: {
              latestFy: opLatest,
            },
            totalAssets: assetsLatest,
            totalLiabilities: toDecimalNumber(latest?.totalLiabilities),
            totalEquity: equityLatest,
            totalDebt: toDecimalNumber(latest?.totalDebt),
            currentAssets: toDecimalNumber(latest?.currentAssets),
            currentLiabilities: clLatest,
            interestExpense: toDecimalNumber(latest?.interestExpense),
            ebit: ebitLatest,
            eps: epsLatest,
            peRatio,
            industryPeRatio: peRatioValue,
            roe: {
              latestFy: safeRatio(npLatest, equityLatest),
              avg5y: average(roeValues),
            },
            roce: {
              latestFy: safeRatio(ebitLatest, assetsLatest !== null && clLatest !== null ? assetsLatest - clLatest : null),
              avg5y: average(roceValues),
            },
            opm: {
              latestFy: safeRatio(opLatest, revLatest),
              avg5y: average(opmValues),
            },
            industryOpmMin: opmMinValue,
            roa: {
              latestFy: safeRatio(npLatest, assetsLatest),
              avg5y: average(roaValues),
            },
            industryRoaMin: roaMinValue,
          },
        };

        const stageAConfig: StageAConfig = {
          ruleSetVersion: effectiveRuleSetVersion,
        };

        const stageAOutput: StageAOutput = scoreStageA(stageAInput, stageAConfig);

        // Build Stage B Input if requested & Stage A passed
        let stageBOutput: StageBOutput | null = null;
        if (stages.includes('B') && stageAOutput.gatePassed) {
          // Map quarterly points
          const quarterlyPoints: QuarterlyPoint[] = quarterlyStatements.map((q) => {
            const rev = toDecimalNumber(q.revenue);
            const op = toDecimalNumber(q.operatingProfit);
            const opm = rev && op && rev > 0 ? (op / rev) * 100 : null;
            return {
              period: `${q.fiscalYear} ${q.fiscalQuarter || 'Q4'}`,
              salesYoY: rev,
              opmYoY: opm,
            };
          });

          // Map annual points (chronological order)
          const annualPoints: AnnualPoint[] = [...annualStatements].reverse().map((a) => {
            const rev = toDecimalNumber(a.revenue);
            const op = toDecimalNumber(a.operatingProfit);
            const np = toDecimalNumber(a.netProfit);
            const ebit = toDecimalNumber(a.ebit);
            const assets = toDecimalNumber(a.totalAssets);
            const cl = toDecimalNumber(a.currentLiabilities);
            const capEmployed = assets !== null && cl !== null ? assets - cl : null;

            return {
              period: a.fiscalYear,
              sales: rev,
              opm: rev && op && rev > 0 ? (op / rev) * 100 : null,
              netProfit: np,
              netMargin: rev && np && rev > 0 ? (np / rev) * 100 : null,
              reserves: toDecimalNumber(a.totalEquity),
              borrowings: toDecimalNumber(a.totalDebt),
              cfo: toDecimalNumber(a.fcf),
              pat: np,
              debtorDays: 45, // default estimated
              roce: ebit !== null && capEmployed && capEmployed > 0 ? (ebit / capEmployed) * 100 : null,
            };
          });

          // Map shareholdings (chronological order)
          const shareholdingPoints: ShareholdingPoint[] = [...shareholdings].reverse().map((sh) => ({
            period: sh.period,
            promoterPct: Number(sh.promoterPct),
            fiiPct: Number(sh.fiiPct),
            diiPct: Number(sh.diiPct),
            publicPct: Number(sh.publicPct),
            promoterPledgePct: sh.promoterPledgePct ? Number(sh.promoterPledgePct) : null,
          }));

          const stageBInput: StageBInput = {
            companyId: company.id,
            asOfDate: asOfDate || new Date().toISOString(),
            quarterly: quarterlyPoints,
            annual: annualPoints,
            shareholding: shareholdingPoints,
            dataProvenance: makeProvenance('batch-rescore-job'),
          };

          stageBOutput = scoreStageB(stageBInput, {
            ruleSetVersion: effectiveRuleSetVersion,
          });
        }

        // 4. Atomic persistence in transaction
        await this.prisma.$transaction(async (tx) => {
          // Create immutable DataSnapshot
          const snapshot = await tx.dataSnapshot.create({
            data: {
              companyId: company.id,
              asOfDate: new Date(),
              financials: {
                annualCount: annualStatements.length,
                quarterlyCount: quarterlyStatements.length,
                latestAnnual: (latest ?? null) as Prisma.InputJsonValue,
              },
              marketData: {
                latestClose: latestPrice,
                date: latestPriceBar?.date?.toISOString() ?? null,
              },
              provenance: {
                source: 'batch-rescore-companies',
                capturedAt: new Date().toISOString(),
                ruleSetVersion: effectiveRuleSetVersion,
              },
            },
          });

          const stageAFlags = [
            ...stageAOutput.hardStops,
            ...stageAOutput.conditionalWarnings,
            ...stageAOutput.dataQualityWarnings,
            ...stageAOutput.valuationWarnings,
          ];

          // Persist Stage A AnalysisRun
          await tx.analysisRun.create({
            data: {
              companyId: company.id,
              userId,
              stage: 'A',
              totalPoints: stageAOutput.totalPoints,
              maxPoints: stageAOutput.maxPoints,
              verdict: stageAOutput.verdict,
              ruleSetVersion: effectiveRuleSetVersion,
              dataSnapshotId: snapshot.id,
              configHash: `ruleset_${effectiveRuleSetVersion}_stageA`,
              stageA: {
                create: {
                  sector: stageAOutput.sector,
                  maxPossibleScore: stageAOutput.maxPoints,
                  minPassScore: 6.0,
                  bankVariant: stageAOutput.sector === 'bank' || stageAOutput.sector === 'nbfc',
                },
              },
              redFlags: {
                create: stageAFlags.map((f) => ({
                  companyId: company.id,
                  flagKey: f.flagKey,
                  stage: 'A',
                  ruleKey: f.ruleKey ?? null,
                  class: f.class,
                  severity: f.severity,
                  status: 'ACTIVE',
                  message: f.message,
                  threshold: f.threshold,
                  actualValue: (f.actualValue ?? {}) as Prisma.InputJsonValue,
                  expectedValue: (f.expectedValue as Prisma.InputJsonValue) ?? null,
                  source: f.source,
                })),
              },
            },
          });

          // Persist Stage B AnalysisRun if evaluated
          if (stageBOutput !== null) {
            const stageBFlags = [
              ...stageBOutput.hardStops,
              ...stageBOutput.conditionalWarnings,
              ...stageBOutput.dataQualityWarnings,
              ...stageBOutput.valuationWarnings,
            ];

            await tx.analysisRun.create({
              data: {
                companyId: company.id,
                userId,
                stage: 'B',
                totalPoints: stageBOutput.totalPoints,
                maxPoints: stageBOutput.maxPoints,
                verdict: stageBOutput.verdict,
                ruleSetVersion: effectiveRuleSetVersion,
                dataSnapshotId: snapshot.id,
                configHash: `ruleset_${effectiveRuleSetVersion}_stageB`,
                stageB: {
                  create: {
                    quarterlySalesTrend: stageBOutput.quarterlyAnalysis.salesTrend,
                    quarterlyOpmTrend: stageBOutput.quarterlyAnalysis.opmTrend,
                    annualSales5yTrend: stageBOutput.annualAnalysis.sales5yTrend,
                    annualOpm5yTrend: stageBOutput.annualAnalysis.opm5yTrend,
                    netProfitTrend: stageBOutput.annualAnalysis.netProfitTrend,
                    reservesBorrowingsTrend: stageBOutput.annualAnalysis.reservesBorrowingsTrend,
                    cfoTrend: stageBOutput.annualAnalysis.cfoTrend,
                    debtorDaysTrend: stageBOutput.annualAnalysis.debtorDaysTrend,
                    roceTrend: stageBOutput.annualAnalysis.roceTrend,
                    shareholdingScore: stageBOutput.shareholdingAnalysis.score,
                    shareholdingHardFlags: stageBOutput.shareholdingAnalysis.hardFlags as Prisma.InputJsonValue,
                  },
                },
                redFlags: {
                  create: stageBFlags.map((f) => ({
                    companyId: company.id,
                    flagKey: f.flagKey,
                    stage: 'B',
                    ruleKey: f.ruleKey ?? null,
                    class: f.class,
                    severity: f.severity,
                    status: 'ACTIVE',
                    message: f.message,
                    threshold: f.threshold,
                    actualValue: (f.actualValue ?? {}) as Prisma.InputJsonValue,
                    expectedValue: (f.expectedValue as Prisma.InputJsonValue) ?? null,
                    source: f.source,
                  })),
                },
              },
            });
          }

          // Persist Company AuditEvent
          await tx.auditEvent.create({
            data: {
              userId,
              action: 'COMPANY_RESCORED',
              entityType: 'Company',
              entityId: company.id,
              reason: `Batch rescore with RuleSet ${effectiveRuleSetVersion}`,
              afterState: {
                stageAScore: stageAOutput.totalPoints,
                stageAVerdict: stageAOutput.verdict,
                stageAGatePassed: stageAOutput.gatePassed,
                stageBRun: stageBOutput !== null,
                stageBScore: stageBOutput?.totalPoints ?? null,
                stageBVerdict: stageBOutput?.verdict ?? null,
                snapshotId: snapshot.id,
              },
            },
          });
        });

        succeeded++;
        logger.info(
          `Successfully rescored company ${company.symbol} (Stage A: ${stageAOutput.totalPoints}/${stageAOutput.maxPoints}, Stage B: ${stageBOutput?.totalPoints ?? 'N/A'})`
        );
      } catch (err: unknown) {
        failed++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(`Error rescoring company ${company.symbol} (${company.id}): ${errorMessage}`, err instanceof Error ? err : undefined);
        errors.push({
          companyId: company.id,
          symbol: company.symbol,
          error: errorMessage,
        });
      }
    }

    // 5. Write overall batch audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'BATCH_RESCORE_COMPANIES',
        entityType: 'User',
        entityId: userId,
        reason: `Batch rescoring job completed: ${succeeded} succeeded, ${failed} failed out of ${companies.length}`,
        afterState: {
          processed: companies.length,
          succeeded,
          failed,
          errorsSummary: errors.map((e) => `${e.symbol}: ${e.error}`),
          ruleSetVersion: effectiveRuleSetVersion,
        },
      },
    });

    return {
      processed: companies.length,
      succeeded,
      failed,
      errors,
    };
  }
}

export const batchRescoreService = new BatchRescoreService();
