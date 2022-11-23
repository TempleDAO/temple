export const limitInput = (input: string): number => {
  if (input === '0') return 0;

  return Number(input);
};

export const handleBlur = (value: number | '', minValue: number, maxValue: number) => {
  if (value === '') return minValue;
  if (value <= minValue) return minValue;
  if (value >= maxValue) return maxValue;
  return value;
};