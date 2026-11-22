/**
 * Manual Data Entry API Integration Tests
 *
 * Verifies:
 * 1. POST /api/v1/companies — creates new company scoped to user with AuditEvent.
 * 2. GET & POST /api/v1/companies/[id]/financials — lists & upserts manual financials preserving nulls.
 * 3. GET & POST /api/v1/companies/[id]/price-bars — lists & imports OHLCV bars via JSON and CSV text.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@stock-assistant/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stock-assistant/db')>();
  return {
    ...actual,
    prisma: {
      company: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
      financialStatement: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      priceBar: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn((callback) =>
        callback({
          financialStatement: {
            findFirst: vi.fn(),
            create: vi.fn((args) => Promise.resolve({ id: 'fs_new', ...args.data })),
            update: vi.fn((args) => Promise.resolve({ id: args.where.id, ...args.data })),
          },
          priceBar: {
            upsert: vi.fn((args) => Promise.resolve({ id: 'pb_new', ...args.create })),
          },
          auditEvent: {
            create: vi.fn().mockResolvedValue({ id: 'audit_01' }),
          },
        })
      ),
    },
  };
});

vi.mock('@/lib/api-handler', () => import('../../../../lib/api-handler'));
vi.mock('@/lib/api-response', () => import('../../../../lib/api-response'));

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  getSession: vi.fn(),
}));

import { POST as createCompany } from './route';
import { GET as getFinancials, POST as upsertFinancials } from './[id]/financials/route';
import { GET as getPriceBars, POST as importPriceBars } from './[id]/price-bars/route';
import { prisma } from '@stock-assistant/db';
import { requireAuth } from '@/lib/auth';

const mockRequireAuth = vi.mocked(requireAuth);
const mockCompanyFindFirst = vi.mocked(prisma.company.findFirst);
const mockCompanyCreate = vi.mocked(prisma.company.create);
const mockAuditEventCreate = vi.mocked(prisma.auditEvent.create);
const mockFinancialFindMany = vi.mocked(prisma.financialStatement.findMany);
const mockPriceBarFindMany = vi.mocked(prisma.priceBar.findMany);

describe('Manual Data Entry API Endpoints', () => {
  const mockUser = {
    user: {
      id: 'owner_user_01',
      email: 'investor@stokiffy.local',
      name: 'Stokiffy Investor',
      role: 'OWNER' as const,
    },
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  const sampleCompany = {
    id: 'comp_infy',
    userId: 'owner_user_01',
    symbol: 'INFY',
    name: 'Infosys Limited',
    exchange: 'NSE',
    sector: 'IT services',
    isin: 'INE009A01021',
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
  });

  describe('POST /api/v1/companies', () => {
    it('creates a new company and logs AuditEvent on valid input', async () => {
      mockCompanyFindFirst.mockResolvedValue(null);
      mockCompanyCreate.mockResolvedValue(sampleCompany as any);
      mockAuditEventCreate.mockResolvedValue({ id: 'aud_01' } as any);

      const req = new NextRequest('http://localhost:3000/api/v1/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'INFY',
          name: 'Infosys Limited',
          exchange: 'NSE',
          sector: 'IT services',
          industry: 'Software Consulting',
          isin: 'INE009A01021',
        }),
      });

      const res = await createCompany(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.symbol).toBe('INFY');
      expect(mockCompanyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'owner_user_01',
            symbol: 'INFY',
            name: 'Infosys Limited',
          }),
        })
      );
      expect(mockAuditEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CREATE_COMPANY',
            entityType: 'Company',
          }),
        })
      );
    });

    it('rejects duplicate symbol with 409 CONFLICT', async () => {
      mockCompanyFindFirst.mockResolvedValue(sampleCompany as any);

      const req = new NextRequest('http://localhost:3000/api/v1/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'INFY',
          name: 'Infosys Duplicate',
          exchange: 'NSE',
          sector: 'IT services',
        }),
      });

      const res = await createCompany(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
    });
  });

  describe('GET & POST /api/v1/companies/[id]/financials', () => {
    it('returns 404 when company does not exist', async () => {
      mockCompanyFindFirst.mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/v1/companies/NONEXISTENT/financials');
      const res = await getFinancials(req, { params: { id: 'NONEXISTENT' } });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns financial statements for existing company', async () => {
      mockCompanyFindFirst.mockResolvedValue(sampleCompany as any);
      mockFinancialFindMany.mockResolvedValue([
        {
          id: 'fs_01',
          companyId: 'comp_infy',
          periodType: 'annual',
          fiscalYear: 'FY2024',
          fiscalQuarter: null,
          reportedPeriod: 'FY2024',
          revenue: '153670' as any,
          netProfit: '26248' as any,
          operatingProfit: '35000' as any,
          totalAssets: null,
          totalLiabilities: null,
          totalEquity: '85000' as any,
          totalDebt: '0' as any,
          currentAssets: null,
          currentLiabilities: null,
          interestExpense: null,
          ebit: null,
          eps: '63.2' as any,
          depreciationAmortization: null,
          capitalExpenditure: null,
          changeInWorkingCapital: null,
          fcf: null,
          dividendPerShare: null,
          sharesOutstanding: null,
          bookValuePerShare: null,
          promoterPledgePct: null,
          relatedPartyTxn: null,
          auditorQualification: null,
          currency: 'INR',
          unit: 'CRORE',
          adjustmentStatus: 'reported',
          quality: 'verified',
          isMissing: false,
          sourceDocumentRef: 'MANUAL_ENTRY',
          fetchedAt: new Date('2024-03-31T00:00:00.000Z'),
          createdAt: new Date('2024-03-31T00:00:00.000Z'),
        },
      ]);

      const req = new NextRequest('http://localhost:3000/api/v1/companies/INFY/financials');
      const res = await getFinancials(req, { params: { id: 'INFY' } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].revenue).toBe(153670);
      expect(body.data[0].totalAssets).toBeNull(); // Verifies null preservation
    });

    it('upserts manual financial statement preserving null for omitted fields', async () => {
      mockCompanyFindFirst.mockResolvedValue(sampleCompany as any);

      const req = new NextRequest('http://localhost:3000/api/v1/companies/INFY/financials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodType: 'annual',
          fiscalYear: 'FY2024',
          revenue: 153670,
          netProfit: 26248,
          totalEquity: 85000,
          totalDebt: 0,
          // omitted fields: totalAssets, ebit, fcf, etc. must stay null
        }),
      });

      const res = await upsertFinancials(req, { params: { id: 'INFY' } });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.count).toBe(1);
      expect(body.data.statements[0].revenue).toBe(153670);
      expect(body.data.statements[0].totalAssets).toBeNull();
      expect(body.data.statements[0].sourceDocumentRef).toBe('MANUAL_ENTRY');
    });
  });

  describe('GET & POST /api/v1/companies/[id]/price-bars', () => {
    it('returns chronological price bars for company', async () => {
      mockCompanyFindFirst.mockResolvedValue(sampleCompany as any);
      mockPriceBarFindMany.mockResolvedValue([
        {
          id: 'pb_01',
          companyId: 'comp_infy',
          date: new Date('2024-03-25T00:00:00.000Z'),
          open: '1500' as any,
          high: '1530' as any,
          low: '1490' as any,
          close: '1520' as any,
          volume: BigInt(2500000),
          adjusted: false,
          corporateActionType: null,
          createdAt: new Date(),
        },
      ]);

      const req = new NextRequest('http://localhost:3000/api/v1/companies/INFY/price-bars');
      const res = await getPriceBars(req, { params: { id: 'INFY' } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data[0].close).toBe(1520);
      expect(body.data[0].volume).toBe(2500000);
    });

    it('imports price bars from JSON payload with geometry validation', async () => {
      mockCompanyFindFirst.mockResolvedValue(sampleCompany as any);

      const req = new NextRequest('http://localhost:3000/api/v1/companies/INFY/price-bars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            date: '2024-03-25',
            open: 1500,
            high: 1530,
            low: 1490,
            close: 1520,
            volume: 2500000,
          },
          {
            date: '2024-03-26',
            open: 1520,
            high: 1540,
            low: 1510,
            close: 1535,
            volume: 1800000,
          },
        ]),
      });

      const res = await importPriceBars(req, { params: { id: 'INFY' } });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.count).toBe(2);
    });

    it('imports price bars from raw CSV text payload using OHLCV parser', async () => {
      mockCompanyFindFirst.mockResolvedValue(sampleCompany as any);

      const csvContent = `Date,Open,High,Low,Close,Volume,Adj Close
2024-03-25,1500,1530,1490,1520,2500000,1520
2024-03-26,1520,1540,1510,1535,1800000,1535`;

      const req = new NextRequest('http://localhost:3000/api/v1/companies/INFY/price-bars', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: csvContent,
      });

      const res = await importPriceBars(req, { params: { id: 'INFY' } });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.count).toBe(2);
      expect(body.data.importedBars[0].open).toBe(1500);
      expect(body.data.importedBars[1].close).toBe(1535);
    });

    it('rejects payload when no valid price bars are found', async () => {
      mockCompanyFindFirst.mockResolvedValue(sampleCompany as any);

      const invalidCsv = `Date,Open,High,Low,Close,Volume
2024-03-25,1500,1400,1490,1520,2500000`; // high < open and high < close

      const req = new NextRequest('http://localhost:3000/api/v1/companies/INFY/price-bars', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: invalidCsv,
      });

      const res = await importPriceBars(req, { params: { id: 'INFY' } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_FAILED');
    });
  });
});
