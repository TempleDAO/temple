export const limitSlippageInput = (input: number): number => {
  if (input < 0) return 0;
  if (input > 100) return 100;

  return input;
};

export const limitDeadlineInput = (input: number): number => {
  if (input < 1) return 1;

  return input;
};
