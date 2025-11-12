import { useMemo } from 'react';
import { useWallet } from 'providers/WalletProvider';
import { getAppConfig } from 'constants/newenv';
import {
  vestingSchedules,
  vestingUser,
  useCachedSubgraphQuery,
} from 'utils/subgraph';

// --- Defaults & Types ---
const DEFAULT_METRICS = {
  totalAllocated: 0 as number,
  totalVested: 0 as number,
  totalReleased: 0 as number,
};

export type VestingSchedule = {
  id: string;
  start: string;
  cliff: string;
  duration: string;
  vested: string; // subgraph string (base units or human units)
  released: string; // subgraph string
  revoked: boolean;
};

type UseVestingMetricsReturn = {
  schedules: VestingSchedule[] | null;
  totalAllocated: number;
  totalVested: number;
  totalReleased: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

// --- Helpers ---
function toNumber(value?: string | null): number {
  if (!value) return 0;
  const v = value.trim();
  try {
    // If it already has a decimal, assume human units
    if (v.includes('.')) {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }
    // For this subgraph, amounts are already in human-readable format (not wei)
    // So we can directly convert to number
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
}

// Removed pickAllocatedField since subgraph doesn't have explicit allocation fields

// --- Hook ---
export const useVestingMetrics = (): UseVestingMetricsReturn => {
  const { wallet } = useWallet();
  const subgraphUrl = getAppConfig().vesting.subgraphUrl;

  const normalizedWallet = wallet?.toLowerCase() || '';

  const {
    data: userResponse,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useCachedSubgraphQuery(
    subgraphUrl,
    vestingUser(normalizedWallet),
    [normalizedWallet],
    { enabled: Boolean(wallet) }
  );

  const {
    data: schedulesResponse,
    isLoading: schedulesLoading,
    error: schedulesError,
    refetch: refetchSchedules,
  } = useCachedSubgraphQuery(
    subgraphUrl,
    vestingSchedules(normalizedWallet),
    [normalizedWallet],
    { enabled: Boolean(wallet) }
  );

  const { schedules, totalAllocated, totalVested, totalReleased } =
    useMemo(() => {
      if (!wallet) {
        return {
          schedules: null,
          totalAllocated: DEFAULT_METRICS.totalAllocated,
          totalVested: DEFAULT_METRICS.totalVested,
          totalReleased: DEFAULT_METRICS.totalReleased,
        };
      }

      const fetched: VestingSchedule[] = schedulesResponse?.schedules ?? [];
      const activeSchedules = fetched.filter((s) => !s.revoked);

      const user = userResponse?.user;
      const vested = user
        ? toNumber(user.vestedAmount)
        : DEFAULT_METRICS.totalVested;
      const released = user
        ? toNumber(user.releasedAmount)
        : DEFAULT_METRICS.totalReleased;

      // Allocated: use vested as the best available proxy for total allocation
      const allocated = activeSchedules.reduce((sum, s) => {
        return sum + toNumber(s.vested);
      }, 0);

      return {
        schedules: activeSchedules,
        totalAllocated: allocated,
        totalVested: vested,
        totalReleased: released,
      };
    }, [wallet, userResponse, schedulesResponse]);

  const loading = wallet ? userLoading || schedulesLoading : false;
  const error = userError || schedulesError;

  const refetch = () => {
    refetchUser();
    refetchSchedules();
  };

  return {
    schedules,
    totalAllocated,
    totalVested,
    totalReleased,
    loading,
    error: error ? 'Failed to fetch vesting schedules and user metrics.' : null,
    refetch,
  };
};
