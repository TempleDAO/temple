import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { SwapMode } from './types';
import { TOKENS_BY_MODE } from './constants';
import { BigNumber } from 'ethers';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { CryptoSelector, CryptoValue } from '../NewUI/HomeInput';

export function buildValueConfig(token: TICKER_SYMBOL): CryptoValue {
  return {
    kind: 'value',
    value: `${token}`,
  };
}

export function buildSelectConfig(mode: SwapMode): CryptoSelector {
  return {
    kind: 'select',
    cryptoOptions: TOKENS_BY_MODE[mode],
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onCryptoChange: () => {},
    selected: TOKENS_BY_MODE[mode][0],
  };
}

export function calculateMinAmountOut(
  amount: BigNumber,
  slippageTolerance: number,
  decimals = 18
) {
  const slippage = `${1 - slippageTolerance / 100}`;
  const slippageDbn = DecimalBigNumber.parseUnits(slippage, decimals);
  const minAmountOutDbn = DecimalBigNumber.fromBN(amount, decimals).mul(
    slippageDbn
  );

  return minAmountOutDbn.toBN(decimals);
}
