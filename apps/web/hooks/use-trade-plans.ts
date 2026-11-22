'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { TradePlanFull, CreateTradePlanRequest, UpdateTradePlanRequest } from '@stock-assistant/contracts';

export function useTradePlans() {
  const queryClient = useQueryClient();

  const tradePlansQuery = useQuery<TradePlanFull[]>({
    queryKey: ['trade-plans'],
    queryFn: async () => {
      const response = await apiClient.get<TradePlanFull[]>('/api/v1/trade-plans');
      return response.data;
    },
    staleTime: 30 * 1000,
  });

  const createTradePlanMutation = useMutation<TradePlanFull, Error, CreateTradePlanRequest>({
    mutationFn: async (body) => {
      const response = await apiClient.post<TradePlanFull>('/api/v1/trade-plans', body);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-plans'] });
    },
  });

  const updateTradePlanMutation = useMutation<TradePlanFull, Error, { id: string; body: UpdateTradePlanRequest }>({
    mutationFn: async ({ id, body }) => {
      const response = await fetch(`/api/v1/trade-plans/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-plans'] });
    },
  });

  return {
    ...tradePlansQuery,
    tradePlans: tradePlansQuery.data ?? [],
    isLoadingTradePlans: tradePlansQuery.isLoading,
    createTradePlan: createTradePlanMutation.mutateAsync,
    isCreatingTradePlan: createTradePlanMutation.isPending,
    updateTradePlan: updateTradePlanMutation.mutateAsync,
    isUpdatingTradePlan: updateTradePlanMutation.isPending,
  };
}
