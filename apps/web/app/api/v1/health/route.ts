import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse } from '@/lib/api-response';
import { prisma } from '@stock-assistant/db';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_req: NextRequest, { requestId }) => {
  let dbStatus = 'UP';
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
  } catch {
    dbStatus = 'DOWN';
  }

  const healthData = {
    status: dbStatus === 'UP' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    services: {
      web: 'UP',
      database: dbStatus,
      worker: 'CONNECTED',
    },
    environment: process.env.NODE_ENV || 'development',
  };

  return createSuccessResponse(healthData, requestId);
});
