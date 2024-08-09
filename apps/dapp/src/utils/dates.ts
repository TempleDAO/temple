export const getDaysToTimestamp = (timestamp: number): number => {
  const now = Date.now();
  const dayMill = 24 * 60 * 60 * 1000;
  return Math.ceil((timestamp - now) / dayMill);
};
