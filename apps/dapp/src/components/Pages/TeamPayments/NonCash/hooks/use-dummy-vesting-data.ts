/**
 * Dummy vesting schedules for testing chart visuals
 * Mimics the structure from the subgraph query
 */

// --- Constants ---
const MS_TO_SECONDS = 1000;
const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_MONTH = 30 * SECONDS_PER_DAY;

export type Schedule = {
  id: string;
  start: string; // timestamp in seconds
  cliff: string; // timestamp in seconds
  duration: string; // duration in seconds
  vested: string; // total amount allocated (in token units)
  released: string; // amount already claimed
  revoked: boolean;
};

// --- Helpers ---
function createTimestamp(date: Date): string {
  return Math.floor(date.getTime() / MS_TO_SECONDS).toString();
}

function addMonthsToDate(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function createDummySchedule(
  id: string,
  startDate: Date,
  cliffMonths: number,
  durationMonths: number,
  amount: number,
  released = 0
): Schedule {
  const cliffDate = addMonthsToDate(startDate, cliffMonths);
  return {
    id,
    start: createTimestamp(startDate),
    cliff: createTimestamp(cliffDate),
    duration: (durationMonths * SECONDS_PER_MONTH).toString(),
    vested: amount.toString(),
    released: released.toString(),
    revoked: false,
  };
}

// --- Dummy Data ---
// Create realistic vesting schedules with different scenarios
const now = new Date();
const baseDate = new Date(now.getFullYear(), now.getMonth(), 15); // 15th of current month

export const DUMMY_SCHEDULES: Schedule[] = [
  // Schedule 1: Immediate vesting (no cliff)
  createDummySchedule(
    '0xdummy0000000000000000000000000000000000000000000000000000000001',
    baseDate,
    0, // no cliff
    8, // 8 months duration
    40000, // 40k TGLD
    0
  ),

  // Schedule 2: 1-month cliff
  createDummySchedule(
    '0xdummy0000000000000000000000000000000000000000000000000000000002',
    addMonthsToDate(baseDate, 1), // Feb
    1, // 1-month cliff
    7, // 7 months duration
    35000, // 35k TGLD
    0
  ),

  // Schedule 3: 2-month cliff with some released
  createDummySchedule(
    '0xdummy0000000000000000000000000000000000000000000000000000000003',
    addMonthsToDate(baseDate, 2), // Mar
    2, // 2-month cliff
    6, // 6 months duration
    30000, // 30k TGLD
    5000 // 5k already released
  ),

  // Schedule 4: 3-month cliff
  createDummySchedule(
    '0xdummy0000000000000000000000000000000000000000000000000000000004',
    addMonthsToDate(baseDate, 3), // Apr
    3, // 3-month cliff
    5, // 5 months duration
    25000, // 25k TGLD
    0
  ),
];

/**
 * Custom hook to provide dummy vesting data for testing
 * Returns schedules and calculated metrics matching the real data structure
 *
 * @returns Dummy vesting schedules, metrics, and loading state
 */
export const useDummyVestingSchedules = () => {
  // Calculate totals from dummy schedules
  const totalAllocated = DUMMY_SCHEDULES.reduce(
    (sum, s) => sum + parseFloat(s.vested),
    0
  );

  const totalReleased = DUMMY_SCHEDULES.reduce(
    (sum, s) => sum + parseFloat(s.released),
    0
  );

  // For demo purposes, assume all allocated amounts are vested
  // In real scenarios, this would be calculated based on current time vs vesting schedule
  const totalVested = totalAllocated;

  return {
    schedules: DUMMY_SCHEDULES,
    totalAllocated,
    totalVested,
    totalReleased,
    loading: false,
    error: null,
  };
};
