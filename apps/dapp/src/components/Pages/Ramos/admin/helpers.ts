import environmentConfig from 'constants/env';
import { Token } from 'constants/env/types';
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
  const tokens: Token[] = Object.values(environmentConfig.tokens);
  const tokenMatch = tokens.find(({ address }) => address === tokenAddress);
  return Boolean(tokenMatch && tokenMatch.symbol === 'TEMPLE');
};

export const getPricePercentageFromTpf = (tpf: DecimalBigNumber, templePrice: DecimalBigNumber) => {
  return DecimalBigNumber.fromBN(
    tpf.sub(templePrice).div(templePrice, 18).mul(DBN_ONE_HUNDRED).value.abs(),
    templePrice.getDecimals()
  );
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
  const randomizer = Math.random() * percentage / 100;
  const randomizerDbn = DecimalBigNumber.parseUnits(`${randomizer}`, amount.getDecimals());

  return amount.sub(amount.mul(randomizerDbn));
}