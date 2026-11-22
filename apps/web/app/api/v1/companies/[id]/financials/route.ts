import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@stock-assistant/db';

export const dynamic = 'force-dynamic';

const financialStatementInputSchema = z.object({
  periodType: z.enum(['annual', 'quarterly']),
  fiscalYear: z.string().min(1, 'fiscalYear is required'),
  fiscalQuarter: z.string().optional().nullable(),
  revenue: z.number().nullable().optional(),
  netProfit: z.number().nullable().optional(),
  operatingProfit: z.number().nullable().optional(),
  totalAssets: z.number().nullable().optional(),
  totalLiabilities: z.number().nullable().optional(),
  totalEquity: z.number().nullable().optional(),
  totalDebt: z.number().nullable().optional(),
  currentAssets: z.number().nullable().optional(),
  currentLiabilities: z.number().nullable().optional(),
  interestExpense: z.number().nullable().optional(),
  ebit: z.number().nullable().optional(),
  eps: z.number().nullable().optional(),
  depreciationAmortization: z.number().nullable().optional(),
  capitalExpenditure: z.number().nullable().optional(),
  changeInWorkingCapital: z.number().nullable().optional(),
  fcf: z.number().nullable().optional(),
  dividendPerShare: z.number().nullable().optional(),
  sharesOutstanding: z.number().nullable().optional(),
  bookValuePerShare: z.number().nullable().optional(),
  promoterPledgePct: z.number().nullable().optional(),
  relatedPartyTxn: z.number().nullable().optional(),
  auditorQualification: z.string().nullable().optional(),
  currency: z.string().optional().default('INR'),
  unit: z.string().optional().default('CRORE'),
  sourceDocumentRef: z.string().optional().nullable(),
});

type FinancialStatementInput = z.infer<typeof financialStatementInputSchema>;

const postPayloadSchema = z.union([
  z.object({ statements: z.array(financialStatementInputSchema).min(1) }),
  z.array(financialStatementInputSchema).min(1),
  financialStatementInputSchema,
]);

function toNullableNumber(val: number | null | undefined): number | null {
  return val !== undefined && val !== null ? val : null;
}

export const GET = apiHandler(async (req: NextRequest, { requestId, params }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;
  const idOrSymbol = String(params.id || '');

  const company = await prisma.company.findFirst({
    where: {
      userId,
      OR: [{ id: idOrSymbol }, { symbol: { equals: idOrSymbol, mode: 'insensitive' } }],
    },
  });

  if (!company) {
    return createErrorResponse(
      'RESOURCE_NOT_FOUND',
      `Company '${idOrSymbol}' not found`,
      404,
      requestId
    );
  }

  const periodType = req.nextUrl.searchParams.get('periodType') || undefined;
  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 50;

  const statements = await prisma.financialStatement.findMany({
    where: {
      companyId: company.id,
      ...(periodType ? { periodType } : {}),
    },
    orderBy: [{ fiscalYear: 'desc' }, { fiscalQuarter: 'desc' }],
    take: limit,
  });

  const formatted = statements.map((s) => ({
    id: s.id,
    companyId: s.companyId,
    periodType: s.periodType,
    fiscalYear: s.fiscalYear,
    fiscalQuarter: s.fiscalQuarter,
    reportedPeriod: s.reportedPeriod,
    revenue: s.revenue !== null ? Number(s.revenue) : null,
    netProfit: s.netProfit !== null ? Number(s.netProfit) : null,
    operatingProfit: s.operatingProfit !== null ? Number(s.operatingProfit) : null,
    totalAssets: s.totalAssets !== null ? Number(s.totalAssets) : null,
    totalLiabilities: s.totalLiabilities !== null ? Number(s.totalLiabilities) : null,
    totalEquity: s.totalEquity !== null ? Number(s.totalEquity) : null,
    totalDebt: s.totalDebt !== null ? Number(s.totalDebt) : null,
    currentAssets: s.currentAssets !== null ? Number(s.currentAssets) : null,
    currentLiabilities: s.currentLiabilities !== null ? Number(s.currentLiabilities) : null,
    interestExpense: s.interestExpense !== null ? Number(s.interestExpense) : null,
    ebit: s.ebit !== null ? Number(s.ebit) : null,
    eps: s.eps !== null ? Number(s.eps) : null,
    depreciationAmortization: s.depreciationAmortization !== null ? Number(s.depreciationAmortization) : null,
    capitalExpenditure: s.capitalExpenditure !== null ? Number(s.capitalExpenditure) : null,
    changeInWorkingCapital: s.changeInWorkingCapital !== null ? Number(s.changeInWorkingCapital) : null,
    fcf: s.fcf !== null ? Number(s.fcf) : null,
    dividendPerShare: s.dividendPerShare !== null ? Number(s.dividendPerShare) : null,
    sharesOutstanding: s.sharesOutstanding !== null ? Number(s.sharesOutstanding) : null,
    bookValuePerShare: s.bookValuePerShare !== null ? Number(s.bookValuePerShare) : null,
    promoterPledgePct: s.promoterPledgePct !== null ? Number(s.promoterPledgePct) : null,
    relatedPartyTxn: s.relatedPartyTxn !== null ? Number(s.relatedPartyTxn) : null,
    auditorQualification: s.auditorQualification,
    currency: s.currency,
    unit: s.unit,
    adjustmentStatus: s.adjustmentStatus,
    quality: s.quality,
    isMissing: s.isMissing,
    sourceDocumentRef: s.sourceDocumentRef,
    fetchedAt: s.fetchedAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  }));

  return createSuccessResponse(formatted, requestId);
});

