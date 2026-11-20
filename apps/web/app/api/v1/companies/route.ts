import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createPaginatedResponse } from '@/lib/api-response';

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

// Clearly identified demonstration fixtures for technical UI layout verification only.
// Real financial metrics and company data will be provided via packages/db in Phase 1B.
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
  },
];

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.parse(searchParams);

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

  const limit = parsed.limit;
  const paginatedData = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;

  return createPaginatedResponse(
    paginatedData,
    {
      limit,
      hasMore,
      cursor: hasMore ? paginatedData[paginatedData.length - 1]?.id : null,
      totalCount: filtered.length,
    },
    requestId
  );
});
