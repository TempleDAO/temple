import { network, ethers } from "hardhat";
import { BigNumber, ContractFactory, Signer } from "ethers";
import { expect } from "chai";

export async function shouldThrow(p: Promise<any>, matches: RegExp) {
  try {
    await p;
  } catch(e) {
    expect(() => { throw e } ).throws(matches);
    return
  }

  expect.fail("Expected error matching: " + matches.source + " none thrown");
}

export async function mineNBlocks(numBlocks: number) {
  const blocks: Promise<any>[] = [];

  for (let i = 0; i < numBlocks; i++) {
    blocks.push(network.provider.send("evm_mine"));
  }

  return Promise.all(blocks);
}

/**
 * Current block timestamp
 */
export const blockTimestamp = async (): Promise<number> => {
  return (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
}

/**
 * Mine to a specific block timestamp
 */
export const mineToTimestamp = async (timestamp: number) => {
  const currentTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
  if (timestamp < currentTimestamp) {
    throw new Error("Cannot mine a timestamp in the past");
  }

  await network.provider.send("evm_increaseTime", [(timestamp - currentTimestamp)])
  await network.provider.send("evm_mine");
}

/**
 * Mine forward the given number of seconds
 */
export const mineForwardSeconds = async (seconds: number) => {
  await mineToTimestamp(await blockTimestamp() + seconds);
}

/**
 * Helper to always mine up to a given epoch (failing if we have passed it already)
 */
export const mineToEpoch = async (startTimestamp: number, epochSizeSecond: number, epochNumber: number) => {
  const currentTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
  const currentEpoch = Math.floor(((currentTimestamp - startTimestamp) / epochSizeSecond));
  if (epochNumber < currentEpoch) {
    throw new Error(`Cannot mine to epoch ${epochNumber}, it's in the past`);
  }

  const nextEpochStartTime = startTimestamp + (epochNumber * epochSizeSecond) + 1;
  await mineToTimestamp(nextEpochStartTime);
}

export function toAtto(n: number): BigNumber {
  return ethers.utils.parseEther(n.toString());
}

export function fromAtto(n: BigNumber): number {
  return Number.parseFloat(ethers.utils.formatUnits(n, 18));
}