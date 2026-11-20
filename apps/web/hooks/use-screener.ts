'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { CompanySummaryDTO } from '@/app/api/v1/companies/route';

export interface ScreenerFilters {
  q?: string;
  sector?: string;
  limit?: number;
}

export function useScreener(filters: ScreenerFilters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.q) queryParams.set('q', filters.q);
  if (filters.sector) queryParams.set('sector', filters.sector);
  if (filters.limit) queryParams.set('limit', String(filters.limit));

  const endpoint = `/api/v1/companies${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  return useQuery({
    queryKey: ['screener', filters],
    queryFn: async () => {
      const response = await apiClient.getPaginated<CompanySummaryDTO>(endpoint);
      return response;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
