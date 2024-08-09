export const copyBalance = (value: number, fn: (value: number) => void) => {
  if (value > 0) {
    fn(value);
  }
};
