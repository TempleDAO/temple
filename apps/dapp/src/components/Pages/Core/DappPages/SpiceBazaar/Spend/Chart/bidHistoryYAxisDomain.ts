/**
 * Calculate Y-axis domain and ticks for Bid History chart
 * Starts at 0, ends slightly above max value with exactly 5 evenly spaced ticks
 */
export function getBidHistoryYAxisConfig(values: number[]): {
  yDomain: [number, number];
  yTicks: number[];
} {
  if (!values.length)
    return { yDomain: [0, 1], yTicks: [0, 0.25, 0.5, 0.75, 1] };

  const max = Math.max(...values);

  // Domain: start at 0, end 5% above max (like the Bid charts)
  const domainMax = max * 1.05;

  // Generate exactly 5 evenly spaced ticks (including 0 and domainMax)
  const tickCount = 5;
  const ticks: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    ticks.push((domainMax / (tickCount - 1)) * i);
  }

  return {
    yDomain: [0, domainMax],
    yTicks: ticks,
  };
}
