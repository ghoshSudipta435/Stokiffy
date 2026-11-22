import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { YahooFinanceMarketDataProvider } from '@stock-assistant/data-providers';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: NextRequest, { requestId }) => {
  await requireAuth(req);

  const q = req.nextUrl.searchParams.get('q')?.trim() || '';

  if (q.length < 2) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'Search query parameter "q" must be at least 2 characters',
      400,
      requestId
    );
  }

  const provider = new YahooFinanceMarketDataProvider();
  const results = await provider.searchSymbols(q);

  return createSuccessResponse(results, requestId);
});
