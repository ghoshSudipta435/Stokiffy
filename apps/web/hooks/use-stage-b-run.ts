'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { StageBRunResponse } from '@/app/api/v1/analyses/stage-b/route';

interface RunStageBVariables {
  companyId: string;
  symbol: string;
}

export function useStageBRun() {
  const queryClient = useQueryClient();

  const mutation = useMutation<StageBRunResponse, Error, RunStageBVariables>({
    mutationFn: async ({ companyId, symbol }) => {
      const response = await apiClient.post<StageBRunResponse>('/api/v1/analyses/stage-b', {
        companyId,
        symbol,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flags'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
  });

  return {
    runStageB: mutation.mutateAsync,
    isRunning: mutation.isPending,
  };
}
