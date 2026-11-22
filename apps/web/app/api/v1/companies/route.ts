import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createPaginatedResponse, createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@stock-assistant/db';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  q: z.string().optional(),
  sector: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export interface CompanySummaryDTO {
  id: string;
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  sector: string;
  industry: string;
  isDemoData: boolean;
  marketCapCrores?: number;
  currentPrice?: number;
  peRatio?: number;
  roce?: number;
  roe?: number;
  activeFlagsCount: number;
  lastUpdated?: string;
}

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.parse(searchParams);

  const companies = await prisma.company.findMany({
    where: {
      userId,
      isActive: true,
      ...(parsed.q
        ? {
            OR: [
              { symbol: { contains: parsed.q, mode: 'insensitive' } },
              { name: { contains: parsed.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(parsed.sector ? { sector: { equals: parsed.sector, mode: 'insensitive' } } : {}),
    },
    take: parsed.limit,
    ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
    orderBy: { symbol: 'asc' },
  });

  const enriched = await Promise.all(
    companies.map(async (company) => {
      const activeFlagsCount = await prisma.redFlag.count({
        where: { companyId: company.id, status: 'ACTIVE' },
      });

      const latest = await prisma.financialStatement.findFirst({
        where: { companyId: company.id },
        orderBy: { fiscalYear: 'desc' },
      });

      let roe: number | undefined;
      if (latest && latest.netProfit !== null && latest.totalEquity !== null) {
        roe = Number(latest.netProfit) / Number(latest.totalEquity);
      }

      return {
        id: company.id,
        symbol: company.symbol,
        name: company.name,
        exchange: company.exchange as 'NSE' | 'BSE',
        sector: company.sector,
        industry: company.sector,
        isDemoData: false,
        activeFlagsCount,
        roe,
        lastUpdated: company.updatedAt.toISOString(),
      } as CompanySummaryDTO;
    })
  );

  const hasMore = enriched.length === parsed.limit;
  const nextCursor = hasMore ? enriched[enriched.length - 1]!.id : null;

  return createPaginatedResponse(
    enriched,
    { limit: parsed.limit, hasMore, cursor: nextCursor, totalCount: enriched.length },
    requestId
  );
});

const createCompanySchema = z.object({
  symbol: z
    .string()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol cannot exceed 20 characters')
    .trim()
    .toUpperCase(),
  name: z
    .string()
    .min(1, 'Company name is required')
    .max(255, 'Company name cannot exceed 255 characters')
    .trim(),
  exchange: z.enum(['NSE', 'BSE', 'NSE_BSE']).default('NSE'),
  sector: z.string().min(1, 'Sector is required').trim(),
  industry: z.string().min(1).trim().optional(),
  isin: z
    .string()
    .regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, 'Invalid ISIN format')
    .optional()
    .nullable(),
});

export const POST = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const body = await req.json();
  const parsed = createCompanySchema.parse(body);

  const existing = await prisma.company.findFirst({
    where: { userId, symbol: parsed.symbol },
  });

  if (existing) {
    return createErrorResponse(
      'CONFLICT',
      `Company with symbol '${parsed.symbol}' already exists for your account`,
      409,
      requestId
    );
  }

  const company = await prisma.company.create({
    data: {
      userId,
      symbol: parsed.symbol,
      name: parsed.name,
      exchange: parsed.exchange,
      sector: parsed.sector,
      isin: parsed.isin ?? null,
      isActive: true,
    },
  });

  await prisma.auditEvent.create({
    data: {
      userId,
      action: 'CREATE_COMPANY',
      entityType: 'Company',
      entityId: company.id,
      reason: `Manual creation of company ${company.symbol} (${company.name})`,
      afterState: {
        id: company.id,
        symbol: company.symbol,
        name: company.name,
        exchange: company.exchange,
        sector: company.sector,
        industry: parsed.industry ?? company.sector,
        isin: company.isin,
      },
    },
  });

  return createSuccessResponse(
    {
      id: company.id,
      symbol: company.symbol,
      name: company.name,
      exchange: company.exchange,
      sector: company.sector,
      industry: parsed.industry ?? company.sector,
      isin: company.isin,
      isActive: company.isActive,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
    },
    requestId,
    201
  );
});
