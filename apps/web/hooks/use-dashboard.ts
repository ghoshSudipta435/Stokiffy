'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface StageFunnelCount {
  stage: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  name: string;
  count: number;
  eligible: number;
  blocked: number;
}

export interface DashboardAlert {
  id: string;
  symbol: string;
  companyName: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: string;
  acknowledged: boolean;
}

export interface DashboardPortfolioSummary {
  totalValue: number;
  cash: number;
  positionsCount: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
  cashBufferPct: number;
}

export interface DashboardData {
  funnel: StageFunnelCount[];
  alerts: DashboardAlert[];
  portfolio: DashboardPortfolioSummary;
  updatedAt: string;
}

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await apiClient.get<DashboardData>('/api/v1/dashboard');
      return response.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
