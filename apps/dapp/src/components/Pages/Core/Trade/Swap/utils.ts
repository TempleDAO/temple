import { CryptoValue, CryptoSelector } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

// See apps/dapp/src/components/Input/Input.tsx
export function buildInputConfig(defaultToken: TICKER_SYMBOL): CryptoSelector {
  const defaultOption = {
    value: defaultToken,
    label: defaultToken,
  };

  const selectOptions = Object.values(TICKER_SYMBOL).map((token) => ({
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

// See apps/dapp/src/components/Input/Input.tsx
export function buildOutputConfig(token: TICKER_SYMBOL): CryptoValue {
  return {
    kind: 'value',
    value: `${token}`,
  };
}
