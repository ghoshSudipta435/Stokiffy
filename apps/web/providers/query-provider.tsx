'use client';

import React, { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../lib/query-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Use state to ensure stable QueryClient instance per component lifecycle on client
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
