'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Watchlist, CreateWatchlistRequest, WatchlistItem, AddWatchlistItemRequest } from '@stock-assistant/contracts';

export function useWatchlists() {
  const queryClient = useQueryClient();

  const watchlistsQuery = useQuery<Watchlist[]>({
    queryKey: ['watchlists'],
    queryFn: async () => {
      const response = await apiClient.get<Watchlist[]>('/api/v1/watchlists');
      return response.data;
    },
    staleTime: 30 * 1000,
  });

  const createWatchlistMutation = useMutation<Watchlist, Error, CreateWatchlistRequest>({
    mutationFn: async (body) => {
      const response = await apiClient.post<Watchlist>('/api/v1/watchlists', body);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
    },
  });

  const deleteWatchlistMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete<void>(`/api/v1/watchlists/${encodeURIComponent(id)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
    },
  });

  const addItemMutation = useMutation<WatchlistItem, Error, { watchlistId: string; body: AddWatchlistItemRequest }>({
    mutationFn: async ({ watchlistId, body }) => {
      const response = await apiClient.post<WatchlistItem>(
        `/api/v1/watchlists/${encodeURIComponent(watchlistId)}/items`,
        body
      );
      return response.data;
    },
    onSuccess: (_, { watchlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      queryClient.invalidateQueries({ queryKey: ['watchlist-items', watchlistId] });
    },
  });

  const deleteItemMutation = useMutation<void, Error, { watchlistId: string; itemId: string }>({
    mutationFn: async ({ watchlistId, itemId }) => {
      await apiClient.delete<void>(
        `/api/v1/watchlists/${encodeURIComponent(watchlistId)}/items/${encodeURIComponent(itemId)}`
      );
    },
    onSuccess: (_, { watchlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      queryClient.invalidateQueries({ queryKey: ['watchlist-items', watchlistId] });
    },
  });

  return {
    ...watchlistsQuery,
    watchlists: watchlistsQuery.data ?? [],
    isLoadingWatchlists: watchlistsQuery.isLoading,
    createWatchlist: createWatchlistMutation.mutateAsync,
    isCreatingWatchlist: createWatchlistMutation.isPending,
    deleteWatchlist: deleteWatchlistMutation.mutateAsync,
    isDeletingWatchlist: deleteWatchlistMutation.isPending,
    addWatchlistItem: addItemMutation.mutateAsync,
    isAddingWatchlistItem: addItemMutation.isPending,
    deleteWatchlistItem: deleteItemMutation.mutateAsync,
    isDeletingWatchlistItem: deleteItemMutation.isPending,
  };
}

export function useWatchlistItems(watchlistId: string | undefined) {
  return useQuery<WatchlistItem[]>({
    queryKey: ['watchlist-items', watchlistId],
    queryFn: async () => {
      const response = await apiClient.get<WatchlistItem[]>(
        `/api/v1/watchlists/${encodeURIComponent(watchlistId ?? '')}/items`
      );
      return response.data;
    },
    enabled: Boolean(watchlistId),
    staleTime: 30 * 1000,
  });
}
