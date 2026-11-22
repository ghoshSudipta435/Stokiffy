import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@stock-assistant/db';
import { parseOHLCVCSV, type ParsedOHLCVBar } from '@stock-assistant/data-providers';

export const dynamic = 'force-dynamic';

const jsonBarSchema = z
  .object({
    date: z.string().min(1, 'Date is required'),
    open: z.number().positive('Open price must be positive'),
    high: z.number().positive('High price must be positive'),
    low: z.number().positive('Low price must be positive'),
    close: z.number().positive('Close price must be positive'),
    volume: z.number().nonnegative('Volume must be non-negative'),
    adjustedClose: z.number().positive('Adjusted close must be positive').optional().nullable(),
  })
  .refine((b) => b.high >= b.low, {
    message: 'High cannot be less than low',
    path: ['high'],
  })
  .refine((b) => b.high >= Math.max(b.open, b.close), {
    message: 'High must be >= max(open, close)',
    path: ['high'],
  })
  .refine((b) => b.low <= Math.min(b.open, b.close), {
    message: 'Low must be <= min(open, close)',
    path: ['low'],
  });

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

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 2000) : 500;
  const fromParam = req.nextUrl.searchParams.get('from');
  const toParam = req.nextUrl.searchParams.get('to');
  const order = req.nextUrl.searchParams.get('order') === 'desc' ? 'desc' : 'asc';

  const priceBars = await prisma.priceBar.findMany({
    where: {
      companyId: company.id,
      ...(fromParam || toParam
        ? {
            date: {
              ...(fromParam ? { gte: new Date(fromParam) } : {}),
              ...(toParam ? { lte: new Date(toParam) } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: order },
    take: limit,
  });

  const formatted = priceBars.map((pb) => ({
    id: pb.id,
    companyId: pb.companyId,
    date: pb.date.toISOString(),
    open: Number(pb.open),
    high: Number(pb.high),
    low: Number(pb.low),
    close: Number(pb.close),
    volume: Number(pb.volume),
    adjusted: pb.adjusted,
    corporateActionType: pb.corporateActionType,
    createdAt: pb.createdAt.toISOString(),
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

  let barsToImport: ParsedOHLCVBar[] = [];
  let parseErrors: Array<{ rowNumber: number; message: string }> = [];

  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('text/csv')) {
    const csvText = await req.text();
    const result = parseOHLCVCSV(csvText);
    barsToImport = result.bars;
    parseErrors = result.errors.map((e) => ({
      rowNumber: e.rowNumber,
      message: e.message,
    }));
  } else {
    const body = await req.json();

    if (body && typeof body.csv === 'string') {
      const result = parseOHLCVCSV(body.csv);
      barsToImport = result.bars;
      parseErrors = result.errors.map((e) => ({
        rowNumber: e.rowNumber,
        message: e.message,
      }));
    } else {
      const rawBars = Array.isArray(body)
        ? body
        : body && Array.isArray(body.bars)
        ? body.bars
        : [body];

      for (let i = 0; i < rawBars.length; i++) {
        const raw = rawBars[i];
        const parsed = jsonBarSchema.safeParse(raw);
        if (!parsed.success) {
          parseErrors.push({
            rowNumber: i + 1,
            message: parsed.error.issues.map((iss) => iss.message).join('; '),
          });
        } else {
          const b = parsed.data;
          let barDate: string;
          if (/^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
            barDate = `${b.date}T00:00:00.000Z`;
          } else {
            const d = new Date(b.date);
            if (isNaN(d.getTime())) {
              parseErrors.push({
                rowNumber: i + 1,
                message: `Invalid date: ${b.date}`,
              });
              continue;
            }
            barDate = d.toISOString();
          }

          barsToImport.push({
            date: barDate,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume,
            adjustedClose: b.adjustedClose ?? undefined,
          });
        }
      }
    }
  }

  if (barsToImport.length === 0) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'No valid OHLCV price bars found in payload',
      400,
      requestId,
      parseErrors.map((err) => ({
        field: `row_${err.rowNumber}`,
        message: err.message,
      }))
    );
  }

  const upserted = await prisma.$transaction(async (tx) => {
    const records = [];

    for (const bar of barsToImport) {
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
        action: 'IMPORT_PRICE_BARS',
        entityType: 'PriceBar',
        entityId: company.id,
        reason: `Imported ${records.length} OHLCV price bars for ${company.symbol}`,
        afterState: {
          companyId: company.id,
          symbol: company.symbol,
          count: records.length,
          startDate: barsToImport[0]?.date,
          endDate: barsToImport[barsToImport.length - 1]?.date,
          parseErrorsCount: parseErrors.length,
        },
      },
    });

    return records;
  });

  return createSuccessResponse(
    {
      count: upserted.length,
      skippedErrorsCount: parseErrors.length,
      skippedErrors: parseErrors,
      importedBars: upserted.map((pb) => ({
        id: pb.id,
        companyId: pb.companyId,
        date: pb.date instanceof Date ? pb.date.toISOString() : new Date(pb.date).toISOString(),
        open: Number(pb.open),
        high: Number(pb.high),
        low: Number(pb.low),
        close: Number(pb.close),
        volume: Number(pb.volume),
        adjusted: pb.adjusted,
        createdAt: pb.createdAt instanceof Date ? pb.createdAt.toISOString() : new Date(pb.createdAt || Date.now()).toISOString(),
      })),
    },
    requestId,
    201
  );
});
