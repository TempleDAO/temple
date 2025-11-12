import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from 'providers/WalletProvider';
import { useNotification } from 'providers/NotificationProvider';
import { useApiManager } from 'hooks/use-api-manager';
import { getAppConfig } from 'constants/newenv';
import { fromAtto } from 'utils/bigNumber';
import { VestingPayments } from 'types/typechain';
import { useVestingMetrics } from './use-vesting-metrics';
import type { Transaction } from '../DataTables/ClaimableDataTable';

const ENV = import.meta.env;

const getChainId = () => {
  if (ENV.VITE_ENV === 'production') {
    return 1;
  } else if (ENV.VITE_ENV === 'preview') {
    return 11155111;
  } else {
    throw new Error('Invalid environment');
  }
};

export type UseClaimableTGLDReturn = {
  data: Transaction[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  claimTgld: (transactionId: string) => Promise<void>;
};

// ---- Constants ----
const SECONDS_PER_DAY = 86400;
const DAYS_PER_MONTH = 30;
const DEFAULT_LOCALE = 'en-US';

// ---- Pure helpers (no side-effects) ----
function formatDate(tsSec: string | number, locale = DEFAULT_LOCALE): string {
  const n = typeof tsSec === 'string' ? Number(tsSec) : tsSec;
  if (!Number.isFinite(n)) return '-';
  return new Date(n * 1000).toLocaleDateString(locale, {
    month: 'short',
    year: 'numeric',
  });
}

function formatCliffDuration(startSec: string, cliffSec: string): string {
  const s = Number(startSec);
  const c = Number(cliffSec);
  if (!Number.isFinite(s) || !Number.isFinite(c) || c <= s) return '0 days';
  const seconds = c - s;
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const months = Math.floor(days / DAYS_PER_MONTH);
  return months > 0
    ? `${months} month${months > 1 ? 's' : ''}`
    : `${days} day${days > 1 ? 's' : ''}`;
}

async function fetchScheduleData(
  schedule: any,
  vestingContract: VestingPayments
): Promise<Transaction | null> {
  const vestingId = schedule.id;

  // Query vested & claimable in parallel
  const [vestedAmount, claimableAmount] = await Promise.all([
    vestingContract.getTotalVestedAtCurrentTime(vestingId),
    vestingContract.getReleasableAmount(vestingId),
  ]);

  if (!claimableAmount || claimableAmount.lte(0)) return null;

  const start = Number(schedule.start);
  const end = start + Number(schedule.duration);

  return {
    id: vestingId,
    grantStartDate: formatDate(schedule.start),
    grantEndDate: formatDate(end),
    cliff: formatCliffDuration(schedule.start, schedule.cliff),
    vestedAmount: fromAtto(vestedAmount),
    claimableAmount: fromAtto(claimableAmount),
    action: 'Claim',
  };
}

export const useClaimableTGLD = (): UseClaimableTGLDReturn => {
  const [data, setData] = useState<Transaction[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { wallet, getConnectedSigner, switchNetwork } = useWallet();
  const { openNotification } = useNotification();
  const { papi } = useApiManager();

  const { schedules } = useVestingMetrics();

  // request guard to avoid setState on stale results
  const reqIdRef = useRef(0);

  // Remove unnecessary useMemo - getAppConfig is already memoized
  const vestingConfig = getAppConfig().contracts.vestingPayments;

  const fetchData = useCallback(async () => {
    const myReqId = ++reqIdRef.current;

    // Early returns for edge cases
    if (!wallet) {
      setError(null);
      setData(Array.isArray(schedules) ? [] : null);
      return;
    }

    if (!schedules) {
      setError(null);
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const vestingContract = (await papi.getContract(
        vestingConfig
      )) as VestingPayments;

      // Build parallel calls per schedule with fallback handling
      const results = await Promise.allSettled(
        schedules.map((schedule) =>
          fetchScheduleData(schedule, vestingContract)
        )
      );

      // If this request is stale, ignore everything
      if (myReqId !== reqIdRef.current) return;

      // Collect successful, non-null items using flatMap
      const transactions = results
        .filter(
          (r): r is PromiseFulfilledResult<Transaction> =>
            r.status === 'fulfilled' && r.value !== null
        )
        .map((r) => r.value);

      setData(transactions);
      setError(null);
    } catch (e) {
      if (myReqId !== reqIdRef.current) return;
      console.error('Error fetching claimable TGLD:', e);
      setError('Failed to fetch claimable TGLD.');
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false);
    }
  }, [wallet, schedules, papi, vestingConfig]);

  const claimTgld = useCallback(
    async (vestingId: string) => {
      try {
        await switchNetwork(getChainId());
        const connectedSigner = await getConnectedSigner();
        const vestingContract = (await papi.getConnectedContract(
          vestingConfig,
          connectedSigner
        )) as VestingPayments;

        const tx = await vestingContract.release(vestingId);
        const receipt = await tx.wait();

        openNotification({
          title: 'Claimed TGLD',
          hash: receipt.transactionHash,
        });

        // Optimistic update: remove the claimed item immediately
        setData((prev) =>
          prev ? prev.filter((t) => t.id !== vestingId) : prev
        );

        // Re-sync with chain/subgraph
        await fetchData();
      } catch (err: any) {
        console.error('Error claiming TGLD:', err);
        const errorMessage =
          err?.reason || err?.message || 'Failed to claim TGLD.';
        setError(errorMessage);
        openNotification({
          title: 'Error claiming TGLD',
          hash: '',
        });
      }
    },
    [
      papi,
      getConnectedSigner,
      switchNetwork,
      openNotification,
      fetchData,
      vestingConfig,
    ]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    claimTgld,
  };
};
