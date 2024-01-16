import environmentConfig from 'constants/env';
import { BigNumber, ethers } from 'ethers';
import type { IBalancerVault, Ramos } from 'types/typechain';
import {
  DBN_ONE_HUNDRED,
  DBN_TEN_THOUSAND,
  DecimalBigNumber,
} from 'utils/DecimalBigNumber';

export enum WeightedPoolExitKind {
  EXACT_BPT_IN_FOR_TOKENS_OUT = 1,
  BPT_IN_FOR_EXACT_TOKENS_OUT,
}

export const limitInput = (input: string): number => {
  if (input === '0') return 0;

  return Number(input);
};

export const handleBlur = (
  value: number | '',
  minValue: number,
  maxValue: number
): number => {
  if (value === '') return minValue;
  if (value <= minValue) return minValue;
  if (value >= maxValue) return maxValue;
  return value;
};

export const formatJoinRequestTuple = (
  request?: IBalancerVault.JoinPoolRequestStructOutput
): string => {
  if (request) {
    return `[[${request.assets
      .map((asset) => `"${asset}"`)
      .join(',')}],[${request.maxAmountsIn
      .map((amount) => `"${amount}"`)
      .join(',')}],"${request.userData}",${request.fromInternalBalance}]`;
  }
  return '';
};

export const formatExitRequestTuple = (
  request?: IBalancerVault.ExitPoolRequestStructOutput
): string => {
  if (request) {
    return `[[${request?.assets
      .map((asset) => `"${asset}"`)
      .join(',')}],[${request?.minAmountsOut
      .map((amount) => `"${amount}"`)
      .join(',')}],"${request.userData}",${request.toInternalBalance}]`;
  }
  return '';
};

export const isTemple = (tokenAddress: string): boolean => {
  return (
    tokenAddress.toLowerCase() ===
    environmentConfig.tokens.temple.address.toLowerCase()
  );
};

export const getBpsPercentageFromTpf = (
  tpf: DecimalBigNumber,
  templePrice: DecimalBigNumber
) => {
  const percentageDiff = DecimalBigNumber.fromBN(
    tpf
      .sub(templePrice)
      .div(templePrice, templePrice.getDecimals())
      .mul(DBN_ONE_HUNDRED)
      .value.abs(),
    templePrice.getDecimals()
  );
  return percentageDiff.mul(DBN_ONE_HUNDRED);
};

const limitBasisPoints = async (
  basisPoints: DecimalBigNumber,
  ramos: Ramos,
  percentageOfGapToClose: number
) => {
  const postRebalancePriceImpactBasisPoints = DecimalBigNumber.fromBN(
    await ramos.postRebalanceDelta(),
    0
  );
  // adjust bps for user-selected % of gap to close
  basisPoints = basisPoints.mul(
    DecimalBigNumber.parseUnits(`${percentageOfGapToClose / 100}`, 18)
  );
  // account for RAMOS price impact limits
  if (basisPoints.gt(postRebalancePriceImpactBasisPoints))
    basisPoints = postRebalancePriceImpactBasisPoints;
  return basisPoints;
};

export const calculateTargetPriceDown = async (
  currentPrice: DecimalBigNumber,
  basisPoints: DecimalBigNumber,
  ramos: Ramos,
  percentageOfGapToClose: number
): Promise<DecimalBigNumber> => {
  const limitedBasisPoints = await limitBasisPoints(
    basisPoints,
    ramos,
    percentageOfGapToClose
  );

  const adjustedBps = limitedBasisPoints.div(
    DBN_TEN_THOUSAND,
    basisPoints.getDecimals()
  );
  return currentPrice.sub(currentPrice.mul(adjustedBps));
};

export const calculateTargetPriceUp = async (
  currentPrice: DecimalBigNumber,
  basisPoints: DecimalBigNumber,
  ramos: Ramos,
  percentageOfGapToClose: number
): Promise<DecimalBigNumber> => {
  const limitedBasisPoints = await limitBasisPoints(
    basisPoints,
    ramos,
    percentageOfGapToClose
  );

  const adjustedBps = limitedBasisPoints.div(
    DBN_TEN_THOUSAND,
    basisPoints.getDecimals()
  );
  return currentPrice.add(currentPrice.mul(adjustedBps));
};

export const decodeUserData = (userData: string) => {
  const [joinType, amountsIn, bptOut] = ethers.utils.defaultAbiCoder.decode(
    ['uint256', 'uint256[]', 'uint256'],
    userData
  );
  return {
    joinType,
    amountsIn,
    bptOut,
  };
};

export const makeJoinRequest = (
  tokens: string[],
  amountsIn: BigNumber[]
): IBalancerVault.JoinPoolRequestStruct => {
  // 1 === WeightedJoinPoolKind.EXACT_TOKENS_IN_FOR_BPT_OUT
  // https://dev.balancer.fi/resources/joins-and-exits/pool-joins

  const userData = ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'uint256[]', 'uint256'],
    [1, amountsIn, 0]
  );

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
  exitType: WeightedPoolExitKind
): IBalancerVault.ExitPoolRequestStruct => {
  let userData = '';

  switch (exitType) {
    case WeightedPoolExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT: {
      userData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256'],
        [exitType, bptAmount]
      );
      break;
    }
    case WeightedPoolExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT: {
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

export const applySlippage = (
  amount: BigNumber,
  slippage: number
): BigNumber => {
  const multipleAmount = (100 - slippage) / 100;
  const slippageDBN = DecimalBigNumber.parseUnits(`${multipleAmount}`, 18);
  const amountDBN = DecimalBigNumber.fromBN(amount, 18);
  return amountDBN.mul(slippageDBN).toBN(18);
};
