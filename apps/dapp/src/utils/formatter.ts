/**
 * Formats the input number to 2 decimals if it has decimals or no decimals if no decimals
 * @param n: number to format
 */
export const formatNumber = (n: number | string): number => {
  if (typeof n === 'string') n = Number(n);
  return n % 1 === 0 ? n : +Number(n).toFixed(2);
};

export const formatNumberWithCommas = (n: number | string): string => {
  if (typeof n === 'string') n = Number(n);
  return formatNumber(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const formatNumberFixedDecimals = (n: number | string, decimals = 2): number => {
  if (typeof n === 'string') n = Number(n);
  return +Number(n).toFixed(decimals);
};

export const formatMillions = (n: number | string): string => {
  if (typeof n === 'string') n = Number(n);
  const million = 1000000;
  return `${Number(n / million).toFixed(2)}M`;
};

export const allocationToIncense = (allocation: number): number => {
  return formatNumberFixedDecimals(allocation / 1000, 0);
};
