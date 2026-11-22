'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { StageCRunResponse } from '@/app/api/v1/companies/[id]/moat-assessments/route';

interface RunStageCVariables {
  companyId: string;
  symbol: string;
  businessModel: Array<{
    questionId: 'value-creation' | 'value-capture' | 'scalability';
    answer: string;
    confidence: 'high' | 'medium' | 'low';
    tags: string[];
    evidence?: Array<{
      description: string;
      source: string;
      sourceType: 'filing' | 'transcript' | 'analyst-report' | 'news' | 'user-input' | 'derived';
      relevance: 'direct' | 'supporting' | 'contextual';
    }>;
  }>;
  businessModelCategory?: string;
  moatTypes?: string[];
  moatTests: Array<{
    testId: 1 | 2 | 3 | 4 | 5;
    answer: 'yes' | 'no' | 'uncertain';
    confidence: 'high' | 'medium' | 'low';
    rationale: string;
    evidence: Array<{
      description: string;
      source: string;
      sourceType: 'filing' | 'transcript' | 'analyst-report' | 'news' | 'user-input' | 'derived';
      relevance: 'direct' | 'supporting' | 'contextual';
    }>;
  }>;
  includeROEHistory?: boolean;
}

export function useStageCRun() {
  const queryClient = useQueryClient();

  const mutation = useMutation<StageCRunResponse, Error, RunStageCVariables>({
    mutationFn: async ({ companyId, symbol, ...rest }) => {
      const response = await apiClient.post<StageCRunResponse>(
        `/api/v1/companies/${encodeURIComponent(companyId)}/moat-assessments`,
        rest
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flags'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
  });

  return {
    runStageC: mutation.mutateAsync,
    isRunning: mutation.isPending,
  };
}
