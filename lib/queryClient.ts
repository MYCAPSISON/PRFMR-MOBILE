import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

function shouldRetryApiFailure(failureCount: number, err: unknown): boolean {
  if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
    return false;
  }
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: shouldRetryApiFailure,
    },
    mutations: {
      onError: (err) => {
        console.warn("[mutation error]", err instanceof Error ? err.message : err);
      },
    },
  },
});

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.query.state.status === "error") {
    const key = JSON.stringify(event.query.queryKey);
    const err = event.query.state.error;
    console.warn("[query error]", key, err instanceof Error ? err.message : err);
  }
});
