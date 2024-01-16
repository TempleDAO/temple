import type {
  LabeledTimeIntervals,
  ChartSupportedTimeInterval,
} from 'utils/time-intervals';

import { DEFAULT_CHART_INTERVALS } from './time-intervals';

interface UnformattedTimestampedValue {
  timestamp: string | number;
}

interface FormattedTimestampedValue {
  timestamp: number;
}

type DataPointFormatter<
  U extends UnformattedTimestampedValue,
  F extends FormattedTimestampedValue
> = (dataPoint: U) => F;

type FormattedChartData<T extends FormattedTimestampedValue> = Record<
  ChartSupportedTimeInterval,
  T[]
>;

export function formatTimestampedChartData<
  U extends UnformattedTimestampedValue,
  D extends U[],
  H extends U[],
  F extends FormattedTimestampedValue
>(
  dailySnapshots: D,
  hourlySnapshots: H,
  formatDataPoint: DataPointFormatter<U, F>
) {
  const dailyData = dailySnapshots;
  const hourlyData = hourlySnapshots;

  const now = new Date().getTime();

  const formattedDailyData = formatDailyDataPoints(
    dailyData,
    DEFAULT_CHART_INTERVALS,
    now,
    formatDataPoint
  );

  const formattedHourlyData = hourlyData.map((metric) =>
    formatDataPoint(metric)
  );

  return {
    ...formattedDailyData,
    '1D': formattedHourlyData,
  };
}

export function formatDailyDataPoints<
  U extends UnformattedTimestampedValue,
  F extends FormattedTimestampedValue
>(
  data: U[],
  timeIntervals: LabeledTimeIntervals,
  now: number,
  formatDataPoint: DataPointFormatter<U, F>
) {
  const metricsByIntervalAccumulator: Omit<FormattedChartData<F>, '1D'> = {
    '1W': [],
    '1M': [],
    '1Y': [],
  };

  const sortedTimeIntervals = timeIntervals
    .map((interval) => interval)
    .sort((a, b) => a.interval - b.interval);

  return data.reduce((acc, metric) => {
    const formattedDataPoint = formatDataPoint(metric);

    const biggestIntervalMatchIndex = sortedTimeIntervals.findIndex(
      (labeledInterval) =>
        now - formattedDataPoint.timestamp <= labeledInterval.interval
    );

    if (biggestIntervalMatchIndex === -1) {
      return acc;
    }

    for (
      let timeIntervalIndex = biggestIntervalMatchIndex;
      timeIntervalIndex < sortedTimeIntervals.length;
      timeIntervalIndex++
    ) {
      const key = sortedTimeIntervals[timeIntervalIndex].label;

      if (key === '1D') {
        continue;
      }

      acc[key].push(formattedDataPoint);
    }

    return acc;
  }, metricsByIntervalAccumulator);
}
