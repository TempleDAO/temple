export function getYAxisDomainAndTicks(
  values: number[],
  tickCount = 4
): {
  yDomain: [number, number];
  yTicks: number[];
} {
  if (!values.length) return { yDomain: [0, 1], yTicks: [0, 1] };

  const max = Math.max(...values);
  const niceMax = Math.ceil(max * 1.1 * 10) / 10; // +10%, rounded to 1 decimal
  const step = niceMax / (tickCount - 1);

  const yTicks = Array.from({ length: tickCount }, (_, i) =>
    parseFloat((i * step).toFixed(2))
  );

  return {
    yDomain: [0, niceMax],
    yTicks,
  };
}
