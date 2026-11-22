/**
 * Rule Sets API Integration Tests
 *
 * Verifies:
 * 1. GET /api/v1/rule-sets — returns active published RuleSet and all available versions.
 * 2. PATCH /api/v1/rule-sets/settings — validates risk limit bounds (rejects negative numbers and >100%).
 * 3. PATCH /api/v1/rule-sets/settings — updates workstation risk limits and benchmarks, emitting AuditEvent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@stock-assistant/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stock-assistant/db')>();
  return {
    ...actual,
    prisma: {
      ruleSet: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
    },
    RuleSetRepository: class {
      constructor(private prismaClient: any) {}
      async getActivePublished() {
        return null as any;
      }
      async getByVersion(version: string) {
        return null as any;
      }
      async listVersions() {
        return [] as any;
      }
      async upsertDraft(version: string, data: any) {
        return {} as any;
      }
      async publishVersion(version: string) {
        return {} as any;
      }
      async bulkUpsertBenchmarks(ruleSetId: string, benchmarks: any[]) {
        return [] as any;
      }
      async getBenchmarks(ruleSetId: string) {
        return [] as any;
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

import { GET } from '../rule-sets/route';
import { PATCH } from '../rule-sets/settings/route';
import { prisma, RuleSetRepository } from '@stock-assistant/db';
import { requireAuth } from '@/lib/auth';

const mockRequireAuth = vi.mocked(requireAuth);
const mockRuleSetUpdate = vi.mocked(prisma.ruleSet.update);
const mockAuditEventCreate = vi.mocked(prisma.auditEvent.create);

describe('/api/v1/rule-sets route handlers', () => {
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

  describe('GET /api/v1/rule-sets', () => {
    it('returns active published rule set with risk limits and version list', async () => {
      const now = new Date();
      const mockActiveRuleSet = {
        id: 'rs_001',
        version: 'v1.0.0',
        name: 'Default Stock Assistant V1 Policy',
        status: 'PUBLISHED',
        configJson: {
          riskLimits: {
            riskBudgetPerTradePct: 1.0,
            maxStockExposurePct: 10.0,
            maxSectorExposurePct: 30.0,
            minRiskReward: 1.5,
          },
        },
        benchmarks: [
          {
            id: 'bm_001',
            industry: 'IT services',
            opmMinPct: 20.0,
            opmMaxPct: 30.0,
            typicalPE: 25.0,
            minRoaPct: 12.0,
            sourceNote: 'Nifty IT 10Y Median',
          },
        ],
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      vi.spyOn(RuleSetRepository.prototype, 'getActivePublished').mockResolvedValue(mockActiveRuleSet as any);
      vi.spyOn(RuleSetRepository.prototype, 'listVersions').mockResolvedValue([mockActiveRuleSet as any]);

      const req = new NextRequest('http://localhost:3000/api/v1/rule-sets');
      const res = await GET(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.activeRuleSet).toBeDefined();
      expect(body.data.activeRuleSet.version).toBe('v1.0.0');
      expect(body.data.activeRuleSet.riskLimits.riskBudgetPerTradePct).toBe(1.0);
      expect(body.data.activeRuleSet.benchmarks).toHaveLength(1);
      expect(body.data.versions).toHaveLength(1);
    });
  });

  describe('PATCH /api/v1/rule-sets/settings', () => {
    it('rejects with 400 VALIDATION_FAILED when risk limit values are out of bounds', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/rule-sets/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riskLimits: {
            riskBudgetPerTradePct: -5, // Invalid: must be positive
            maxStockExposurePct: 150, // Invalid: max 100%
          },
        }),
      });

      const res = await PATCH(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(mockRuleSetUpdate).not.toHaveBeenCalled();
    });

    it('successfully updates risk limits and industry benchmarks, creating an AuditEvent', async () => {
      const mockRuleSet = {
        id: 'rs_001',
        version: 'v1.0.0',
        name: 'Default Stock Assistant V1 Policy',
        status: 'PUBLISHED',
        configJson: {
          riskLimits: {
            riskBudgetPerTradePct: 1.0,
            maxStockExposurePct: 10.0,
            maxSectorExposurePct: 30.0,
            minRiskReward: 1.5,
          },
        },
      };

      vi.spyOn(RuleSetRepository.prototype, 'getActivePublished').mockResolvedValue(mockRuleSet as any);
      vi.spyOn(RuleSetRepository.prototype, 'bulkUpsertBenchmarks').mockResolvedValue([] as any);
      vi.spyOn(RuleSetRepository.prototype, 'getBenchmarks').mockResolvedValue([
        {
          id: 'bm_it_01',
          ruleSetId: 'rs_001',
          industry: 'IT services',
          opmMinPct: 22.0,
          opmMaxPct: 32.0,
          typicalPE: 26.0,
          minRoaPct: 15.0,
          sourceNote: 'Updated Q4 Benchmark',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);
      mockRuleSetUpdate.mockResolvedValue({ id: 'rs_001' } as any);
      mockAuditEventCreate.mockResolvedValue({ id: 'audit_rs_01' } as any);

      const req = new NextRequest('http://localhost:3000/api/v1/rule-sets/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riskLimits: {
            riskBudgetPerTradePct: 1.5,
            maxStockExposurePct: 12.0,
          },
          benchmarks: [
            {
              industry: 'IT services',
              opmMinPct: 22.0,
              opmMaxPct: 32.0,
              typicalPE: 26.0,
              minRoaPct: 15.0,
              sourceNote: 'Updated Q4 Benchmark',
            },
          ],
        }),
      });

      const res = await PATCH(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.ruleSetId).toBe('rs_001');
      expect(body.data.riskLimits.riskBudgetPerTradePct).toBe(1.5);
      expect(body.data.riskLimits.maxStockExposurePct).toBe(12.0);
      expect(body.data.benchmarks).toHaveLength(1);
      expect(body.data.benchmarks[0].industry).toBe('IT services');
      expect(mockRuleSetUpdate).toHaveBeenCalledWith({
        where: { id: 'rs_001' },
        data: {
          configJson: expect.objectContaining({
            riskLimits: expect.objectContaining({
              riskBudgetPerTradePct: 1.5,
              maxStockExposurePct: 12.0,
            }),
          }),
        },
      });
      expect(mockAuditEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'owner_user_01',
          action: 'UPDATE_RULE_SET_SETTINGS',
          entityType: 'RuleSet',
          entityId: 'rs_001',
        }),
      });
    });
  });
});
