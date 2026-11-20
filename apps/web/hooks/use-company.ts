'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { CompanyDetailDTO } from '@/app/api/v1/companies/[id]/route';

export function useCompany(symbolOrId: string) {
  return useQuery({
    queryKey: ['company', symbolOrId.toUpperCase()],
    queryFn: async () => {
      const response = await apiClient.get<CompanyDetailDTO>(
        `/api/v1/companies/${encodeURIComponent(symbolOrId.toUpperCase())}`
      );
      return response.data;
    },
    enabled: Boolean(symbolOrId),
    staleTime: 60 * 1000, // 1 minute
  });
}
