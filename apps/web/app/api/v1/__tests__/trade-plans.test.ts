/**
 * Trade Plans API Integration Tests
 *
 * Verifies:
 * 1. GET /api/v1/trade-plans — returns trade plans for authenticated user.
 * 2. POST /api/v1/trade-plans — handles risk-cap blocking (persists blocked plan with BLOCKED status).
 * 3. POST /api/v1/trade-plans — accepts valid risk override (>= 50 chars) and persists override record.
 * 4. POST /api/v1/trade-plans — returns 201 with tradePlan and stageF output.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@stock-assistant/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stock-assistant/db')>();
  return {
    ...actual,
    prisma: {
      tradePlan: {
        findMany: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

vi.mock('@/lib/api-handler', () => import('../../../../lib/api-handler'));
vi.mock('@/lib/api-response', () => import('../../../../lib/api-response'));

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('@/lib/services/stage-f-runner', () => ({
  runStageFForCompany: vi.fn(),
}));

import { GET, POST } from '../trade-plans/route';
import { prisma } from '@stock-assistant/db';
import { requireAuth } from '@/lib/auth';
import { runStageFForCompany } from '@/lib/services/stage-f-runner';

const mockRequireAuth = vi.mocked(requireAuth);
const mockTradePlanFindMany = vi.mocked(prisma.tradePlan.findMany);
const mockRunStageFForCompany = vi.mocked(runStageFForCompany);
const mockTransaction = vi.mocked(prisma.$transaction);

describe('/api/v1/trade-plans route handlers', () => {
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

  describe('GET /api/v1/trade-plans', () => {
    it('returns 200 with trade plans for authenticated user', async () => {
      const now = new Date();
      mockTradePlanFindMany.mockResolvedValue([
        {
          id: 'plan_001',
          userId: 'owner_user_01',
          companyId: 'comp_tcs',
          symbol: 'TCS',
          status: 'DRAFT',
          blocked: false,
          createdAt: now,
          company: { id: 'comp_tcs', symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT services' },
          overrides: [],
        } as any,
      ]);

      const req = new NextRequest('http://localhost:3000/api/v1/trade-plans?status=DRAFT');
      const res = await GET(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].symbol).toBe('TCS');
      expect(mockTradePlanFindMany).toHaveBeenCalledWith({
        where: {
          userId: 'owner_user_01',
          status: 'DRAFT',
        },
        include: {
          company: { select: { id: true, symbol: true, name: true, sector: true } },
          overrides: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('POST /api/v1/trade-plans', () => {
    const baseRequestPayload = {
      companyId: 'comp_tcs',
      entryPrice: 3200,
      stopPrice: 3050,
      targets: [3600, 3900],
      thesis: 'Market-leading enterprise IT leader with 26% OPM, wide switching costs, trading at >20% MOS.',
      entryRationale: 'Confirmed bullish engulfing pattern at 200 SMA support level.',
      invalidationCondition: 'Daily close below 3050 invalidates support setup.',
      expectedHoldingPeriod: '12-24 months',
    };

    it('creates trade plan in BLOCKED state when Stage F risk checks fail', async () => {
      mockRunStageFForCompany.mockResolvedValue({
        company: { id: 'comp_tcs', symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT services' },
        portfolio: { totalValue: 1000000, cash: 200000, positions: [], sectorExposure: {}, asOfDate: '2026-03-31' },
        input: { valuationMaxBuyPrice: 3240 } as any,
        output: {
          stage: 'F',
          blocked: true,
          gatePassed: false,
          ruleSetVersion: '1.0.0',
          tradePlan: {
            id: 'plan_tcs_blocked',
            status: 'BLOCKED',
            entryZone: { low: 3190, high: 3210 },
            stopLoss: 3050,
            targets: [3600],
            overrides: [],
            technicalSetupId: 'setup_001',
          },
          positionSizing: {
            adjustedQuantity: 30,
            entryPriceEst: 3200,
            riskBudget: 10000,
            plannedLossAtStop: 12000,
            postTradeStockExposurePct: 0.12,
            postTradeSectorExposurePct: 0.32,
            cashRemaining: 50000,
          },
          riskChecks: [
            { check: 'risk_budget', passed: false, message: 'Planned loss exceeds 1% risk budget' },
          ],
        } as any,
      });

      const mockCreatedPlan = {
        id: 'plan_db_blocked_01',
        userId: 'owner_user_01',
        companyId: 'comp_tcs',
        symbol: 'TCS',
        status: 'BLOCKED',
        blocked: true,
        positionSize: 30,
        riskBudget: 10000,
        overrides: [],
      };
      (prisma.tradePlan.create as any).mockResolvedValue(mockCreatedPlan);
      (prisma.auditEvent.create as any).mockResolvedValue({ id: 'audit_01' });

      const req = new NextRequest('http://localhost:3000/api/v1/trade-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseRequestPayload),
      });

      const res = await POST(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.tradePlan.blocked).toBe(true);
      expect(body.data.tradePlan.status).toBe('BLOCKED');
      expect(body.data.stageF.blocked).toBe(true);
      expect(mockRunStageFForCompany).toHaveBeenCalledWith({
        userId: 'owner_user_01',
        companyId: 'comp_tcs',
        entryPrice: 3200,
        stopPrice: 3050,
        targets: [3600, 3900],
        thesis: baseRequestPayload.thesis,
        invalidationCondition: 'Daily close below 3050 invalidates support setup.',
        expectedHoldingPeriod: '12-24 months',
        entryRationale: baseRequestPayload.entryRationale,
        requestedQuantity: undefined,
        riskPercentage: undefined,
        overrides: undefined,
      });
    });

    it('creates trade plan with recorded override when valid >=50 char justification is provided', async () => {
      const overrideReason = 'Thesis and balance sheet strength justify taking temporary elevated sector concentration for 2 quarters.';
      const overrides = [
        {
          flagId: 'STAGE_F_SECTOR_CAP_EXCEEDED',
          reason: overrideReason,
        },
      ];

      mockRunStageFForCompany.mockResolvedValue({
        company: { id: 'comp_tcs', symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT services' },
        portfolio: { totalValue: 1000000, cash: 200000, positions: [], sectorExposure: {}, asOfDate: '2026-03-31' },
        input: { valuationMaxBuyPrice: 3240 } as any,
        output: {
          stage: 'F',
          blocked: false, // Override unblocks plan!
          gatePassed: true,
          ruleSetVersion: '1.0.0',
          tradePlan: {
            id: 'plan_tcs_unblocked',
            status: 'APPROVED',
            entryZone: { low: 3190, high: 3210 },
            stopLoss: 3050,
            targets: [3600, 3900],
            overrides: [
              {
                flagId: 'STAGE_F_SECTOR_CAP_EXCEEDED',
                reason: overrideReason,
                overriddenBy: 'owner_user_01',
                beforeState: { blocked: true },
                afterState: { blocked: false },
              },
            ],
            technicalSetupId: 'setup_001',
          },
          positionSizing: {
            adjustedQuantity: 25,
            entryPriceEst: 3200,
            riskBudget: 10000,
            plannedLossAtStop: 3750,
            postTradeStockExposurePct: 0.08,
            postTradeSectorExposurePct: 0.32,
            cashRemaining: 200000,
          },
          riskChecks: [],
        } as any,
      });

      const mockCreatedPlan = {
        id: 'plan_db_approved_01',
        userId: 'owner_user_01',
        companyId: 'comp_tcs',
        symbol: 'TCS',
        status: 'APPROVED',
        blocked: false,
        positionSize: 25,
        riskBudget: 10000,
        overrides: [
          {
            flagId: 'STAGE_F_SECTOR_CAP_EXCEEDED',
            reason: overrideReason,
            overriddenBy: 'owner_user_01',
          },
        ],
      };
      (prisma.tradePlan.create as any).mockResolvedValue(mockCreatedPlan);
      (prisma.auditEvent.create as any).mockResolvedValue({ id: 'audit_02' });

      const req = new NextRequest('http://localhost:3000/api/v1/trade-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...baseRequestPayload,
          overrides,
        }),
      });

      const res = await POST(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.tradePlan.blocked).toBe(false);
      expect(body.data.tradePlan.status).toBe('APPROVED');
      expect(body.data.tradePlan.overrides).toHaveLength(1);
      expect(body.data.tradePlan.overrides[0].reason.length).toBeGreaterThanOrEqual(50);
      expect(mockRunStageFForCompany).toHaveBeenCalledWith(
        expect.objectContaining({
          overrides,
        })
      );
    });
  });
});
