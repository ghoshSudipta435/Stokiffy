import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@stock-assistant/db';

export const dynamic = 'force-dynamic';

type StageStatus = 'PENDING' | 'PASS' | 'FAIL';

export interface CompanyDetailDTO {
  id: string;
  symbol: string;
  isin: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  sector: string;
  industry: string;
  isDemoFixture: boolean;
  engineIntegrationStatus: 'PENDING_CORE_ENGINE_INTEGRATION';
  stages: {
    stageAStatus: StageStatus;
    stageBStatus: StageStatus;
    stageCScore?: number;
    stageDValuation: StageStatus;
    stageEStatus: StageStatus;
    stageFStatus: StageStatus;
    stageGMonitoring: StageStatus;
  };
  redFlags: Array<{
    id: string;
    code: string;
    title: string;
    severity: 'HARD' | 'WARNING';
    status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  }>;
  lastUpdated?: string;
}

const stageStatusOf = (verdict: string | null | undefined): StageStatus => {
  if (verdict === 'PASS' || verdict === 'FAIL') return verdict;
  return 'PENDING';
};

export const GET = apiHandler(async (_req: NextRequest, { requestId, params }) => {
  const session = await requireAuth(_req);
  const userId = session.user.id;

  const idOrSymbol = String(params.id || '');

  let company = await prisma.company.findFirst({
    where: { userId, id: idOrSymbol },
  });
  if (!company) {
    company = await prisma.company.findFirst({
      where: { userId, symbol: { equals: idOrSymbol, mode: 'insensitive' } },
    });
  }

  if (!company) {
    return createErrorResponse(
      'RESOURCE_NOT_FOUND',
      `Company with id or symbol '${idOrSymbol}' not found`,
      404,
      requestId
    );
  }

  const [latestFinancials, analysisRuns, activeFlags] = await Promise.all([
    prisma.financialStatement.findFirst({
      where: { companyId: company.id },
      orderBy: { fiscalYear: 'desc' },
    }),
    prisma.analysisRun.findMany({
      where: { companyId: company.id, userId },
      orderBy: { calculatedAt: 'desc' },
      take: 5,
      include: { stageA: true, redFlags: true },
    }),
    prisma.redFlag.findMany({
      where: { companyId: company.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const stageARun = analysisRuns.find((run) => run.stage === 'A');
  const stageBRun = analysisRuns.find((run) => run.stage === 'B');

  const companyDetail: CompanyDetailDTO = {
    id: company.id,
    symbol: company.symbol,
    isin: company.isin ?? '',
    name: company.name,
    exchange: company.exchange as 'NSE' | 'BSE',
    sector: company.sector,
    industry: company.sector,
    isDemoFixture: false,
    engineIntegrationStatus: 'PENDING_CORE_ENGINE_INTEGRATION',
    stages: {
      stageAStatus: stageStatusOf(stageARun?.verdict ?? null),
      stageBStatus: stageStatusOf(stageBRun?.verdict ?? null),
      stageDValuation: 'PENDING',
      stageEStatus: 'PENDING',
      stageFStatus: 'PENDING',
      stageGMonitoring: 'PENDING',
    },
    redFlags: activeFlags.map((flag) => ({
      id: flag.id,
      code: flag.flagKey,
      title: flag.message,
      severity: flag.severity as 'HARD' | 'WARNING',
      status: flag.status as 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED',
    })),
    lastUpdated: company.updatedAt.toISOString(),
  };

  return createSuccessResponse(companyDetail, requestId);
});
