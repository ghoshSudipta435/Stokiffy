import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export interface CompanyDetailDTO {
  id: string;
  symbol: string;
  isin: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  sector: string;
  industry: string;
  isDemoFixture: boolean;
  engineIntegrationStatus: 'PENDING_CORE_ENGINE_INTEGRATION';
  stages: {
    stageAStatus: 'PENDING';
    stageBStatus: 'PENDING';
    stageCScore?: number;
    stageDValuation?: 'PENDING';
    stageEStatus?: 'PENDING';
    stageFStatus?: 'PENDING';
    stageGMonitoring?: 'PENDING';
  };
  redFlags: Array<{
    id: string;
    code: string;
    title: string;
    severity: 'HARD' | 'WARNING';
    status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  }>;
  lastUpdated?: string;
}

// Neutral demonstration fixture for UI component layout testing
const DETAILS_FIXTURE: Record<string, CompanyDetailDTO> = {
  TCS: {
    id: 'comp_01',
    symbol: 'TCS',
    isin: 'INE467B01029',
    name: 'Tata Consultancy Services Ltd. [DEMO FIXTURE]',
    exchange: 'NSE',
    sector: 'Information Technology',
    industry: 'IT Services & Consulting',
    isDemoFixture: true,
    engineIntegrationStatus: 'PENDING_CORE_ENGINE_INTEGRATION',
    stages: {
      stageAStatus: 'PENDING',
      stageBStatus: 'PENDING',
      stageCScore: undefined,
      stageDValuation: 'PENDING',
      stageEStatus: 'PENDING',
      stageFStatus: 'PENDING',
      stageGMonitoring: 'PENDING',
    },
    redFlags: [],
    lastUpdated: new Date().toISOString(),
  },
  INFY: {
    id: 'comp_02',
    symbol: 'INFY',
    isin: 'INE009A01021',
    name: 'Infosys Limited [DEMO FIXTURE]',
    exchange: 'NSE',
    sector: 'Information Technology',
    industry: 'IT Services & Consulting',
    isDemoFixture: true,
    engineIntegrationStatus: 'PENDING_CORE_ENGINE_INTEGRATION',
    stages: {
      stageAStatus: 'PENDING',
      stageBStatus: 'PENDING',
      stageCScore: undefined,
      stageDValuation: 'PENDING',
      stageEStatus: 'PENDING',
      stageFStatus: 'PENDING',
      stageGMonitoring: 'PENDING',
    },
    redFlags: [],
    lastUpdated: new Date().toISOString(),
  },
  HDFCBANK: {
    id: 'comp_03',
    symbol: 'HDFCBANK',
    isin: 'INE040A01034',
    name: 'HDFC Bank Limited [DEMO FIXTURE]',
    exchange: 'NSE',
    sector: 'Financial Services',
    industry: 'Private Banks',
    isDemoFixture: true,
    engineIntegrationStatus: 'PENDING_CORE_ENGINE_INTEGRATION',
    stages: {
      stageAStatus: 'PENDING',
      stageBStatus: 'PENDING',
      stageCScore: undefined,
      stageDValuation: 'PENDING',
      stageEStatus: 'PENDING',
      stageFStatus: 'PENDING',
      stageGMonitoring: 'PENDING',
    },
    redFlags: [],
    lastUpdated: new Date().toISOString(),
  },
  RELIANCE: {
    id: 'comp_04',
    symbol: 'RELIANCE',
    isin: 'INE002A01018',
    name: 'Reliance Industries Limited [DEMO FIXTURE]',
    exchange: 'NSE',
    sector: 'Energy',
    industry: 'Oil & Gas Refining & Marketing',
    isDemoFixture: true,
    engineIntegrationStatus: 'PENDING_CORE_ENGINE_INTEGRATION',
    stages: {
      stageAStatus: 'PENDING',
      stageBStatus: 'PENDING',
      stageCScore: undefined,
      stageDValuation: 'PENDING',
      stageEStatus: 'PENDING',
      stageFStatus: 'PENDING',
      stageGMonitoring: 'PENDING',
    },
    redFlags: [
      {
        id: 'flag_01',
        code: 'DEBT_SPIKE',
        title: 'Subsidiary Debt Spike',
        severity: 'WARNING',
        status: 'ACTIVE',
      },
    ],
    lastUpdated: new Date().toISOString(),
  },
  TITAN: {
    id: 'comp_05',
    symbol: 'TITAN',
    isin: 'INE280A01028',
    name: 'Titan Company Limited [DEMO FIXTURE]',
    exchange: 'NSE',
    sector: 'Consumer Discretionary',
    industry: 'Gems, Jewellery & Watches',
    isDemoFixture: true,
    engineIntegrationStatus: 'PENDING_CORE_ENGINE_INTEGRATION',
    stages: {
      stageAStatus: 'PENDING',
      stageBStatus: 'PENDING',
      stageCScore: undefined,
      stageDValuation: 'PENDING',
      stageEStatus: 'PENDING',
      stageFStatus: 'PENDING',
      stageGMonitoring: 'PENDING',
    },
    redFlags: [],
    lastUpdated: new Date().toISOString(),
  },
};

export const GET = apiHandler(async (_req: NextRequest, { requestId, params }) => {
  const idOrSymbol = String(params.id || '').toUpperCase();

  const foundCompany =
    DETAILS_FIXTURE[idOrSymbol] ||
    Object.values(DETAILS_FIXTURE).find(
      (c) => c.id.toLowerCase() === idOrSymbol.toLowerCase() || c.symbol === idOrSymbol
    );

  const company = foundCompany || {
    id: `comp_${idOrSymbol.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    symbol: idOrSymbol,
    isin: 'INE000000000',
    name: `${idOrSymbol} Limited [DEMO FIXTURE]`,
    exchange: 'NSE' as const,
    sector: 'Diversified',
    industry: 'General Equities',
    isDemoFixture: true,
    engineIntegrationStatus: 'PENDING_CORE_ENGINE_INTEGRATION' as const,
    stages: {
      stageAStatus: 'PENDING' as const,
      stageBStatus: 'PENDING' as const,
      stageDValuation: 'PENDING' as const,
      stageEStatus: 'PENDING' as const,
      stageFStatus: 'PENDING' as const,
      stageGMonitoring: 'PENDING' as const,
    },
    redFlags: [],
    lastUpdated: new Date().toISOString(),
  };

  return createSuccessResponse(company, requestId);
});
