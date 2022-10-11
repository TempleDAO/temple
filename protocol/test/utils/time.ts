import { ethers } from 'hardhat';

const { BigNumber } = ethers;

export async function advanceBlock() {
  return ethers.provider.send('evm_mine', []);
}

export async function advanceBlocks(blockCount: number) {
  for (let i = 0; i < blockCount; i++) {
    await advanceBlock();
  }
}

export async function advanceBlockTo(blockNumber: number) {
  for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++) {
    await advanceBlock();
  }
}

export async function increase(value: number) {
  await ethers.provider.send('evm_increaseTime', [value]);
  await advanceBlock();
}

export async function latest() {
  const block = await ethers.provider.getBlock('latest');
  return BigNumber.from(block.timestamp);
}

export async function advanceTimeAndBlock(time: number) {
  await advanceTime(time);
  await advanceBlock();
}

export async function advanceTime(time: number) {
  await ethers.provider.send('evm_increaseTime', [time]);
}

export const duration = {
  seconds: function (val: string) {
    return BigNumber.from(val);
  },
  minutes: function (val: string) {
    return BigNumber.from(val).mul(this.seconds('60'));
  },
  hours: function (val: string) {
    return BigNumber.from(val).mul(this.minutes('60'));
  },
  days: function (val: string) {
    return BigNumber.from(val).mul(this.hours('24'));
  },
  weeks: function (val: string) {
    return BigNumber.from(val).mul(this.days('7'));
  },
  years: function (val: string) {
    return BigNumber.from(val).mul(this.days('365'));
  },
};
