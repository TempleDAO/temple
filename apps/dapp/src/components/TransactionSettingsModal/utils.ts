export const limitInput = (input: string): number | '' => {
  if (input === '0') return 0;
  if (input === '') return '';

  return Number(input);
};

export const handleBlur = (
  value: number,
  minValue: number,
  maxValue: number,
  defaultValue: number
) => {
  if (value <= 0) return defaultValue;

  if (value <= minValue) return minValue;

  if (value >= maxValue) return maxValue;

  return value;
};
