import { BigNumber } from 'ethers';
import { formatEther, parseEther, parseUnits } from 'ethers/lib/utils';

export const atto = 1e-18;

export const fromAtto = (bn: BigNumber): number => {
  return parseFloat(formatEther(bn));
};

export const toAtto = (n: number): BigNumber => {
  return parseEther(n.toString());
};

export const ZERO = Object.freeze(BigNumber.from(0));
