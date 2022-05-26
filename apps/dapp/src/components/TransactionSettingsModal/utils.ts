export const limitSlippageInput = (input: number): number => {
  if (input > 100) return 100;

  return input;
};

export const handleBlur = (value: number, minValue: number, defaultValue: number) => {
  if (value <= 0) {
    return defaultValue;
  }

  if (value < minValue) {
    return minValue;
  }

  return value;
};
