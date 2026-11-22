'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface MarketDataSearchResult {
  symbol: string;
  yahooSymbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
}

export interface SyncOhlcvResult {
  syncedCount: number;
  latestPrice: number | null;
  latestDate: string | null;
  yahooSymbol: string;
}

interface SyncOhlcvVariables {
  companyId: string;
  symbol?: string;
  exchange?: 'NSE' | 'BSE';
  days?: number;
}

/**
 * Debounced / enabled market-data symbol search.
 * GET /api/v1/market-data/search?q=<query>
 * Returns results only when query length >= 2.
 */
export function useMarketDataSearch(query: string) {
  return useQuery<MarketDataSearchResult[], Error>({
    queryKey: ['market-data', 'search', query],
    queryFn: async () => {
      const response = await apiClient.get<MarketDataSearchResult[]>(
        `/api/v1/market-data/search?q=${encodeURIComponent(query)}`
      );
      const raw = response.data as unknown;
      if (Array.isArray(raw)) {
        return raw as MarketDataSearchResult[];
      }
      if (raw && typeof raw === 'object' && 'results' in raw && Array.isArray((raw as any).results)) {
        return (raw as any).results as MarketDataSearchResult[];
      }
      return [];
    },
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60_000,
  });
}

/**
 * Sync OHLCV price bars from Yahoo Finance for a company.
 * POST /api/v1/market-data/sync-ohlcv
 */
export function useSyncOhlcv() {
  const queryClient = useQueryClient();

  return useMutation<SyncOhlcvResult, Error, SyncOhlcvVariables>({
    mutationFn: async (body) => {
      const response = await apiClient.post<SyncOhlcvResult>(
        '/api/v1/market-data/sync-ohlcv',
        body
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-bars', variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['screener'] });
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
    },
  });
}
