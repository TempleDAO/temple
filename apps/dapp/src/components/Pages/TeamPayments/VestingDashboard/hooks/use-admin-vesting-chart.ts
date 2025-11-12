import { useMemo } from 'react';
import { getAppConfig } from 'constants/newenv';
import { allVestingSchedules, useCachedSubgraphQuery } from 'utils/subgraph';

const TOP_N_USERS = 10;
const DAYS_IN_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const TOTAL_LINE_OFFSET = 1.1; // 10% above bars
const MS_TO_SECONDS = 1000;

type Schedule = {
  id: string;
  start: string;
  cliff: string;
  duration: string;
  vested: string;
  released: string;
  revoked: boolean;
  recipient: {
    id: string;
  };
};

export type AdminChartDataPoint = {
  timestamp: number;
  total?: number; // Total vesting for the month (dotted line)
  [key: string]: number | undefined; // Dynamic keys for each user (user1, user2, etc.)
};

export type UserSeries = {
  key: string;
  address: string;
  totalAllocation: number;
};

type UseAdminVestingChartReturn = {
  chartData: AdminChartDataPoint[];
  userSeries: UserSeries[];
  loading: boolean;
  error: string | null;
};

/**
 * Calculate vested amount for a schedule at a given timestamp
 */
function calculateVestedAtTime(
  schedule: Schedule,
  targetTimestamp: number
): number {
  const start = parseInt(schedule.start);
  const cliff = parseInt(schedule.cliff); // This is an absolute timestamp, not a duration
  const duration = parseInt(schedule.duration);
  const totalVested = parseFloat(schedule.vested);

  // Convert targetTimestamp from ms to seconds
  const targetTime = Math.floor(targetTimestamp / 1000);

  // If before cliff, nothing vested
  if (targetTime < cliff) {
    return 0;
  }

  // If after full vesting period, return total vested
  const end = start + duration;
  if (targetTime >= end) {
    return totalVested;
  }

  // Linear vesting between cliff and end
  const vestingPeriod = end - cliff;
  const elapsedSinceCliff = targetTime - cliff;
  const vestedAmount = (totalVested * elapsedSinceCliff) / vestingPeriod;

  return vestedAmount;
}

// ---- Pure helpers (no side-effects) ----
function groupSchedulesByUser(schedules: Schedule[]): {
  userSchedules: Map<string, Schedule[]>;
  userAllocations: Map<string, number>;
} {
  const userSchedules = new Map<string, Schedule[]>();
  const userAllocations = new Map<string, number>();

  schedules.forEach((schedule) => {
    const recipient = schedule.recipient.id.toLowerCase();
    if (!userSchedules.has(recipient)) {
      userSchedules.set(recipient, []);
      userAllocations.set(recipient, 0);
    }
    // Safe to use non-null assertion here since we just checked and set above
    const userScheduleList = userSchedules.get(recipient)!;
    userScheduleList.push(schedule);
    userAllocations.set(
      recipient,
      userAllocations.get(recipient)! + parseFloat(schedule.vested)
    );
  });

  return { userSchedules, userAllocations };
}

function calculateTimeRange(schedules: Schedule[]): {
  earliestStart: number;
  latestEnd: number;
} {
  let earliestStart = Infinity;
  let latestEnd = 0;

  schedules.forEach((schedule) => {
    const start = parseInt(schedule.start);
    const end = start + parseInt(schedule.duration);

    if (start < earliestStart) earliestStart = start;
    if (end > latestEnd) latestEnd = end;
  });

  return { earliestStart, latestEnd };
}

function generateMonthlyTimestamps(
  earliestStart: number,
  latestEnd: number
): number[] {
  const monthlyTimestamps: number[] = [];
  const startDate = new Date(earliestStart * MS_TO_SECONDS);
  const endDate = new Date(latestEnd * MS_TO_SECONDS);

  // Start from the beginning of the first month
  const currentDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    1
  );

  while (currentDate <= endDate) {
    monthlyTimestamps.push(currentDate.getTime());
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return monthlyTimestamps;
}

