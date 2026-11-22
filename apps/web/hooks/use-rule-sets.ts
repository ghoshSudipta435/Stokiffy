'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { RuleSet, UpdateRiskLimitsRequest, UpdateBenchmarksRequest } from '@stock-assistant/contracts';

export function useRuleSets() {
  const queryClient = useQueryClient();

  const ruleSetsQuery = useQuery<RuleSet[]>({
    queryKey: ['rule-sets'],
    queryFn: async () => {
      const response = await apiClient.get<RuleSet[]>('/api/v1/rule-sets');
      return response.data;
    },
    staleTime: 60 * 1000,
  });

  const updateSettingsMutation = useMutation<RuleSet, Error, { riskLimits?: Partial<UpdateRiskLimitsRequest>; benchmarks?: UpdateBenchmarksRequest['benchmarks'] }>({
    mutationFn: async ({ riskLimits, benchmarks }) => {
      const body: Record<string, unknown> = {};
      if (riskLimits) body.riskLimits = riskLimits;
      if (benchmarks) body.benchmarks = benchmarks;
      const response = await fetch('/api/v1/rule-sets/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
    },
  });

  return {
    ...ruleSetsQuery,
    ruleSets: ruleSetsQuery.data ?? [],
    isLoadingRuleSets: ruleSetsQuery.isLoading,
    updateRuleSetSettings: updateSettingsMutation.mutateAsync,
    isUpdatingRuleSetSettings: updateSettingsMutation.isPending,
  };
}
