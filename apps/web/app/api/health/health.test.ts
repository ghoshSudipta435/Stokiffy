import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { prisma } from '@stock-assistant/db';

vi.mock('@stock-assistant/db', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 OK with db connected status when database is reachable', async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ '?column?': 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.db).toBe('connected');
    expect(body.timestamp).toBeDefined();
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns 503 Service Unavailable when database connection fails', async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.db).toBe('disconnected');
    expect(body.error).toBe('Connection terminated unexpectedly');
    expect(body.timestamp).toBeDefined();
  });
});
