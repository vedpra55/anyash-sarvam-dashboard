"use client";

import { useQuery } from "@tanstack/react-query";
import { ParentItem } from "./ParentsListColumn";
import { parentsQuery } from "@/lib/queries";

/**
 * Parents with their Sarvam calls, daily logs and AI reviews, from the shared
 * cache. `loading` is true only when there is no data yet; background
 * refreshes keep showing the cached list.
 */
export function useParents() {
  const query = useQuery(parentsQuery);
  const parents = (query.data || []) as ParentItem[];
  return {
    parents,
    loading: query.isPending,
    /** Set only when there's nothing to show. */
    error: query.isError && !query.data ? query.error.message : "",
    /** Set when a background refresh failed but cached data is still shown. */
    refreshError: query.isError && query.data ? query.error.message : "",
    isFetching: query.isFetching,
    updatedAt: query.dataUpdatedAt,
    reload: query.refetch,
  };
}
