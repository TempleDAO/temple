import { CryptoValue, CryptoSelector } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { SwapMode } from './types';
import { TOKENS_BY_MODE } from './constants';
import { BigNumber } from 'ethers';
import { fromAtto } from 'utils/bigNumber';

// See apps/dapp/src/components/Input/Input.tsx
export function buildValueConfig(token: TICKER_SYMBOL): CryptoValue {
  return {
    kind: 'value',
    value: `${token}`,
  };
}

// See apps/dapp/src/components/Input/Input.tsx
export function buildSelectConfig(
  defaultToken: TICKER_SYMBOL,
  mode: SwapMode,
  isFraxSellDisabled?: boolean
): CryptoSelector | CryptoValue {
  const defaultOption = {
    value: defaultToken,
    label: defaultToken,
  };

  const selectOptions = Object.values(TOKENS_BY_MODE[mode]).map((token) => ({
    value: token,
    label: token,
  }));

  if (mode === SwapMode.Sell && isFraxSellDisabled) {
    return {
      kind: 'value',
      value: TICKER_SYMBOL.FEI,
    };
  }

  return {
    kind: 'select',
    cryptoOptions: selectOptions,
    defaultValue: defaultOption,
    onCryptoChange: () => {},
  };
}

export function createButtonLabel(inputToken: TICKER_SYMBOL, outputToken: TICKER_SYMBOL, swapMode: SwapMode): string {
  switch (swapMode) {
    case SwapMode.Buy:
      return `Buy ${outputToken} with ${inputToken}`;
    case SwapMode.Sell:
      return `Sell ${inputToken} for ${outputToken}`;
    default:
      return 'Swap';
  }
}

export function isPairToken(token: TICKER_SYMBOL): token is TICKER_SYMBOL.FRAX | TICKER_SYMBOL.FEI {
  return Boolean(token === TICKER_SYMBOL.FRAX || TICKER_SYMBOL.FEI);
}

export const isIvSwap = (quote: BigNumber | void, templeAmount: number, iv: number) =>
  !!quote && fromAtto(quote) <= templeAmount * iv;
