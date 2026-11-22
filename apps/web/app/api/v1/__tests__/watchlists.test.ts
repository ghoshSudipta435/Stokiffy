/**
 * Watchlists API Integration Tests
 *
 * Verifies:
 * 1. GET /api/v1/watchlists — lists user watchlists with item counts.
 * 2. POST /api/v1/watchlists — validates payload (rejects empty name with 400).
 * 3. POST /api/v1/watchlists — creates watchlist and returns 201.
 * 4. Auth enforcement — rejects unauthorized requests when unauthenticated.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@stock-assistant/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stock-assistant/db')>();
  return {
    ...actual,
    prisma: {
      watchlist: {
        findMany: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/api-handler', () => import('../../../../lib/api-handler'));
vi.mock('@/lib/api-response', () => import('../../../../lib/api-response'));

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  getSession: vi.fn(),
}));

import { GET, POST } from '../watchlists/route';
import { prisma } from '@stock-assistant/db';
import { requireAuth } from '@/lib/auth';

const mockRequireAuth = vi.mocked(requireAuth);
const mockWatchlistFindMany = vi.mocked(prisma.watchlist.findMany);
const mockWatchlistCreate = vi.mocked(prisma.watchlist.create);

describe('/api/v1/watchlists route handlers', () => {
  const mockUser = {
    user: {
      id: 'owner_user_01',
      email: 'investor@stokiffy.local',
      name: 'Stokiffy Investor',
      role: 'OWNER' as const,
    },
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
  });

  describe('GET /api/v1/watchlists', () => {
    it('returns 200 with user watchlists and item counts', async () => {
      const now = new Date();
      mockWatchlistFindMany.mockResolvedValue([
        {
          id: 'wl_001',
          userId: 'owner_user_01',
          name: 'Core Compounders',
          description: 'High-quality Indian growth leaders',
          createdAt: now,
          updatedAt: now,
          _count: { items: 3 },
        } as any,
      ]);

      const req = new NextRequest('http://localhost:3000/api/v1/watchlists');
      const res = await GET(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('Core Compounders');
      expect(body.data[0].itemCount).toBe(3);
      expect(mockWatchlistFindMany).toHaveBeenCalledWith({
        where: { userId: 'owner_user_01' },
        include: { _count: { select: { items: true } } },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('returns 500 / error when unauthenticated or auth fails', async () => {
      mockRequireAuth.mockRejectedValue(new Error('UNAUTHORIZED'));

      const req = new NextRequest('http://localhost:3000/api/v1/watchlists');
      const res = await GET(req, { params: {} });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('POST /api/v1/watchlists', () => {
    it('rejects with 400 when name is empty', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', description: 'Empty name test' }),
      });

      const res = await POST(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(mockWatchlistCreate).not.toHaveBeenCalled();
    });

    it('returns 201 and created watchlist on valid payload', async () => {
      const now = new Date();
      mockWatchlistCreate.mockResolvedValue({
        id: 'wl_new_001',
        userId: 'owner_user_01',
        name: 'IT Leaders',
        description: 'Large cap tech compounders',
        createdAt: now,
        updatedAt: now,
      });

      const req = new NextRequest('http://localhost:3000/api/v1/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'IT Leaders',
          description: 'Large cap tech compounders',
        }),
      });

      const res = await POST(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('wl_new_001');
      expect(body.data.name).toBe('IT Leaders');
      expect(mockWatchlistCreate).toHaveBeenCalledWith({
        data: {
          userId: 'owner_user_01',
          name: 'IT Leaders',
          description: 'Large cap tech compounders',
        },
      });
    });
  });
});
