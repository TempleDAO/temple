import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiManager } from 'hooks/use-api-manager';
import { getAppConfig } from 'constants/newenv';
import { fromAtto } from 'utils/bigNumber';
import { VestingPayments } from 'types/typechain';

type Schedule = {
  id: string;
  start: string;
  cliff: string;
  duration: string;
  vested: string;
  released: string;
  revoked: boolean;
};

type ChartDataPoint = {
  month: string;
  [key: string]: string | number | null; // vest1, vest2, etc.
};

type UseVestingChartReturn = {
  data: ChartDataPoint[] | null;
  loading: boolean;
  error: string | null;
};

type UseVestingChartProps = {
  schedules: Schedule[] | null;
};

// --- Pure helpers (no side-effects) ----
function calculateVestedAmount(
  currentTime: number,
  start: number,
  cliff: number,
  duration: number,
  totalAmount: number
): number {
  // Before cliff, nothing is vested
  if (currentTime < cliff) return 0;

  // After vesting period, everything is vested
  const end = start + duration;
  if (currentTime >= end) return totalAmount;

  // Linear vesting between cliff and end
  const vestingPeriod = end - cliff;
  const timeSinceCliff = currentTime - cliff;
  return (timeSinceCliff / vestingPeriod) * totalAmount;
}

function isDummySchedule(schedule: Schedule): boolean {
  return schedule.id.startsWith('0xdummy');
}

async function fetchScheduleAmounts(
  schedules: Schedule[],
  papi: any,
  vestingAddress: string
): Promise<Array<Schedule & { amount: number }>> {
  if (!vestingAddress) {
    throw new Error('Vesting contract address is undefined');
  }

  try {
    const vestingContract = (await papi.getContract(
      vestingAddress
    )) as VestingPayments;

    const contractResults = await Promise.all(
      schedules.map(async (schedule) => {
        const scheduleDetails = await vestingContract.getSchedule(schedule.id);
        return {
          schedule,
          amount: fromAtto(scheduleDetails.amount),
        };
      })
    );

    return contractResults.map(({ schedule, amount }) => ({
      ...schedule,
      amount,
    }));
  } catch (error) {
    console.warn(
      'Failed to load contract, falling back to subgraph data:',
      error
    );
    // Fallback: use the vested field from subgraph (already in token units)
    return schedules.map((schedule) => ({
      ...schedule,
      amount: parseFloat(schedule.vested),
    }));
  }
}

function generateMonthlyDataPoints(
  schedules: Array<Schedule & { amount: number }>
): ChartDataPoint[] {
  if (!schedules.length) return [];

  // Calculate time range
  const starts = schedules.map((s) => Number(s.start));
  const ends = schedules.map((s) => Number(s.start) + Number(s.duration));
  const minStart = Math.min(...starts);
  const maxEnd = Math.max(...ends);

  // Generate monthly data points
  const dataPoints: ChartDataPoint[] = [];
  const startDate = new Date(minStart * 1000);
  const endDate = new Date(maxEnd * 1000);

  let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (currentDate <= endDate) {
    const timestamp = Math.floor(currentDate.getTime() / 1000);
    const monthName = currentDate.toLocaleDateString('en-US', {
      month: 'long',
    });
    const year = currentDate.getFullYear();

    const dataPoint: ChartDataPoint = {
      month: `${monthName} ${year}`,
    };

    // Calculate vested amount for each schedule
    schedules.forEach((schedule, index) => {
      const vestedAmount = calculateVestedAmount(
        timestamp,
        Number(schedule.start),
        Number(schedule.cliff),
        Number(schedule.duration),
        schedule.amount
      );

      const scheduleKey = `vest${index + 1}`;
      dataPoint[scheduleKey] = vestedAmount || null;
    });

    dataPoints.push(dataPoint);
    currentDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      1
    );
  }

  return dataPoints;
}

/**
 * Custom hook to generate vesting chart data
 * Processes schedules and calculates vested amounts over time for chart display
 *
 * @param schedules - Array of vesting schedules to process
 * @returns Chart data points, loading state, and error state
 */
export const useVestingChart = ({
  schedules,
}: UseVestingChartProps): UseVestingChartReturn => {
  const [data, setData] = useState<ChartDataPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { papi } = useApiManager();
  const reqIdRef = useRef(0); // anti-race guard

  const fetchData = useCallback(async () => {
    const myReqId = ++reqIdRef.current;

    // Early returns for edge cases
    if (!schedules?.length) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const vestingConfig = getAppConfig().contracts.vestingPayments;

      if (!vestingConfig.address) {
        console.warn(
          'Vesting contract address is not configured, falling back to dummy data'
        );
        // Force dummy data mode when contract is not configured
        const schedulesWithAmounts = schedules.map((schedule) => ({
          ...schedule,
          amount: parseFloat(schedule.vested),
        }));

        if (myReqId !== reqIdRef.current) return;
        const chartData = generateMonthlyDataPoints(schedulesWithAmounts);
        setData(chartData);
        return;
      }

      let schedulesWithAmounts: Array<Schedule & { amount: number }>;

      // Handle dummy vs real data
      if (isDummySchedule(schedules[0])) {
        // Dummy data: use vested field directly
        schedulesWithAmounts = schedules.map((schedule) => ({
          ...schedule,
          amount: parseFloat(schedule.vested),
        }));
      } else {
        // Real data: fetch from contract
        schedulesWithAmounts = await fetchScheduleAmounts(
          schedules,
          papi,
          vestingConfig.address
        );
      }

      // Check if request is still current
      if (myReqId !== reqIdRef.current) return;

      const chartData = generateMonthlyDataPoints(schedulesWithAmounts);
      setData(chartData);
    } catch (err) {
      if (myReqId !== reqIdRef.current) return;
      console.error('Error generating vesting chart data:', err);
      setError('Failed to generate vesting chart data.');
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false);
    }
  }, [schedules, papi]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
  };
};
