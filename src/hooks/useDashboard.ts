import useSWR from "swr";
import { getDashboardStats } from "@/lib/firestore";

import { DashboardStats } from "@/types/dashboard";

export function useDashboard() {
  const { data, error, isLoading, mutate } = useSWR<DashboardStats>("dashboardStats", getDashboardStats, {
    refreshInterval: 60000, // Refresh every minute
  });

  return {
    stats: data,
    isLoading,
    isError: error,
    mutate,
  };
}
