import { NextResponse } from 'next/server';
import { prisma } from '@stock-assistant/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRawUnsafe('SELECT 1');

    return NextResponse.json(
      {
        status: 'ok',
        db: 'connected',
        timestamp,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        db: 'disconnected',
        error: error?.message || 'Database unreachable',
        timestamp,
      },
      { status: 503 }
    );
  }
}
