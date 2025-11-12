import { useMemo } from 'react';
import { getAppConfig } from 'constants/newenv';
import {
  vestingMetrics,
  vestingUser,
  vestingSchedules,
  useCachedSubgraphQuery,
} from 'utils/subgraph';

const DEFAULT_METRICS = {
  totalVestedAndUnclaimed: 0,
  totalReleased: 0,
} as const;

// ---- Pure helpers (no side-effects) ----
function parseMetricsData(metrics: any): VestingMetricsData {
  return {
    totalVestedAndUnclaimed: parseFloat(metrics.totalVestedAndUnclaimed),
    totalReleased: parseFloat(metrics.totalReleased),
  };
}

function parseUserMetrics(
  userResponse: any,
  schedulesResponse: any
): VestingMetricsData {
  const schedules = schedulesResponse?.schedules || [];
  const activeSchedules = schedules.filter((s: any) => !s.revoked);

  // If we have user data, use it (more accurate)
  if (userResponse?.user) {
    const user = userResponse.user;
    const totalVested = parseFloat(user.vestedAmount || '0');
    const totalReleased = parseFloat(user.releasedAmount || '0');
    const totalVestedAndUnclaimed = Math.max(0, totalVested - totalReleased);

    return {
      totalVestedAndUnclaimed,
      totalReleased,
    };
  }

  // Fallback: calculate from schedules if user record doesn't exist
  if (activeSchedules.length > 0) {
    const totalVested = activeSchedules.reduce(
      (sum: number, s: any) => sum + parseFloat(s.vested || '0'),
      0
    );
    const totalReleased = activeSchedules.reduce(
      (sum: number, s: any) => sum + parseFloat(s.released || '0'),
      0
    );
    const totalVestedAndUnclaimed = Math.max(0, totalVested - totalReleased);

    return {
      totalVestedAndUnclaimed,
      totalReleased,
    };
  }

  // No data available
  return DEFAULT_METRICS;
}

type VestingMetricsData = {
  totalVestedAndUnclaimed: number;
  totalReleased: number;
};

type UseVestingMetricsReturn = {
  data: VestingMetricsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export const useVestingMetrics = (
  walletAddress?: string
): UseVestingMetricsReturn => {
  const subgraphUrl = getAppConfig().vesting.subgraphUrl;

  // Determine if we should filter by user
  const shouldFilterByUser = Boolean(walletAddress);

  // Global metrics query (always fetch for fallback)
  const {
    data: globalResponse,
    isLoading: globalLoading,
    error: globalError,
    refetch: refetchGlobal,
  } = useCachedSubgraphQuery(subgraphUrl, vestingMetrics());

  // User-specific queries (include address in cache key to avoid collisions)
  const normalizedAddress = walletAddress?.toLowerCase() || '';

  const {
    data: userResponse,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useCachedSubgraphQuery(
    subgraphUrl,
    vestingUser(normalizedAddress),
    [normalizedAddress],
    { enabled: shouldFilterByUser }
  );

  const {
    data: schedulesResponse,
    isLoading: schedulesLoading,
    error: schedulesError,
    refetch: refetchSchedules,
  } = useCachedSubgraphQuery(
    subgraphUrl,
    vestingSchedules(normalizedAddress),
    [normalizedAddress],
    { enabled: shouldFilterByUser }
  );

  const data = useMemo((): VestingMetricsData | null => {
    if (shouldFilterByUser) {
      // Return user-specific metrics
      if (userLoading || schedulesLoading) return null;
      return parseUserMetrics(userResponse, schedulesResponse);
    } else {
      // Return global metrics
      if (!globalResponse?.metrics?.length) {
        return DEFAULT_METRICS;
      }
      const metrics = globalResponse.metrics[0];
      return parseMetricsData(metrics);
    }
  }, [
    shouldFilterByUser,
    globalResponse,
    userResponse,
    schedulesResponse,
    userLoading,
    schedulesLoading,
  ]);

  const loading = shouldFilterByUser
    ? userLoading || schedulesLoading
    : globalLoading;

  const error = shouldFilterByUser ? userError || schedulesError : globalError;

  const refetch = () => {
    refetchGlobal();
    if (shouldFilterByUser) {
      refetchUser();
      refetchSchedules();
    }
  };

  return {
    data,
    loading,
    error: error ? 'Failed to fetch vesting metrics.' : null,
    refetch,
  };
};
