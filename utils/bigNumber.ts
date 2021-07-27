import { BigNumber } from 'ethers';
import { formatEther, parseEther } from 'ethers/lib/utils';

export const fromAtto = (bn: BigNumber): number => {
  return parseFloat(formatEther(bn));
};

export const toAtto = (n: number): BigNumber => {
  return parseEther(n.toString());
};
