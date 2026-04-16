import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
    mutations: {
      onError: (err) => {
        console.error("[mutation error]", err instanceof Error ? err.message : err);
      },
    },
  },
});

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.query.state.status === "error") {
    const key = JSON.stringify(event.query.queryKey);
    const err = event.query.state.error;
    console.error("[query error]", key, err instanceof Error ? err.message : err);
  }
});
