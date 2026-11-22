'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { StageARunResponse } from '@/app/api/v1/analyses/stage-a/route';

interface RunStageAVariables {
  companyId: string;
  symbol: string;
}

export function useStageARun() {
  const queryClient = useQueryClient();

  const mutation = useMutation<StageARunResponse, Error, RunStageAVariables>({
    mutationFn: async ({ companyId, symbol }) => {
      const response = await apiClient.post<StageARunResponse>('/api/v1/analyses/stage-a', {
        companyId,
        symbol,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screener'] });
      queryClient.invalidateQueries({ queryKey: ['flags'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
  });

  return {
    runStageA: mutation.mutateAsync,
    isRunning: mutation.isPending,
  };
}
