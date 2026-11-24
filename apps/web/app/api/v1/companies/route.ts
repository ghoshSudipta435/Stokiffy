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

const DEMO_COMPANIES: CompanySummaryDTO[] = [
  {
    id: 'comp_01',
    symbol: 'TCS',
    name: 'Tata Consultancy Services Ltd. [DEMO FIXTURE]',
    exchange: 'NSE',
    sector: 'Information Technology',
    industry: 'IT Services & Consulting',
    isDemoData: true,
    activeFlagsCount: 0,
    marketCapCrores: 1450000,
    currentPrice: 3950,
    peRatio: 30.5,
    roce: 58.2,
    roe: 49.5,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'comp_02',
    symbol: 'INFY',
    name: 'Infosys Limited [DEMO FIXTURE]',
    exchange: 'NSE',
    sector: 'Information Technology',
    industry: 'IT Services & Consulting',
    isDemoData: true,
    activeFlagsCount: 0,
    marketCapCrores: 780000,
    currentPrice: 1850,
    peRatio: 28.1,
    roce: 40.5,
    roe: 32.4,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'comp_03',
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Limited [DEMO FIXTURE]',
    exchange: 'NSE',
    sector: 'Financial Services',
    industry: 'Private Banks',
    isDemoData: true,
    activeFlagsCount: 0,
    marketCapCrores: 1320000,
    currentPrice: 1680,
    peRatio: 19.4,
    roce: 16.8,
    roe: 15.2,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'comp_04',
    symbol: 'RELIANCE',
    name: 'Reliance Industries Limited [DEMO FIXTURE]',
    exchange: 'NSE',
    sector: 'Energy',
    industry: 'Oil & Gas Refining & Marketing',
    isDemoData: true,
    activeFlagsCount: 1,
    marketCapCrores: 1980000,
    currentPrice: 2950,
    peRatio: 26.2,
    roce: 12.5,
    roe: 10.8,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'comp_05',
    symbol: 'TITAN',
    name: 'Titan Company Limited [DEMO FIXTURE]',
    exchange: 'NSE',
    sector: 'Consumer Discretionary',
    industry: 'Gems, Jewellery & Watches',
    isDemoData: true,
    activeFlagsCount: 0,
    marketCapCrores: 310000,
    currentPrice: 3550,
    peRatio: 85.3,
    roce: 32.1,
    roe: 28.6,
    lastUpdated: new Date().toISOString(),
  },
];

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.parse(searchParams);

  try {
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

    if (companies.length > 0) {
      const companyIds = companies.map((c) => c.id);

      const activeFlagsCounts = await prisma.redFlag.groupBy({
        by: ['companyId'],
        where: {
          companyId: { in: companyIds },
          status: 'ACTIVE',
        },
        _count: { id: true },
      });
      const flagCountMap = new Map(activeFlagsCounts.map((f) => [f.companyId, f._count.id]));

      const latestFinancials = await prisma.financialStatement.findMany({
        where: { companyId: { in: companyIds } },
        orderBy: { fiscalYear: 'desc' },
      });
      const latestFinancialMap = new Map<string, (typeof latestFinancials)[0]>();
      for (const fin of latestFinancials) {
        if (!latestFinancialMap.has(fin.companyId)) {
          latestFinancialMap.set(fin.companyId, fin);
        }
      }

      const enriched: CompanySummaryDTO[] = companies.map((company) => {
        const activeFlagsCount = flagCountMap.get(company.id) ?? 0;
        const latest = latestFinancialMap.get(company.id);

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
        };
      });

      const hasMore = enriched.length === parsed.limit;
      const nextCursor = hasMore ? enriched[enriched.length - 1]!.id : null;

      return createPaginatedResponse(
        enriched,
        { limit: parsed.limit, hasMore, cursor: nextCursor, totalCount: enriched.length },
        requestId
      );
    }
  } catch (dbError) {
    // Database connection error (e.g. Neon unreachable, sandboxed execution, offline mode)
    // Fall through to resilient demo fixtures
  }

  // Fallback to DEMO_COMPANIES
  let filtered = [...DEMO_COMPANIES];
  if (parsed.q) {
    const term = parsed.q.toLowerCase();
    filtered = filtered.filter(
      (c) => c.symbol.toLowerCase().includes(term) || c.name.toLowerCase().includes(term)
    );
  }

  if (parsed.sector) {
    filtered = filtered.filter((c) => c.sector.toLowerCase() === parsed.sector?.toLowerCase());
  }

  const paginated = filtered.slice(0, parsed.limit);
  return createPaginatedResponse(
    paginated,
    { limit: parsed.limit, hasMore: filtered.length > parsed.limit, cursor: null, totalCount: filtered.length },
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
