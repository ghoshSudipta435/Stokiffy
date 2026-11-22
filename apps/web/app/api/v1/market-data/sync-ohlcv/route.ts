import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@stock-assistant/db';
import { YahooFinanceMarketDataProvider } from '@stock-assistant/data-providers';

export const dynamic = 'force-dynamic';

const syncOHLCVSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  symbol: z.string().min(1).optional(),
  exchange: z.enum(['NSE', 'BSE']).optional(),
  days: z.number().int().min(1).max(1825).default(365),
});

export const POST = apiHandler(async (req: NextRequest, { requestId }) => {
  const session = await requireAuth(req);
  const userId = session.user.id;

  const body = await req.json();
  const parsed = syncOHLCVSchema.parse(body);

  const company = await prisma.company.findFirst({
    where: {
      userId,
      OR: [
        { id: parsed.companyId },
        { symbol: { equals: parsed.companyId, mode: 'insensitive' } },
      ],
    },
  });

  if (!company) {
    return createErrorResponse(
      'RESOURCE_NOT_FOUND',
      `Company '${parsed.companyId}' not found`,
      404,
      requestId
    );
  }

  const symbolToFetch = parsed.symbol || company.symbol;
  const exchangeToFetch = (
    parsed.exchange ||
    (company.exchange as 'NSE' | 'BSE') ||
    'NSE'
  ) as 'NSE' | 'BSE';

  const days = parsed.days;
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const provider = new YahooFinanceMarketDataProvider();
  const result = await provider.getHistoricalBars(
    symbolToFetch,
    fromDate,
    toDate,
    exchangeToFetch
  );

  if (result.bars.length === 0) {
    if (result.errors.length > 0) {
      return createErrorResponse(
        'VALIDATION_FAILED',
        `Failed to fetch price bars from Yahoo Finance: ${result.errors.join('; ')}`,
        400,
        requestId
      );
    }
    return createSuccessResponse(
      {
        syncedCount: 0,
        latestPrice: null,
        latestDate: null,
        yahooSymbol: result.yahooSymbol,
      },
      requestId
    );
  }

  const upserted = await prisma.$transaction(async (tx) => {
    const records = [];

    for (const bar of result.bars) {
      const barDate = new Date(bar.date);
      const rec = await tx.priceBar.upsert({
        where: {
          companyId_date: {
            companyId: company.id,
            date: barDate,
          },
        },
        update: {
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: BigInt(Math.round(bar.volume)),
          adjusted: bar.adjustedClose !== undefined,
        },
        create: {
          companyId: company.id,
          date: barDate,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: BigInt(Math.round(bar.volume)),
          adjusted: bar.adjustedClose !== undefined,
        },
      });
      records.push(rec);
    }

    await tx.auditEvent.create({
      data: {
        userId,
        action: 'SYNC_OHLCV_YAHOO',
        entityType: 'PriceBar',
        entityId: company.id,
        reason: `Auto-synced ${records.length} daily OHLCV price bars from Yahoo Finance for ${company.symbol} (${result.yahooSymbol})`,
        afterState: {
          companyId: company.id,
          symbol: company.symbol,
          yahooSymbol: result.yahooSymbol,
          days,
          count: records.length,
          startDate: result.bars[0]?.date,
          endDate: result.bars[result.bars.length - 1]?.date,
        },
      },
    });

    return records;
  });

  const latestBar = result.bars[result.bars.length - 1];
  const latestPrice = latestBar ? latestBar.close : null;
  const latestDate = latestBar ? latestBar.date : null;

  return createSuccessResponse(
    {
      syncedCount: upserted.length,
      latestPrice,
      latestDate,
      yahooSymbol: result.yahooSymbol,
    },
    requestId,
    200
  );
});
