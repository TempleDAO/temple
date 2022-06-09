import { BigNumber } from 'ethers';
import { formatEther, parseEther, parseUnits } from 'ethers/lib/utils';

export const atto = 1e-18;

export const fromAtto = (bn: BigNumber): number => {
  return parseFloat(formatEther(bn));
};

export const toAtto = (n: number): BigNumber => {
  const numberString = n.toString();
  if (numberString.includes('e-')) {
    const [a, _] = numberString.split('e-');
    const num = a.split('.').join('');
    const big = parseUnits(num, 'wei');

    return big;
  }

  return parseEther(numberString);
};

export const ZERO = Object.freeze(BigNumber.from(0));
