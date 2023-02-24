import type { LabeledTimeIntervals, ChartSupportedTimeInterval } from 'utils/time-intervals';

import { DEFAULT_CHART_INTERVALS } from './time-intervals';

interface UnformattedTimestampedValue {
  timestamp: string;
}

interface FormattedTimestampedValue {
  timestamp: number;
}

type DataPointFormatter<U extends UnformattedTimestampedValue, F extends FormattedTimestampedValue> = (
  dataPoint: U
) => F;

type PreparedData<T extends FormattedTimestampedValue> = Record<ChartSupportedTimeInterval, T[]>;

export function prepareTimestampedChartData<
  U extends UnformattedTimestampedValue,
  D extends U[],
  H extends U[],
  F extends FormattedTimestampedValue
>(dailySnapshots: D, hourlySnapshots: H, formatDataPoint: DataPointFormatter<U, F>) {
  const dailyData = dailySnapshots;
  const hourlyData = hourlySnapshots;

  if (!dailyData) {
    console.warn('Missing response data for daily metrics');
    return null;
  }

  const now = new Date().getTime();

  const preparedDailyData = filterByTimeIntervals(dailyData, DEFAULT_CHART_INTERVALS, now, formatDataPoint);

  if (!hourlyData) {
    console.warn('Missing response data for hourly metrics');
    return preparedDailyData;
  }

  const preparedHourlyData = hourlyData.map((metric) => formatDataPoint(metric));

  return {
    ...preparedDailyData,
    '1D': preparedHourlyData,
  };
}

function filterByTimeIntervals<U extends UnformattedTimestampedValue, F extends FormattedTimestampedValue>(
  data: U[],
  timeIntervals: LabeledTimeIntervals,
  now: number,
  formatDataPoint: DataPointFormatter<U, F>
) {
  const metricsByIntervalAccumulator: PreparedData<F> = {
    '1D': [],
    '1W': [],
    '1M': [],
    '1Y': [],
  };

  const sortedTimeIntervals = timeIntervals.map((interval) => interval).sort((a, b) => a.interval - b.interval);

  return data.reduce((acc, metric) => {
    const formattedDataPoint = formatDataPoint(metric);

    const biggestIntervalMatchIndex = sortedTimeIntervals.findIndex(
      (labeledInterval) => now - formattedDataPoint.timestamp <= labeledInterval.interval
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

      acc[key].push(formattedDataPoint);
    }

    return acc;
  }, metricsByIntervalAccumulator);
}
