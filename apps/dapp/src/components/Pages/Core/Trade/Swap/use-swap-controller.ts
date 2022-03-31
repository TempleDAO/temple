import { useReducer, useEffect, useCallback } from 'react';
import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { useZap } from 'providers/ZapProvider';
import { Network } from 'enums/network';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { SwapReducerState, SwapReducerAction } from './types';
import { buildInputConfig, buildOutputConfig } from './utils';

const INITIAL_STATE: SwapReducerState = {
  forceRefreshNonce: 0,
  mode: 'BUY',
  ongoingTx: false,
  slippageTooHigh: false,
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

export default function useSwapController() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const {
    balance,
    updateBalance,
    zapperBalances,
    updateZapperBalances,
    getZapperToken,
  } = useWallet();

  const {
    getSellQuote,
    getBuyQuote,
    templePrice,
    updateTemplePrice,
    iv,
    sell,
    buy,
  } = useSwap();

  const { zapIn, getZapQuote } = useZap();

  useEffect(() => {
    async function onMount() {
      await updateBalance();
      await updateZapperBalances();
      await updateTemplePrice();
    }

    onMount();
  }, []);

  useEffect(() => {
    dispatch({
      type: 'changeInputTokenBalance',
      value: getTokenBalance(state.inputToken),
    });
  }, [balance, zapperBalances, state.mode]);

  // Handles selection of a new value in the select dropdown
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

  //TODO: can probably be reduced to a single dispatch
  const handleInputChange = useCallback(
    async (value) => {
      const numericValue = Number(value);
      dispatch({ type: 'changeInputValue', value: Number(numericValue) });
      const quote = await fetchQuote(numericValue);
      dispatch({ type: 'changeQuoteValue', value: quote ?? 0 });
    },
    [dispatch]
  );

  const handleSlippageUpdate = (value: number) => {
    dispatch({ type: 'changeSlippageValue', value });
  };

  // Fired when the Swap/Exchange button is pressed
  const handleTransaction = async () => {
    dispatch({ type: 'startTx' });

    if (state.mode === 'SELL') {
      console.log('selling');
      await handleSell();
    } else if (state.zap) {
      await handleZap();
    } else {
      console.log('buying');
      await handleBuy();
    }

    dispatch({ type: 'endTx' });

    // Refresh balances after tx is done in order to update the UI
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

    // If there is a sell quote and it is below what you'd get selling at IV
    // the sale is directed to the IV Swap contract to prevent the AMM price to dip below IV
    const isIvSwap = !!sellQuote && fromAtto(sellQuote) < templeAmount * iv;

    if (!isIvSwap && minAmountOut > fromAtto(sellQuote)) {
      dispatch({ type: 'slippageTooHigh' });
      return;
    }
    await sell(toAtto(templeAmount), toAtto(minAmountOut), isIvSwap);
  };

  const handleZap = async () => {
    const zapAmount = state.inputValue;
    const zapToken = getZapperToken(state.inputToken, Network.Ethereum);

    if (!zapAmount || !zapToken) {
      return;
    }

    const zapQuote = await getZapQuote(zapToken.price, state.inputValue);

    if (!zapQuote) {
      return;
    }

    const minTempleReceived = zapQuote * (1 - state.slippageValue / 100);

    if (minTempleReceived > zapQuote) {
      dispatch({ type: 'slippageTooHigh' });
      return;
    }

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

    if (minAmountOut > fromAtto(buyQuote)) {
      console.log(minAmountOut, fromAtto(buyQuote));
      dispatch({ type: 'slippageTooHigh' });
      return;
    }

    console.log('buy', toAtto(fraxAmount), toAtto(minAmountOut));

    await buy(toAtto(fraxAmount), toAtto(minAmountOut));
  };

  const fetchQuote = useCallback(
    async (value = 0): Promise<number | void> => {
      if (state.zap) {
        // TODO: double check if these symbols are the same as our tickers
        // alternatively create a map of our own tickers as keys with the zapper symbols as values
        const selectedToken = getZapperToken(
          state.inputToken,
          Network.Ethereum
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

  const handleHintClick = () => {
    dispatch({ type: 'changeInputValue', value: state.inputTokenBalance });
  };

  function getTokenBalance(token: TICKER_SYMBOL): number {
    switch (token) {
      case TICKER_SYMBOL.STABLE_TOKEN:
        return balance.stableCoin;
      case TICKER_SYMBOL.TEMPLE_TOKEN:
        return balance.temple;
      default:
        return getZapperToken(state.inputToken, Network.Ethereum)?.balance ?? 0;
    }
  }

  const handleChangeMode = () =>
    dispatch({
      type: 'changeMode',
      value: state.mode === 'BUY' ? 'SELL' : 'BUY',
    });

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
    handleHintClick,
    handleChangeMode,
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
        ? { ...INITIAL_STATE, forceRefreshNonce: state.forceRefreshNonce + 1 }
        : {
            ...INITIAL_STATE,
            mode: 'SELL',
            inputToken: INITIAL_STATE.outputToken,
            outputToken: INITIAL_STATE.inputToken,
            inputConfig: buildInputConfig(INITIAL_STATE.outputToken),
            outputConfig: buildOutputConfig(INITIAL_STATE.inputToken),
            forceRefreshNonce: state.forceRefreshNonce + 1,
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

    case 'slippageTooHigh':
      return { ...state, slippageTooHigh: true };

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
        slippageTooHigh:
          action.value > state.slippageValue ? false : state.slippageTooHigh,
      };

    default:
      console.error('Invalid reducer action: ', action);
      return state;
  }
}
