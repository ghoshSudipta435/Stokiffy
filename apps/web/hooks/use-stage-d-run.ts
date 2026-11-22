'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { StageDRunResponse } from '@/app/api/v1/companies/[id]/valuations/route';

interface RunStageDVariables {
  companyId: string;
  symbol: string;
  marketPrice?: number;
  selectedFairPE?: number;
  selectedFairPB?: number;
  assumedExitPE?: number;
  discountRate?: number;
  terminalGrowthRate?: number;
  marginOfSafetyPct?: number;
  primaryMethod?: 'PE' | 'PEG' | 'PB' | 'DCF';
}

export function useStageDRun() {
  const queryClient = useQueryClient();

  const mutation = useMutation<StageDRunResponse, Error, RunStageDVariables>({
    mutationFn: async ({ companyId, symbol, ...rest }) => {
      const response = await apiClient.post<StageDRunResponse>(
        `/api/v1/companies/${encodeURIComponent(companyId)}/valuations`,
        { symbol, ...rest }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flags'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
  });

  return {
    runStageD: mutation.mutateAsync,
    isRunning: mutation.isPending,
  };
}
