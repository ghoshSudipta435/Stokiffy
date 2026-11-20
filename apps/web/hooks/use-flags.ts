'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { RedFlagDTO } from '@/app/api/v1/flags/route';

export function useFlags(companyId?: string) {
  const queryClient = useQueryClient();

  const endpoint = companyId
    ? `/api/v1/flags?companyId=${encodeURIComponent(companyId)}`
    : '/api/v1/flags';

  const flagsQuery = useQuery({
    queryKey: ['flags', companyId || 'all'],
    queryFn: async () => {
      const response = await apiClient.getPaginated<RedFlagDTO>(endpoint);
      return response.data;
    },
    staleTime: 30 * 1000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ flagId, reason }: { flagId: string; reason: string }) => {
      const response = await apiClient.post<RedFlagDTO>(
        `/api/v1/flags/${encodeURIComponent(flagId)}/acknowledge`,
        { reason }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flags'] });
    },
  });

  return {
    ...flagsQuery,
    acknowledgeFlag: acknowledgeMutation.mutateAsync,
    isAcknowledging: acknowledgeMutation.isPending,
  };
}
