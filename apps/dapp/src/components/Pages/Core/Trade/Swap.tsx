import React, { useReducer } from 'react';
import styled from 'styled-components';
import { Input, CryptoValue, CryptoSelector } from 'components/Input/Input';
import { Tabs } from 'components/Tabs/Tabs';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import arrow from 'assets/icons/amm-arrow.svg';

type SwapMode = 'BUY' | 'SELL' | 'ZAP-IN';

type SwapReducerAction =
  | { type: 'changeMode'; value: SwapMode }
  | { type: 'changeInputToken'; value: TICKER_SYMBOL }
  | { type: 'changeInputValue'; value: number }
  | { type: 'startTx' }
  | { type: 'endTx' }
  | { type: 'changeSlippageValue'; value: number }
  | { type: 'slippageTooLow' };

interface SwapReducerState {
  mode: SwapMode;
  ongoingTx: boolean;
  increaseSlippage: boolean;
  inputToken: TICKER_SYMBOL;
  outputToken: TICKER_SYMBOL;
  inputValue: number;
  quoteValue: number;
  slippageValue: number;
  inputConfig: CryptoSelector;
  outputConfig: CryptoValue;
}

const INITIAL_STATE: SwapReducerState = {
  mode: 'BUY',
  ongoingTx: false,
  increaseSlippage: false,
  inputToken: TICKER_SYMBOL.STABLE_TOKEN,
  outputToken: TICKER_SYMBOL.TEMPLE_TOKEN,
  inputValue: 0,
  quoteValue: 0,
  slippageValue: 0.5,
  inputConfig: buildInputConfig(TICKER_SYMBOL.STABLE_TOKEN),
  outputConfig: buildOutputConfig(TICKER_SYMBOL.TEMPLE_TOKEN),
};

export const Swap = () => {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const Swap = (
    <SwapContainer>
      <Input crypto={state.inputConfig} value={1000} hint="Balance: 10000" />
      <Spacer />
      <Input crypto={state.outputConfig} disabled value={650} />
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

function reducer(
  state: SwapReducerState,
  action: SwapReducerAction
): SwapReducerState {
  switch (action.type) {
    case 'startTx':
      return { ...state, ongoingTx: true };
    case 'endTx': {
      //TODO: async refresh user balance
      return { ...state, ongoingTx: false };
    }
  }

  return INITIAL_STATE;
}

function buildInputConfig(defaultToken: TICKER_SYMBOL): CryptoSelector {
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
  };
}

function buildOutputConfig(token: TICKER_SYMBOL): CryptoValue {
  return {
    kind: 'value',
    value: `${token}`,
  };
}

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