function calculateIncrementalVesting(
  userSchedules: Schedule[],
  timestamp: number,
  nextMonthTimestamp: number
): number {
  // Calculate vested at start of month
  const monthStartVested = userSchedules.reduce((sum, schedule) => {
    return sum + calculateVestedAtTime(schedule, timestamp);
  }, 0);

  // Calculate vested at end of month
  const monthEndVested = userSchedules.reduce((sum, schedule) => {
    return sum + calculateVestedAtTime(schedule, nextMonthTimestamp);
  }, 0);

  // Incremental vesting for this month
  const incrementalVesting = Math.max(0, monthEndVested - monthStartVested);
  return Math.round(incrementalVesting);
}

function generateChartDataPoints(
  monthlyTimestamps: number[],
  userSeriesData: UserSeries[],
  userSchedules: Map<string, Schedule[]>
): AdminChartDataPoint[] {
  return monthlyTimestamps.map((timestamp, monthIndex) => {
    const dataPoint: AdminChartDataPoint = { timestamp };
    let monthTotal = 0;

    // For each top user, calculate incremental vesting this month
    userSeriesData.forEach((userSeries) => {
      const userScheds = userSchedules.get(userSeries.address) || [];

      // Calculate next month timestamp
      const nextMonthTimestamp =
        monthIndex < monthlyTimestamps.length - 1
          ? monthlyTimestamps[monthIndex + 1]
          : timestamp + DAYS_IN_MONTH_MS;

      const incrementalVesting = calculateIncrementalVesting(
        userScheds,
        timestamp,
        nextMonthTimestamp
      );

      dataPoint[userSeries.key] = incrementalVesting;
      monthTotal += incrementalVesting;
    });

    // Add total line (dotted line above bars) - offset to sit above bars
    dataPoint.total = monthTotal * TOTAL_LINE_OFFSET;

    return dataPoint;
  });
}

/**
 * Hook to fetch all vesting schedules and calculate monthly aggregated vesting amounts
 */
export const useAdminVestingChart = (
  walletAddress?: string
): UseAdminVestingChartReturn => {
  const subgraphUrl = getAppConfig().vesting.subgraphUrl;

  const {
    data: response,
    isLoading: loading,
    error,
  } = useCachedSubgraphQuery(subgraphUrl, allVestingSchedules());

  // Filter schedules by recipient if walletAddress is provided
  const schedules = useMemo(() => {
    const allSchedules = response?.schedules ?? [];

    // Treat empty string as no filter
    if (!walletAddress?.trim()) {
      return allSchedules;
    }

    const normalizedAddress = walletAddress.toLowerCase();
    return allSchedules.filter(
      (schedule) => schedule.recipient.id.toLowerCase() === normalizedAddress
    );
  }, [response, walletAddress]);

  // Calculate user series and monthly aggregated data
  const { chartData, userSeries } = useMemo(() => {
    // Early return for empty schedules
    if (schedules.length === 0) {
      return { chartData: [], userSeries: [] };
    }

    // Group schedules by recipient and calculate total allocation per user
    const { userSchedules, userAllocations } = groupSchedulesByUser(schedules);

    // Sort users by total allocation and take top N
    const sortedUsers = Array.from(userAllocations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N_USERS);

    // Create user series metadata
    const userSeriesData: UserSeries[] = sortedUsers.map(
      ([address, allocation], index) => ({
        key: `user${index + 1}`,
        address,
        totalAllocation: allocation,
      })
    );

    // Calculate time range and generate monthly timestamps
    const { earliestStart, latestEnd } = calculateTimeRange(schedules);
    const monthlyTimestamps = generateMonthlyTimestamps(
      earliestStart,
      latestEnd
    );

    // Generate chart data points
    const dataPoints = generateChartDataPoints(
      monthlyTimestamps,
      userSeriesData,
      userSchedules
    );

    return { chartData: dataPoints, userSeries: userSeriesData };
  }, [schedules]);

  return {
    chartData,
    userSeries,
    loading,
    error: error ? 'Failed to fetch vesting schedules.' : null,
  };
};