export const POST = apiHandler(async (req: NextRequest, { requestId, params }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;
  const idOrSymbol = String(params.id || '');

  const company = await prisma.company.findFirst({
    where: {
      userId,
      OR: [{ id: idOrSymbol }, { symbol: { equals: idOrSymbol, mode: 'insensitive' } }],
    },
  });

  if (!company) {
    return createErrorResponse(
      'RESOURCE_NOT_FOUND',
      `Company '${idOrSymbol}' not found`,
      404,
      requestId
    );
  }

  const body = await req.json();
  const parsed = postPayloadSchema.parse(body);

  const stmts: FinancialStatementInput[] = Array.isArray(parsed)
    ? parsed
    : 'statements' in parsed
    ? parsed.statements
    : [parsed];

  const now = new Date();

  const results = await prisma.$transaction(async (tx) => {
    const upserted: any[] = [];

    for (const stmt of stmts) {
      const reportedPeriod =
        stmt.periodType === 'quarterly' && stmt.fiscalQuarter
          ? `${stmt.fiscalYear}-${stmt.fiscalQuarter}`
          : stmt.fiscalYear;

      const quarterVal = stmt.fiscalQuarter ?? null;

      const existing = await tx.financialStatement.findFirst({
        where: {
          companyId: company.id,
          periodType: stmt.periodType,
          fiscalYear: stmt.fiscalYear,
          fiscalQuarter: quarterVal,
        },
      });

      const statementData = {
        companyId: company.id,
        periodType: stmt.periodType,
        fiscalYear: stmt.fiscalYear,
        fiscalQuarter: quarterVal,
        reportedPeriod,
        revenue: toNullableNumber(stmt.revenue),
        netProfit: toNullableNumber(stmt.netProfit),
        operatingProfit: toNullableNumber(stmt.operatingProfit),
        totalAssets: toNullableNumber(stmt.totalAssets),
        totalLiabilities: toNullableNumber(stmt.totalLiabilities),
        totalEquity: toNullableNumber(stmt.totalEquity),
        totalDebt: toNullableNumber(stmt.totalDebt),
        currentAssets: toNullableNumber(stmt.currentAssets),
        currentLiabilities: toNullableNumber(stmt.currentLiabilities),
        interestExpense: toNullableNumber(stmt.interestExpense),
        ebit: toNullableNumber(stmt.ebit),
        eps: toNullableNumber(stmt.eps),
        depreciationAmortization: toNullableNumber(stmt.depreciationAmortization),
        capitalExpenditure: toNullableNumber(stmt.capitalExpenditure),
        changeInWorkingCapital: toNullableNumber(stmt.changeInWorkingCapital),
        fcf: toNullableNumber(stmt.fcf),
        dividendPerShare: toNullableNumber(stmt.dividendPerShare),
        sharesOutstanding: toNullableNumber(stmt.sharesOutstanding),
        bookValuePerShare: toNullableNumber(stmt.bookValuePerShare),
        promoterPledgePct: toNullableNumber(stmt.promoterPledgePct),
        relatedPartyTxn: toNullableNumber(stmt.relatedPartyTxn),
        auditorQualification: stmt.auditorQualification ?? null,
        currency: stmt.currency ?? 'INR',
        unit: stmt.unit ?? 'CRORE',
        adjustmentStatus: 'reported',
        quality: 'verified',
        isMissing: false,
        sourceDocumentRef: stmt.sourceDocumentRef ?? 'MANUAL_ENTRY',
        fetchedAt: now,
      };

      let record;
      if (existing) {
        record = await tx.financialStatement.update({
          where: { id: existing.id },
          data: statementData,
        });
      } else {
        record = await tx.financialStatement.create({
          data: statementData,
        });
      }

      upserted.push(record);
    }

    await tx.auditEvent.create({
      data: {
        userId,
        action: 'MANUAL_ENTRY_FINANCIALS',
        entityType: 'FinancialStatement',
        entityId: company.id,
        reason: `Manual entry/upsert of ${upserted.length} financial statement(s) for ${company.symbol}`,
        afterState: {
          companyId: company.id,
          symbol: company.symbol,
          count: upserted.length,
          periods: stmts.map((s) =>
            s.periodType === 'quarterly' && s.fiscalQuarter
              ? `${s.fiscalYear}-${s.fiscalQuarter}`
              : s.fiscalYear
          ),
        },
      },
    });

    return upserted;
  });

  const formatted = results.map((s) => ({
    id: s.id,
    companyId: s.companyId,
    periodType: s.periodType,
    fiscalYear: s.fiscalYear,
    fiscalQuarter: s.fiscalQuarter,
    reportedPeriod: s.reportedPeriod,
    revenue: s.revenue !== null ? Number(s.revenue) : null,
    netProfit: s.netProfit !== null ? Number(s.netProfit) : null,
    operatingProfit: s.operatingProfit !== null ? Number(s.operatingProfit) : null,
    totalAssets: s.totalAssets !== null ? Number(s.totalAssets) : null,
    totalLiabilities: s.totalLiabilities !== null ? Number(s.totalLiabilities) : null,
    totalEquity: s.totalEquity !== null ? Number(s.totalEquity) : null,
    totalDebt: s.totalDebt !== null ? Number(s.totalDebt) : null,
    currentAssets: s.currentAssets !== null ? Number(s.currentAssets) : null,
    currentLiabilities: s.currentLiabilities !== null ? Number(s.currentLiabilities) : null,
    interestExpense: s.interestExpense !== null ? Number(s.interestExpense) : null,
    ebit: s.ebit !== null ? Number(s.ebit) : null,
    eps: s.eps !== null ? Number(s.eps) : null,
    depreciationAmortization: s.depreciationAmortization !== null ? Number(s.depreciationAmortization) : null,
    capitalExpenditure: s.capitalExpenditure !== null ? Number(s.capitalExpenditure) : null,
    changeInWorkingCapital: s.changeInWorkingCapital !== null ? Number(s.changeInWorkingCapital) : null,
    fcf: s.fcf !== null ? Number(s.fcf) : null,
    dividendPerShare: s.dividendPerShare !== null ? Number(s.dividendPerShare) : null,
    sharesOutstanding: s.sharesOutstanding !== null ? Number(s.sharesOutstanding) : null,
    bookValuePerShare: s.bookValuePerShare !== null ? Number(s.bookValuePerShare) : null,
    promoterPledgePct: s.promoterPledgePct !== null ? Number(s.promoterPledgePct) : null,
    relatedPartyTxn: s.relatedPartyTxn !== null ? Number(s.relatedPartyTxn) : null,
    auditorQualification: s.auditorQualification,
    currency: s.currency,
    unit: s.unit,
    adjustmentStatus: s.adjustmentStatus,
    quality: s.quality,
    sourceDocumentRef: s.sourceDocumentRef,
    fetchedAt: s.fetchedAt instanceof Date ? s.fetchedAt.toISOString() : new Date(s.fetchedAt || now).toISOString(),
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : new Date(s.createdAt || now).toISOString(),
  }));

  return createSuccessResponse(
    {
      count: formatted.length,
      statements: formatted,
    },
    requestId,
    201
  );
});
