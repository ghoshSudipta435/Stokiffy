'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Alert, AcknowledgeAlertRequest } from '@stock-assistant/contracts';

export function useAlerts(params?: { severity?: 'info' | 'warning' | 'critical'; acknowledged?: boolean }) {
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  if (params?.severity) queryParams.set('severity', params.severity);
  if (params?.acknowledged !== undefined) queryParams.set('acknowledged', String(params.acknowledged));

  const endpoint = `/api/v1/alerts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const alertsQuery = useQuery<Alert[]>({
    queryKey: ['alerts', params],
    queryFn: async () => {
      const response = await apiClient.get<Alert[]>(endpoint);
      return response.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const acknowledgeAlertMutation = useMutation<Alert, Error, { alertId: string; notes?: string }>({
    mutationFn: async ({ alertId, notes }) => {
      const response = await apiClient.post<Alert>(
        `/api/v1/alerts/${encodeURIComponent(alertId)}/acknowledge`,
        { acknowledgedBy: 'owner_user_01', notes }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  return {
    ...alertsQuery,
    alerts: alertsQuery.data ?? [],
    isLoadingAlerts: alertsQuery.isLoading,
    acknowledgeAlert: acknowledgeAlertMutation.mutateAsync,
    isAcknowledging: acknowledgeAlertMutation.isPending,
  };
}
