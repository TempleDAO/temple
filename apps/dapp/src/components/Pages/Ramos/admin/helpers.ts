import environmentConfig from 'constants/env';
import { BigNumber, ethers } from 'ethers';
import type { AMO__IBalancerVault } from 'types/typechain';
import { DBN_ONE_HUNDRED, DBN_TEN_THOUSAND, DecimalBigNumber } from 'utils/DecimalBigNumber';

export enum WeightedPoolExitKind {
  EXACT_BPT_IN_FOR_TOKENS_OUT = 1,
  BPT_IN_FOR_EXACT_TOKENS_OUT,
}

export const limitInput = (input: string): number => {
  if (input === '0') return 0;

  return Number(input);
};

export const handleBlur = (value: number | '', minValue: number, maxValue: number): number => {
  if (value === '') return minValue;
  if (value <= minValue) return minValue;
  if (value >= maxValue) return maxValue;
  return value;
};

export const formatJoinRequestTuple = (request?: AMO__IBalancerVault.JoinPoolRequestStruct): string => {
  if (request) {
    return `[[${request.assets.map((asset) => `"${asset}"`).join(',')}],[${request.maxAmountsIn
      .map((amount) => `"${amount}"`)
      .join(',')}],"${request.userData}",false]`;
  }
  return '';
};

export const formatExitRequestTuple = (request?: AMO__IBalancerVault.ExitPoolRequestStruct): string => {
  if (request) {
    return `[[${request?.assets.map((asset) => `"${asset}"`).join(',')}],[${request?.minAmountsOut
      .map((amount) => `"${amount}"`)
      .join(',')}],"${request?.userData}",false]`;
  }
  return '';
};

export const isTemple = (tokenAddress: string): boolean => {
  return tokenAddress === environmentConfig.tokens.temple.address;
};

export const getBpsPercentageFromTpf = (tpf: DecimalBigNumber, templePrice: DecimalBigNumber) => {
  const percentageDiff = DecimalBigNumber.fromBN(
    tpf.sub(templePrice).div(templePrice, templePrice.getDecimals()).mul(DBN_ONE_HUNDRED).value.abs(),
    templePrice.getDecimals()
  );
  return percentageDiff.mul(DBN_ONE_HUNDRED);
};

export const calculateTargetPriceDown = (
  currentPrice: DecimalBigNumber,
  basisPoints: DecimalBigNumber
): DecimalBigNumber => {
  const adjustedBps = basisPoints.div(DBN_TEN_THOUSAND, basisPoints.getDecimals());
  return currentPrice.sub(currentPrice.mul(adjustedBps));
};

export const calculateTargetPriceUp = (
  currentPrice: DecimalBigNumber,
  basisPoints: DecimalBigNumber
): DecimalBigNumber => {
  const adjustedBps = basisPoints.div(DBN_TEN_THOUSAND, basisPoints.getDecimals());
  return currentPrice.add(currentPrice.mul(adjustedBps));
};

export const randomize = (amount: DecimalBigNumber, percentage: number) => {
  const randomizer = (Math.random() * percentage) / 100;
  const randomizerDbn = DecimalBigNumber.parseUnits(`${randomizer}`, amount.getDecimals());

  return amount.sub(amount.mul(randomizerDbn));
};

export const makeJoinRequest = (
  tokens: string[],
  amountsIn: BigNumber[],
): AMO__IBalancerVault.JoinPoolRequestStruct => {
  // 1 === WeightedJoinPoolKind.EXACT_TOKENS_IN_FOR_BPT_OUT
  // https://dev.balancer.fi/resources/joins-and-exits/pool-joins
  
  const userData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'uint256'], [1, amountsIn, 0]);

  return {
    assets: tokens,
    maxAmountsIn: amountsIn,
    userData: userData,
    fromInternalBalance: false,
  };
};

export const makeExitRequest = (
  tokens: string[],
  amountsOut: BigNumber[],
  bptAmount: BigNumber,
  exitType: WeightedPoolExitKind,
): AMO__IBalancerVault.ExitPoolRequestStruct => {
  let userData = '';

  switch (exitType) {
    case WeightedPoolExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT: {
      userData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [exitType, bptAmount]);
      break;
    }
    case WeightedPoolExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT: {
      userData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256[]', 'uint256'],
        [exitType, amountsOut, bptAmount]
      );
      break;
    }
  }

  return {
    assets: tokens,
    minAmountsOut: amountsOut,
    userData: userData,
    toInternalBalance: false,
  };
};
