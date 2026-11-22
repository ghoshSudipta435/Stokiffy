'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { PortfolioSummaryResponse, PositionResponse } from '@stock-assistant/contracts';

export interface PortfolioSummary {
  totalValue: number;
  cash: number;
  positionsCount: number;
  sectorExposure: Record<string, number>;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
  cashBufferPct: number;
}

export interface PortfolioPosition {
  symbol: string;
  companyId: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  sector: string;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
}

export function usePortfolioSummary() {
  return useQuery<PortfolioSummary>({
    queryKey: ['portfolio-summary'],
    queryFn: async () => {
      const response = await apiClient.get<PortfolioSummary>('/api/v1/portfolio/summary');
      return response.data;
    },
    staleTime: 30 * 1000,
  });
}

export function usePortfolioPositions() {
  return useQuery<PortfolioPosition[]>({
    queryKey: ['portfolio-positions'],
    queryFn: async () => {
      const response = await apiClient.get<PortfolioPosition[]>('/api/v1/portfolio/positions');
      return response.data;
    },
    staleTime: 30 * 1000,
  });
}
