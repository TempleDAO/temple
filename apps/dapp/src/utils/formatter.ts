import { formatBigNumber, getTokenInfo } from 'components/Vault/utils';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber } from 'ethers';

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

export const formatNumberFixedDecimals = (
  n: number | string,
  decimals = 2
): number => {
  if (typeof n === 'string') n = Number(n);
  return +Number(n).toFixed(decimals);
};

export const formatToken = (
  value: BigNumber | undefined,
  token: TICKER_SYMBOL,
  decimals = 2
) => {
  if (!value) return '0';
  return `${formatNumberFixedDecimals(
    formatBigNumber(value, getTokenInfo(token).decimals),
    decimals
  )}`;
};

export const formatMillions = (n: number | string): string => {
  if (typeof n === 'string') n = Number(n);
  const million = 1000000;
  return `${Number(n / million).toFixed(2)}M`;
};

export const allocationToIncense = (allocation: number): number => {
  return formatNumberFixedDecimals(allocation / 1000, 0);
};

export const truncateDecimals = (
  number: string | number,
  targetDecimals = 2
): string => {
  const stringNumber = number.toString();
  // eslint-disable-next-line prefer-const
  let [int, decimals] = (stringNumber || '0').split('.');

  if (decimals && decimals.length > targetDecimals) {
    decimals = decimals.substring(0, targetDecimals);
  }

  return decimals ? `${int}.${decimals}` : int;
};

export const formatNumberAbbreviated = (number: number) => {
  const stringified = number.toString();
  const decimalPlaces = stringified.includes('.')
    ? stringified.split('.')[1].length
    : 0;
  const abbreviations = ['K', 'M', 'B'];

  const localeFormatted =
    decimalPlaces > 3
      ? number.toLocaleString('en-US', {
          minimumFractionDigits: 4,
        })
      : number.toLocaleString('en-US');

  const thousandsSeparatorCount = localeFormatted.split(',').length - 1;
  const shortenedString = localeFormatted.slice(0, 5);

  if (thousandsSeparatorCount > 0) {
    return {
      number: parseFloat(shortenedString),
      thousandsSuffix: abbreviations[thousandsSeparatorCount - 1],
      string:
        shortenedString.replace(',', '.') +
        abbreviations[thousandsSeparatorCount - 1],
    };
  } else {
    return {
      number: parseFloat(shortenedString),
      thousandsSuffix: '',
      string: shortenedString.replace(',', '.'),
    };
  }
};
