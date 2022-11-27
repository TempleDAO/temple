import environmentConfig from 'constants/env';
import { BigNumber, ethers } from 'ethers';
import type { AMO__IBalancerVault } from 'types/typechain/AMO__IBalancerVault';
import { DBN_ONE_HUNDRED, DBN_TEN_THOUSAND, DecimalBigNumber } from 'utils/DecimalBigNumber';

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
  exitType: 1 | 2 = 1
): AMO__IBalancerVault.ExitPoolRequestStruct => {
  let userData = '';

  switch (exitType) {
    case 1: {
      userData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [exitType, bptAmount]);
      break;
    }
    case 2: {
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
