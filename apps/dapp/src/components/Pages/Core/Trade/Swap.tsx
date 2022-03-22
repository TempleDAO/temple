import React, { useReducer, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { useZap } from 'providers/ZapProvider';
import { Input, CryptoValue, CryptoSelector } from 'components/Input/Input';
import { Tabs } from 'components/Tabs/Tabs';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { fromAtto, toAtto } from 'utils/bigNumber';
import arrow from 'assets/icons/amm-arrow.svg';

type SwapMode = 'BUY' | 'SELL';

type SwapReducerAction =
  | { type: 'changeMode'; value: SwapMode }
  | {
      type: 'changeInputToken';
      value: { token: TICKER_SYMBOL; balance: number };
    }
  | { type: 'changeInputValue'; value: number }
  | { type: 'changeQuoteValue'; value: number }
  | { type: 'changeSlippageValue'; value: number }
  | { type: 'changeInputTokenBalance'; value: number }
  | { type: 'changeTxState'; value: boolean }
  | { type: 'slippageTooLow' };

interface SwapReducerState {
  mode: SwapMode;
  ongoingTx: boolean;
  slippageTooLow: boolean;
  zap: boolean;
  inputToken: TICKER_SYMBOL;
  outputToken: TICKER_SYMBOL;
  inputTokenBalance: number;
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
  inputTokenBalance: 0,
  inputValue: 0,
  quoteValue: 0,
  slippageValue: 1,
  inputConfig: buildInputConfig(TICKER_SYMBOL.STABLE_TOKEN),
  outputConfig: buildOutputConfig(TICKER_SYMBOL.TEMPLE_TOKEN),
};

export const Swap = () => {
  const {
    state,
    updateBalance,
    updateZapperBalances,
    handleInputChange,
    handleSelectChange,
  } = useSwapController();

  useEffect(() => {
    async function onMount() {
      await updateBalance();
      await updateZapperBalances();
    }

    onMount();
  }, []);

  const Swap = (
    <SwapContainer>
      <Input
        crypto={{ ...state.inputConfig, onCryptoChange: handleSelectChange }}
        handleChange={handleInputChange}
        value={state.inputValue}
        hint={`Balance: ${state.inputTokenBalance}`}
      />
      <Spacer />
      <Input crypto={state.outputConfig} disabled value={650} />
      <InvertButton disabled={state.ongoingTx} />
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

function useSwapController() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { balance, updateBalance, zapperBalances, updateZapperBalances } =
    useWallet();
  const { getSellQuote, getBuyQuote } = useSwap();
  const { zapIn, getZapQuote } = useZap();

  useEffect(() => {
    dispatch({
      type: 'changeInputTokenBalance',
      value: getTokenBalance(state.inputToken),
    });
  }, [balance, zapperBalances]);

  const handleSelectChange = useCallback(
    (event) => {
      const token = Object.values(TICKER_SYMBOL).find(
        (token) => token === event.value
      );

      if (!token) {
        throw new Error('Invalid token selected');
      }

      dispatch({
        type: 'changeInputToken',
        value: { token, balance: getTokenBalance(token) },
      });
    },
    [dispatch]
  );

  const handleInputChange = useCallback(
    async (value) => {
      dispatch({ type: 'changeInputValue', value });
      const quote = await fetchQuote(value);
      dispatch({ type: 'changeQuoteValue', value: quote ?? 0 });
    },
    [dispatch]
  );

  const fetchQuote = useCallback(
    async (value: number): Promise<number | void> => {
      if (state.zap) {
        // TODO: double check if these symbols are the same as our tickers
        // alternatively create a map of our own tickers as keys with the zapper symbols as values
        const selectedToken = zapperBalances.find(
          (token) => token.symbol === state.inputToken
        );

        if (!selectedToken) {
          throw new Error(
            `Selected token (${state.inputToken}) does not match any Zapper token symbol`
          );
        }

        return getZapQuote(selectedToken.balance, value);
      }

      const quote = await (state.mode === 'BUY'
        ? getBuyQuote(toAtto(value))
        : getSellQuote(toAtto(value)));

      if (!quote) {
        throw new Error(
          `Unable to get ${state.mode === 'BUY' ? 'buy' : 'sell'} quote for (${
            state.inputToken
          })`
        );
      }

      return fromAtto(quote);
    },
    [getZapQuote, getBuyQuote, getSellQuote]
  );

  function getTokenBalance(token: TICKER_SYMBOL): number {
    switch (token) {
      case TICKER_SYMBOL.STABLE_TOKEN:
        return balance.stableCoin;
      case TICKER_SYMBOL.TEMPLE_TOKEN:
        return balance.temple;
      default:
        return (
          zapperBalances.find((zapperToken) => zapperToken.symbol === token)
            ?.balance ?? 0
        );
    }
  }

  return {
    state,
    balance,
    updateBalance,
    updateZapperBalances,
    handleInputChange,
    handleSelectChange,
    fetchQuote,
  };
}

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
        inputToken: action.value.token,
        inputValue: INITIAL_STATE.inputValue,
        inputTokenBalance: action.value.balance,
        quoteValue: INITIAL_STATE.quoteValue,
        slippageValue: INITIAL_STATE.slippageValue,
        zap:
          state.mode === 'BUY' &&
          action.value.token !== TICKER_SYMBOL.STABLE_TOKEN,
      };

    case 'changeInputValue':
      return { ...state, inputValue: action.value };

    case 'changeQuoteValue':
      return { ...state, quoteValue: action.value };

    case 'changeInputTokenBalance':
      return { ...state, inputTokenBalance: action.value };

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
