import { ethers } from 'ethers';

export const getDaysToTimestamp = (timestamp: number): number => {
  const now = Date.now();
  const dayMill = 24 * 60 * 60 * 1000;
  return Math.ceil((timestamp - now) / dayMill);
};

export const getCurrentBlockTimestamp = async (): Promise<number> => {
  const provider = new ethers.providers.JsonRpcProvider();
  const currentBlockNumber = await provider.getBlockNumber();
  const currentBlockTimestamp = (await provider.getBlock(currentBlockNumber)).timestamp;

  return currentBlockTimestamp;
};
