/**
 * Monitoring, Alerts & Trade Journal API Integration Tests
 *
 * Verifies:
 * 1. GET /api/v1/alerts — lists active/acknowledged alerts for user.
 * 2. POST /api/v1/alerts/[id]/acknowledge — acknowledges alert and appends AuditEvent.
 * 3. POST /api/v1/journal — creates journal entry for valid trade plan (404 if plan missing).
 * 4. PATCH /api/v1/journal/[id]/review — enforces post-trade review validation and appends review.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@stock-assistant/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stock-assistant/db')>();
  return {
    ...actual,
    prisma: {
      alert: {
        findMany: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
      },
      tradePlan: {
        findFirst: vi.fn(),
      },
      journalEntry: {
        findMany: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      portfolioHolding: {
        findFirst: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    AlertRepository: class {
      constructor(private prismaClient: any) {}
      async acknowledge(id: string, userId: string, acknowledgedBy: string) {
        return {} as any;
      }
    },
    JournalRepository: class {
      constructor(private prismaClient: any) {}
      async listByUser(userId: string, filter?: any) {
        return [] as any;
      }
      async listByTradePlan(tradePlanId: string, userId: string) {
        return [] as any;
      }
      async createEntry(userId: string, data: any) {
        return {} as any;
      }
      async appendReview(id: string, userId: string, review: any) {
        return {} as any;
      }
    },
  };
});

vi.mock('@/lib/api-handler', () => import('../../../../lib/api-handler'));
vi.mock('@/lib/api-response', () => import('../../../../lib/api-response'));

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  getSession: vi.fn(),
}));

import { GET as getAlerts } from '../alerts/route';
import { POST as acknowledgeAlert } from '../alerts/[id]/acknowledge/route';
import { GET as getJournal, POST as createJournalEntry } from '../journal/route';
import { PATCH as appendJournalReview } from '../journal/[id]/review/route';

import { prisma, AlertRepository, JournalRepository } from '@stock-assistant/db';
import { requireAuth } from '@/lib/auth';

const mockRequireAuth = vi.mocked(requireAuth);
const mockAlertFindMany = vi.mocked(prisma.alert.findMany);
const mockTradePlanFindFirst = vi.mocked(prisma.tradePlan.findFirst);
const mockAuditEventCreate = vi.mocked(prisma.auditEvent.create);
const mockTransaction = vi.mocked(prisma.$transaction);

describe('Monitoring, Alerts & Journal Route Handlers', () => {
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
    mockTransaction.mockImplementation(async (cb: any) => cb(prisma));
  });

  // ==========================================================================
  // 1. GET /api/v1/alerts
  // ==========================================================================
  describe('GET /api/v1/alerts', () => {
    it('returns 200 with user alerts matching query filters', async () => {
      const now = new Date();
      mockAlertFindMany.mockResolvedValue([
        {
          id: 'alert_001',
          userId: 'owner_user_01',
          companyId: 'comp_tcs',
          type: 'price-target',
          severity: 'warning',
          message: 'Target 1 reached at 3600',
          triggeredAt: now,
          acknowledgedAt: null,
          acknowledgedBy: null,
          data: { currentPrice: 3610 },
          relatedTradePlanId: 'tp_001',
        } as any,
      ]);

      const req = new NextRequest('http://localhost:3000/api/v1/alerts?status=active&severity=warning');
      const res = await getAlerts(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('alert_001');
      expect(body.data[0].type).toBe('price-target');
      expect(mockAlertFindMany).toHaveBeenCalledWith({
        where: {
          userId: 'owner_user_01',
          acknowledgedAt: null,
          severity: 'warning',
        },
        orderBy: { triggeredAt: 'desc' },
        take: 50,
      });
    });
  });

  // ==========================================================================
  // 2. POST /api/v1/alerts/[id]/acknowledge
  // ==========================================================================
  describe('POST /api/v1/alerts/[id]/acknowledge', () => {
    it('acknowledges active alert and creates an AuditEvent', async () => {
      const ackDate = new Date();
      const mockUpdatedAlert = {
        id: 'alert_001',
        userId: 'owner_user_01',
        companyId: 'comp_tcs',
        type: 'price-target',
        severity: 'warning',
        message: 'Target 1 reached at 3600',
        triggeredAt: new Date(Date.now() - 3600000),
        acknowledgedAt: ackDate,
        acknowledgedBy: 'investor@stokiffy.local',
        data: {},
      };

      vi.spyOn(AlertRepository.prototype, 'acknowledge').mockResolvedValue(mockUpdatedAlert as any);
      mockAuditEventCreate.mockResolvedValue({ id: 'audit_01' } as any);

      const req = new NextRequest('http://localhost:3000/api/v1/alerts/alert_001/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Acknowledged target reach, will prepare trim' }),
      });

      const res = await acknowledgeAlert(req, { params: { id: 'alert_001' } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('alert_001');
      expect(body.data.acknowledgedBy).toBe('investor@stokiffy.local');
      expect(mockAuditEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'owner_user_01',
          action: 'ACKNOWLEDGE_ALERT',
          entityType: 'Alert',
          entityId: 'alert_001',
        }),
      });
    });
  });

  // ==========================================================================
  // 3. POST /api/v1/journal
  // ==========================================================================
  describe('POST /api/v1/journal', () => {
    it('returns 404 when trade plan does not exist or does not belong to user', async () => {
      mockTradePlanFindFirst.mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/v1/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradePlanId: 'tp_non_existent',
          action: 'buy',
          quantity: 20,
          price: 3200,
          date: '2024-03-28T00:00:00.000Z',
          reason: 'Initial position entry',
        }),
      });

      const res = await createJournalEntry(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('creates journal entry, calculates P&L and updates portfolio holding', async () => {
      const now = new Date();
      mockTradePlanFindFirst.mockResolvedValue({
        id: 'tp_001',
        userId: 'owner_user_01',
        companyId: 'comp_tcs',
        symbol: 'TCS',
        company: { id: 'comp_tcs', symbol: 'TCS', sector: 'IT services' },
      } as any);

      const mockCreatedEntry = {
        id: 'je_001',
        tradePlanId: 'tp_001',
        userId: 'owner_user_01',
        date: now,
        action: 'buy',
        quantity: 20,
        price: 3200,
        fees: 25,
        taxes: 10,
        reason: 'Executed Stage F plan',
        ruleTriggers: [],
        realisedPnl: 0,
        unrealisedPnl: 0,
        returnPct: 0,
        corporateActions: [],
        review: null,
        reviewedAt: null,
        reviewedBy: null,
        createdAt: now,
      };

      vi.spyOn(JournalRepository.prototype, 'listByTradePlan').mockResolvedValue([]);
      vi.spyOn(JournalRepository.prototype, 'createEntry').mockResolvedValue(mockCreatedEntry as any);
      vi.spyOn(JournalRepository.prototype, 'listByUser').mockResolvedValue([mockCreatedEntry] as any);
      (prisma.portfolioHolding.findFirst as any).mockResolvedValue(null);
      (prisma.portfolioHolding.create as any).mockResolvedValue({ id: 'ph_001' });
      (prisma.portfolioHolding.upsert as any).mockResolvedValue({ id: 'ph_001' });
      mockAuditEventCreate.mockResolvedValue({ id: 'audit_je_01' } as any);

      const req = new NextRequest('http://localhost:3000/api/v1/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradePlanId: 'tp_001',
          action: 'buy',
          quantity: 20,
          price: 3200,
          fees: 25,
          taxes: 10,
          date: now.toISOString(),
          reason: 'Executed Stage F plan',
        }),
      });

      const res = await createJournalEntry(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('je_001');
      expect(body.data.quantity).toBe(20);
      expect(body.data.price).toBe(3200);
    });
  });

  // ==========================================================================
  // 4. PATCH /api/v1/journal/[id]/review
  // ==========================================================================
  describe('PATCH /api/v1/journal/[id]/review', () => {
    it('returns 400 VALIDATION_FAILED when review fails validation checks', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/journal/je_001/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review: {
            rulesWorked: [], // Empty rulesWorked fails validation!
            assumptionsFailed: [],
            executionQuality: 'good',
            slippage: 0.1,
            behaviouralNotes: 'Followed discipline',
            lesson: '   ', // Whitespace-only lesson fails validation!
            reviewedAt: new Date().toISOString(),
            reviewedBy: 'investor@stokiffy.local',
          },
        }),
      });

      const res = await appendJournalReview(req, { params: { id: 'je_001' } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.message).toContain('Post-trade review validation failed');
    });

    it('successfully appends validated post-trade review and emits AuditEvent', async () => {
      const reviewDate = new Date();
      const mockUpdated = {
        id: 'je_001',
        tradePlanId: 'tp_001',
        date: reviewDate,
        action: 'buy',
        quantity: 20,
        price: 3200,
        fees: 25,
        taxes: 10,
        reason: 'Executed Stage F plan',
        review: {
          rulesWorked: ['Stage E confirmed engulfing', 'Stage F position sizing cap'],
          assumptionsFailed: [],
          executionQuality: 'good',
          slippage: 0.05,
          behaviouralNotes: 'Waited patiently for confirmation candle',
          lesson: 'Rule discipline prevented overpaying above buy zone.',
        },
        reviewedAt: reviewDate,
        reviewedBy: 'investor@stokiffy.local',
      };

      vi.spyOn(JournalRepository.prototype, 'appendReview').mockResolvedValue(mockUpdated as any);
      mockAuditEventCreate.mockResolvedValue({ id: 'audit_rev_01' } as any);

      const req = new NextRequest('http://localhost:3000/api/v1/journal/je_001/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review: {
            rulesWorked: ['Stage E confirmed engulfing', 'Stage F position sizing cap'],
            assumptionsFailed: [],
            executionQuality: 'good',
            slippage: 0.05,
            behaviouralNotes: 'Waited patiently for confirmation candle',
            lesson: 'Rule discipline prevented overpaying above buy zone.',
            reviewedAt: reviewDate.toISOString(),
            reviewedBy: 'investor@stokiffy.local',
          },
        }),
      });

      const res = await appendJournalReview(req, { params: { id: 'je_001' } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('je_001');
      expect(body.data.reviewedBy).toBe('investor@stokiffy.local');
      expect(mockAuditEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'owner_user_01',
          action: 'APPEND_JOURNAL_REVIEW',
          entityType: 'JournalEntry',
          entityId: 'je_001',
        }),
      });
    });
  });
});
