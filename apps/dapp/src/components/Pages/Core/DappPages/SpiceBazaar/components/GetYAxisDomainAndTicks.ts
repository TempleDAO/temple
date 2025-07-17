export function getYAxisDomainAndTicks(
  values: number[],
  tickCount = 4
): {
  yDomain: [number, number];
  yTicks: number[];
} {
  if (!values.length) return { yDomain: [0, 1], yTicks: [0, 1] };

  const max = Math.max(...values);
  const min = Math.min(...values);

  if (min === max) {
    const buffer = max === 0 ? 1 : max * 0.1;
    const domainMin = Math.max(0, max - buffer);
    const domainMax = max + buffer;
    return {
      yDomain: [domainMin, domainMax],
      yTicks: [domainMin, max, domainMax],
    };
  }

  const isSmallNumbers = max < 0.1;

  if (isSmallNumbers) {
    const range = max - min;
    const padding = range * 0.1; // 10% padding on each side
    const domainMin = Math.max(0, min - padding);
    const domainMax = max + padding;

    const getDecimalPlaces = (num: number): number => {
      if (num === 0) return 2;
      return Math.max(2, Math.ceil(-Math.log10(Math.abs(num))) + 1);
    };

    const decimalPlaces = Math.max(
      getDecimalPlaces(domainMin),
      getDecimalPlaces(domainMax)
    );

    // Generate evenly spaced ticks
    const step = (domainMax - domainMin) / (tickCount - 1);
    const yTicks = Array.from({ length: tickCount }, (_, i) =>
      parseFloat((domainMin + i * step).toFixed(decimalPlaces))
    );

    return {
      yDomain: [domainMin, domainMax],
      yTicks,
    };
  } else {
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
}
