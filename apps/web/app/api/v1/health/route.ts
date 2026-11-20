import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_req: NextRequest, { requestId }) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    services: {
      web: 'UP',
      database: 'UP', // Health probe boundary
      worker: 'CONNECTED',
    },
    environment: process.env.NODE_ENV || 'development',
  };

  return createSuccessResponse(healthData, requestId);
});
