"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * QueryProvider — wraps the app with TanStack Query for client-side
 * data fetching + caching.
 *
 * Benefits:
 *   - Automatic deduplication of identical requests
 *   - Background refetching on focus/reconnect
 *   - Stale-while-revalidate caching (instant UI from cache, refresh in bg)
 *   - Loading/error states via useQuery hooks
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
