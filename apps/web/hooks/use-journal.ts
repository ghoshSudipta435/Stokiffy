'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { JournalEntry, CreateJournalEntryRequest, AppendJournalReviewRequest } from '@stock-assistant/contracts';

export function useJournal() {
  const queryClient = useQueryClient();

  const journalQuery = useQuery<JournalEntry[]>({
    queryKey: ['journal'],
    queryFn: async () => {
      const response = await apiClient.get<JournalEntry[]>('/api/v1/journal');
      return response.data;
    },
    staleTime: 30 * 1000,
  });

  const createJournalEntryMutation = useMutation<JournalEntry, Error, CreateJournalEntryRequest>({
    mutationFn: async (body) => {
      const response = await apiClient.post<JournalEntry>('/api/v1/journal', body);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
    },
  });

  const appendReviewMutation = useMutation<JournalEntry, Error, { id: string; body: AppendJournalReviewRequest }>({
    mutationFn: async ({ id, body }) => {
      const response = await fetch(`/api/v1/journal/${encodeURIComponent(id)}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
    },
  });

  return {
    ...journalQuery,
    journalEntries: journalQuery.data ?? [],
    isLoadingJournal: journalQuery.isLoading,
    createJournalEntry: createJournalEntryMutation.mutateAsync,
    isCreatingJournalEntry: createJournalEntryMutation.isPending,
    appendJournalReview: appendReviewMutation.mutateAsync,
    isAppendingReview: appendReviewMutation.isPending,
  };
}
