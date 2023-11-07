export type LabeledTimeIntervals = readonly {
  label: ChartSupportedTimeInterval;
  interval: number;
}[];
export type ChartSupportedTimeInterval = '1D' | '1W' | '1M' | '1Y';

export enum TIME_INTERVAL {
  ONE_HOUR = 60 * 60 * 1000,
  ONE_DAY = 24 * ONE_HOUR,
  ONE_WEEK = 7 * ONE_DAY,
  TWO_WEEKS = ONE_WEEK * 2,
  ONE_MONTH = ONE_DAY * 30,
  THREE_MONTHS = ONE_MONTH * 3,
  SIX_MONTHS = ONE_MONTH * 6,
  ONE_YEAR = ONE_MONTH * 12,
}

export const DEFAULT_CHART_INTERVALS: LabeledTimeIntervals = [
  { interval: TIME_INTERVAL.ONE_DAY, label: '1D' },
  { interval: TIME_INTERVAL.ONE_WEEK, label: '1W' },
  { interval: TIME_INTERVAL.ONE_MONTH, label: '1M' },
  { interval: TIME_INTERVAL.ONE_YEAR, label: '1Y' },
] as const;
