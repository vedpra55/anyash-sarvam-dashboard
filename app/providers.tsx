"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Show cached data instantly; refresh it in the background once it's 30s old.
            staleTime: 30_000,
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: true,
            refetchIntervalInBackground: false,
            retry: 1,
          },
        },
      })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
