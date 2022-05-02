import { CryptoValue, CryptoSelector } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { SwapMode } from './types';
import { TOKENS_BY_MODE } from './constants';

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
  mode: SwapMode
): CryptoSelector {
  const defaultOption = {
    value: defaultToken,
    label: defaultToken,
  };

  const selectOptions = Object.values(TOKENS_BY_MODE[mode]).map((token) => ({
    value: token,
    label: token,
  }));

  return {
    kind: 'select',
    cryptoOptions: selectOptions,
    defaultValue: defaultOption,
    onCryptoChange: () => {},
  };
}
