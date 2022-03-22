import React, { useReducer, useCallback } from 'react';
import styled from 'styled-components';
import { Input, CryptoValue, CryptoSelector } from 'components/Input/Input';
import { Tabs } from 'components/Tabs/Tabs';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import arrow from 'assets/icons/amm-arrow.svg';

type SwapMode = 'BUY' | 'SELL';

type SwapReducerAction =
  | { type: 'changeMode'; value: SwapMode }
  | { type: 'changeInputToken'; value: TICKER_SYMBOL }
  | { type: 'changeInputValue'; value: number }
  | { type: 'changeQuoteValue'; value: number }
  | { type: 'changeSlippageValue'; value: number }
  | { type: 'changeTxState'; value: boolean }
  | { type: 'slippageTooLow' };

interface SwapReducerState {
  mode: SwapMode;
  ongoingTx: boolean;
  slippageTooLow: boolean;
  zap: boolean;
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
  slippageTooLow: false,
  zap: false,
  inputToken: TICKER_SYMBOL.STABLE_TOKEN,
  outputToken: TICKER_SYMBOL.TEMPLE_TOKEN,
  inputValue: 0,
  quoteValue: 0,
  slippageValue: 1,
  inputConfig: buildInputConfig(TICKER_SYMBOL.STABLE_TOKEN),
  outputConfig: buildOutputConfig(TICKER_SYMBOL.TEMPLE_TOKEN),
};

export const Swap = () => {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const handleSelectChange = useCallback(
    (event) => {
      dispatch({ type: 'changeInputToken', value: event.value });
    },
    [dispatch]
  );

  //const handleInputChange =

  const Swap = (
    <SwapContainer>
      <Input
        crypto={{ ...state.inputConfig, onCryptoChange: handleSelectChange }}
        value={1000}
        hint="Balance: 10000"
      />
      <Spacer />
      <Input crypto={state.outputConfig} disabled value={650} />
      <InvertButton /* TODO: ongoing TX must disable this*/ />
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

function handleSelectChange(
  event: any,
  dispatch: React.Dispatch<SwapReducerAction>
) {}

function reducer(
  state: SwapReducerState,
  action: SwapReducerAction
): SwapReducerState {
  switch (action.type) {
    case 'changeMode': {
      return action.value === 'BUY'
        ? INITIAL_STATE
        : {
            ...INITIAL_STATE,
            mode: 'SELL',
            inputToken: INITIAL_STATE.outputToken,
            outputToken: INITIAL_STATE.inputToken,
            inputConfig: buildInputConfig(INITIAL_STATE.outputToken),
            outputConfig: buildOutputConfig(INITIAL_STATE.inputToken),
          };
    }

    case 'changeTxState':
      return { ...state, ongoingTx: action.value };

    case 'slippageTooLow':
      return { ...state, slippageTooLow: true };

    case 'changeInputToken':
      return {
        ...state,
        inputToken: action.value,
        inputValue: INITIAL_STATE.inputValue,
        quoteValue: INITIAL_STATE.quoteValue,
        slippageValue: INITIAL_STATE.slippageValue,
      };

    case 'changeInputValue':
      //TODO: async update quote value
      return { ...state, inputValue: action.value };

    case 'changeQuoteValue':
      return { ...state, quoteValue: action.value };

    case 'changeSlippageValue':
      return {
        ...state,
        slippageValue: action.value,
        slippageTooLow:
          action.value > state.slippageValue ? false : state.slippageTooLow,
      };

    default:
      console.error('Invalid reducer action: ', action);
      return state;
  }
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
    onCryptoChange: () => {},
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
