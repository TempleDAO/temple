import React, { useReducer } from 'react';
import styled from 'styled-components';
import { Input, CryptoValue, CryptoSelector } from 'components/Input/Input';
import { Tabs } from 'components/Tabs/Tabs';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import arrow from 'assets/icons/amm-arrow.svg';

type SwapMode = 'BUY' | 'SELL';
interface SwapReducerState {
  mode: SwapMode;
  ongoingTx: boolean;
  inputToken: TICKER_SYMBOL;
  outputToken: TICKER_SYMBOL;
  inputValue: number;
  quoteValue: number;
  inputTokenBalance: number;
  inputConfig: CryptoSelector;
  outputConfig: CryptoValue;
}

export const Swap = () => {
  const defaultOption = {
    value: TICKER_SYMBOL.TEMPLE_TOKEN,
    label: TICKER_SYMBOL.TEMPLE_TOKEN,
  };

  const selectOptions = [
    {
      value: TICKER_SYMBOL.STABLE_TOKEN,
      label: TICKER_SYMBOL.STABLE_TOKEN,
    },
    defaultOption,
  ];

  // buy/zap config
  const buyCryptoConfig: CryptoSelector = {
    kind: 'select',
    cryptoOptions: selectOptions,
    defaultValue: defaultOption,
  };

  const sellCryptoConfig: CryptoValue = {
    kind: 'value',
    value: `${TICKER_SYMBOL.STABLE_TOKEN}`,
  };

  const Swap = (
    <SwapContainer>
      <Input crypto={sellCryptoConfig} value={1000} hint="Balance: 10000" />
      <Spacer />
      <Input crypto={{ kind: 'value', value: '$FRAX' }} disabled value={650} />
      <InvertButton />
    </SwapContainer>
  );

  return (
    <Tabs
      tabs={[
        {
          label: 'Swap',
          content: Swap,
        },
        {
          label: 'Unlock',
          content: <SwapContainer>unlock $temple</SwapContainer>,
        },
      ]}
    />
  );
};

const SwapContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
  min-width: 20rem /*320/16*/;
`;

const InvertButton = styled.button`
  position: absolute;
  height: 2.5rem /* 40/16 */;
  width: 2.5rem /* 40/16 */;
  top: calc(50% - 1.25rem);
  left: calc(50% - 1.25rem);
  border: none;
  cursor: pointer;
  background: url(${arrow});
  background-repeat: no-repeat;
  background-size: cover;
  border-radius: 100%;
`;

const Spacer = styled.div`
  height: 0.625rem /* 10/16 */;
`;
