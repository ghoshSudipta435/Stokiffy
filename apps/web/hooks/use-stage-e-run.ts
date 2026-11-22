'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { StageERunResponse } from '@/app/api/v1/analyses/stage-e/route';

interface RunStageEVariables {
  companyId: string;
  symbol: string;
  valuationMaxBuyPrice?: number;
  targetPrice?: number;
  minRiskReward?: number;
  buyZoneTolerancePct?: number;
}

export function useStageERun() {
  const queryClient = useQueryClient();

  const mutation = useMutation<StageERunResponse, Error, RunStageEVariables>({
    mutationFn: async ({ companyId, symbol, ...rest }) => {
      const response = await apiClient.post<StageERunResponse>('/api/v1/analyses/stage-e', {
        companyId,
        symbol,
        ...rest,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flags'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
  });

  return {
    runStageE: mutation.mutateAsync,
    isRunning: mutation.isPending,
  };
}
