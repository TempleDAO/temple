import React, { useReducer, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { useZap } from 'providers/ZapProvider';
import { Input, CryptoValue, CryptoSelector } from 'components/Input/Input';
import { Button } from 'components/Button/Button';
import Slippage from 'components/Slippage/Slippage';
import { Tabs } from 'components/Tabs/Tabs';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';
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
  | { type: 'startTx' }
  | { type: 'endTx' }
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
    templePrice,
    updateBalance,
    updateZapperBalances,
    handleInputChange,
    handleSelectChange,
    handleSlippageUpdate,
    handleTransaction,
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
      <Input crypto={state.outputConfig} disabled value={state.quoteValue} />
      <Slippage
        label={`${TICKER_SYMBOL.TEMPLE_TOKEN}: (${formatNumber(templePrice)})`}
        value={state.slippageValue}
        onChange={handleSlippageUpdate}
      />
      <InvertButton disabled={state.ongoingTx} />
      <Button
        label={`Exchange ${state.inputToken} for ${state.outputToken}`}
        onClick={handleTransaction}
        isUppercase
      />
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
  const { getSellQuote, getBuyQuote, templePrice, iv, sell, buy } = useSwap();
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

  const handleSlippageUpdate = (value: number) => {
    dispatch({ type: 'changeSlippageValue', value });
  };

  const handleTransaction = async () => {
    dispatch({ type: 'startTx' });

    if (state.mode === 'SELL') {
      await handleSell();
    } else if (state.zap) {
      await handleZap();
    } else {
      await handleBuy();
    }

    dispatch({ type: 'endTx' });
    await updateBalance();
    await updateZapperBalances();
  };

  const handleSell = async () => {
    const templeAmount = state.inputValue;
    const sellQuote = await getSellQuote(toAtto(templeAmount));

    if (!templeAmount || !sellQuote) {
      return;
    }

    const minAmountOut = templeAmount * templePrice * (1 - templeAmount / 100);

    const isIvSwap = !!sellQuote && fromAtto(sellQuote) < templeAmount * iv;

    if (minAmountOut <= fromAtto(sellQuote) || isIvSwap) {
      await sell(toAtto(templeAmount), toAtto(minAmountOut), isIvSwap);
    }
  };

  const handleZap = async () => {
    const zapAmount = state.inputValue;
    const zapToken = zapperBalances.find(
      (zapperToken) => zapperToken.symbol === state.inputToken
    );

    if (!zapAmount || !zapToken) {
      return;
    }

    const zapQuote = await getZapQuote(zapToken.price, state.inputValue);

    if (!zapQuote) {
      return;
    }

    const minTempleReceived = zapQuote * (1 - state.slippageValue / 100);

    await zapIn(
      zapToken.symbol,
      zapToken.address,
      zapToken.decimals,
      state.inputValue,
      toAtto(minTempleReceived)
    );
  };

  const handleBuy = async () => {
    const fraxAmount = state.inputValue;
    const buyQuote = await getBuyQuote(toAtto(fraxAmount));

    if (!fraxAmount || !buyQuote) {
      return;
    }

    const minAmountOut =
      (fraxAmount / templePrice) * (1 - state.slippageValue / 100);

    if (minAmountOut <= fromAtto(buyQuote)) {
      await buy(toAtto(fraxAmount), toAtto(minAmountOut));
    }
  };

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
    templePrice,
    balance,
    updateBalance,
    updateZapperBalances,
    handleInputChange,
    handleSelectChange,
    handleSlippageUpdate,
    handleTransaction,
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

    case 'startTx':
      return { ...state, ongoingTx: true };

    case 'endTx':
      return {
        ...state,
        ongoingTx: false,
        inputValue: INITIAL_STATE.inputValue,
        quoteValue: INITIAL_STATE.quoteValue,
        slippageValue: INITIAL_STATE.slippageValue,
      };

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
