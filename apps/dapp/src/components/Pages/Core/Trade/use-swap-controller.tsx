import { useEffect, useReducer } from 'react';
import { BigNumber, ethers } from 'ethers';

import { Option } from 'components/InputSelect/InputSelect';
import { TransactionSettings } from 'components/TransactionSettingsModal/TransactionSettingsModal';

import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { FRAX_SELL_DISABLED_IV_MULTIPLE } from 'providers/env';

import { fromAtto, toAtto } from 'utils/bigNumber';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import { TOKENS_BY_MODE } from './constants';
import { SwapReducerAction, SwapReducerState, SwapMode } from './types';
import { buildSelectConfig, buildValueConfig, createButtonLabel, isPairToken } from './utils';

const INITIAL_STATE: SwapReducerState = {
  mode: SwapMode.Buy,
  inputToken: TICKER_SYMBOL.FRAX,
  outputToken: TICKER_SYMBOL.TEMPLE_TOKEN,
  inputValue: '',
  quoteValue: 0,
  inputTokenBalance: 0,
  outputTokenBalance: 0,
  slippageTolerance: 1,
  deadlineMinutes: 20,
  inputConfig: buildSelectConfig(TICKER_SYMBOL.FRAX, SwapMode.Buy),
  outputConfig: buildValueConfig(TICKER_SYMBOL.TEMPLE_TOKEN),
  buttonLabel: createButtonLabel(TICKER_SYMBOL.FRAX, TICKER_SYMBOL.TEMPLE_TOKEN, SwapMode.Buy),
  isTransactionPending: false,
  isSlippageTooHigh: false,
  isFraxSellDisabled: true,
};

export function useSwapController() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { balance, updateBalance } = useWallet();
  const { getBuyQuote, getSellQuote, templePrice, updateTemplePrice, buy, sell, iv, updateIv } = useSwap();

  useEffect(() => {
    const onMount = async () => {
      await updateBalance();
      await updateTemplePrice();
      await updateIv();

      if (templePrice > iv * FRAX_SELL_DISABLED_IV_MULTIPLE) {
        dispatch({
          type: 'enableFraxSell',
          fraxBalance: balance.frax,
        });
      }
    };
    onMount();
  }, []);

  useEffect(() => {
    dispatch({
      type: 'changeInputTokenBalance',
      value: getTokenBalance(state.inputToken),
    });
    dispatch({
      type: 'changeOutputTokenBalance',
      value: getTokenBalance(state.outputToken),
    });
  }, [state.mode, balance]);

  // Handles selection of a new value in the select dropdown
  const handleSelectChange = (event: Option) => {
    const token = Object.values(TOKENS_BY_MODE[state.mode]).find((token) => token === event.value);

    if (!token) {
      throw new Error('Invalid token selected');
    }

    if (state.mode === SwapMode.Sell) {
      dispatch({
        type: 'changeOutputToken',
        value: { token, balance: getTokenBalance(token) },
      });
    }

    if (state.mode === SwapMode.Buy) {
      dispatch({
        type: 'changeInputToken',
        value: { token, balance: getTokenBalance(token) },
      });
    }

    if (isPairToken(token)) {
      updateTemplePrice(token);
    }
  };

  // Handles user input
  const handleInputChange = async (value: string) => {
    const numericValue = Number(value);
    dispatch({ type: 'changeInputValue', value: numericValue === 0 ? '' : value });
    if (!value) {
      dispatch({ type: 'changeQuoteValue', value: 0 });
    } else {
      const quote = await fetchQuote(numericValue);
      dispatch({ type: 'changeQuoteValue', value: quote });
    }
  };

  // Handles swapping between buy and sell
  const handleChangeMode = () => {
    if (state.inputToken !== TICKER_SYMBOL.FRAX && state.outputToken !== TICKER_SYMBOL.FRAX) {
      updateTemplePrice(TICKER_SYMBOL.FRAX);
    }

    dispatch({
      type: 'changeMode',
      value: state.mode === SwapMode.Buy ? SwapMode.Sell : SwapMode.Buy,
    });
  };

  const handleHintClick = () => {
    handleInputChange(`${state.inputTokenBalance}`);
  };

  // Handles user input of slippage tolerance and deadline
  const handleTxSettingsUpdate = (settings: TransactionSettings) => {
    dispatch({
      type: 'changeTxSettings',
      value: settings,
    });
  };

  const handleTransaction = async () => {
    dispatch({
      type: 'startTx',
    });
    if (state.mode === SwapMode.Buy) {
      await handleBuy();
    }

    if (state.mode === SwapMode.Sell) {
      await handleSell();
    }

    await updateBalance();
    await updateTemplePrice();

    dispatch({
      type: 'endTx',
    });
  };

  const handleBuy = async () => {
    if (!isPairToken(state.inputToken)) {
      console.error('Invalid input token');
      return;
    } else {
      const tokenAmount = Number(state.inputValue);

      const buyQuote = await getBuyQuote(toAtto(tokenAmount), state.inputToken);

      if (!tokenAmount || !buyQuote) {
        return;
      }

      const minAmountOut = (tokenAmount / templePrice) * (1 - state.slippageTolerance / 100);

      if (minAmountOut > fromAtto(buyQuote)) {
        dispatch({
          type: 'slippageTooHigh',
        });
        return;
      }

      await buy(toAtto(tokenAmount), toAtto(minAmountOut), state.inputToken, state.deadlineMinutes);
    }
  };

  const handleSell = async () => {
    if (!isPairToken(state.inputToken)) {
      console.error('Invalid input token');
    } else {
      const templeAmount = Number(state.inputValue);
      const sellQuote = await getSellQuote(toAtto(templeAmount));

      if (!templeAmount || !sellQuote) {
        return;
      }

      const minAmountOut = templeAmount * templePrice * (1 - state.slippageTolerance / 100);

      if (minAmountOut > fromAtto(sellQuote.amountOut)) {
        dispatch({
          type: 'slippageTooHigh',
        });
        return;
      }

      await sell(
        toAtto(templeAmount),
        toAtto(minAmountOut),
        state.inputToken,
        sellQuote.priceBelowIV,
        state.deadlineMinutes
      );
    }
  };

  const getTokenBalance = (token: TICKER_SYMBOL): number => {
    switch (token) {
      case TICKER_SYMBOL.FRAX:
        return balance.frax;
      case TICKER_SYMBOL.FEI:
        return balance.fei;
      case TICKER_SYMBOL.TEMPLE_TOKEN:
        return balance.temple;
      default:
        return 0;
    }
  };

  const fetchQuote = async (value = 0): Promise<number> => {
    let quote: BigNumber | void = toAtto(value);

    if (state.mode === SwapMode.Buy && isPairToken(state.inputToken)) {
      quote = await getBuyQuote(toAtto(value), state.inputToken);
    }

    if (state.mode === SwapMode.Sell && isPairToken(state.outputToken)) {
      const sellQuote = await getSellQuote(toAtto(value), state.outputToken);

      quote = sellQuote && sellQuote.amountOut;

      if (sellQuote) {
        if (!state.isFraxSellDisabled && sellQuote.priceBelowIV) {
          dispatch({
            type: 'disableFraxSell',
            feiBalance: balance.fei,
          });
        }

        if (state.isFraxSellDisabled && !sellQuote.priceBelowIV) {
          dispatch({
            type: 'enableFraxSell',
            fraxBalance: balance.frax,
          });
        }
      }
    }

    // zap quote

    if (!quote) {
      console.error("couldn't fetch quote");
      return 0;
    }

    return fromAtto(quote);
  };

  return {
    state,
    handleSelectChange,
    handleInputChange,
    handleChangeMode,
    handleHintClick,
    handleTxSettingsUpdate,
    handleTransaction,
  };
}

function reducer(state: SwapReducerState, action: SwapReducerAction): SwapReducerState {
  switch (action.type) {
    case 'changeMode': {
      return action.value === SwapMode.Buy
        ? {
            ...INITIAL_STATE,
            isFraxSellDisabled: state.isFraxSellDisabled,
          }
        : {
            ...INITIAL_STATE,
            mode: SwapMode.Sell,
            inputToken: INITIAL_STATE.outputToken,
            outputToken: state.isFraxSellDisabled ? TICKER_SYMBOL.FEI : INITIAL_STATE.inputToken,
            inputConfig: buildValueConfig(INITIAL_STATE.outputToken),
            outputConfig: buildSelectConfig(INITIAL_STATE.inputToken, SwapMode.Sell, state.isFraxSellDisabled),
            buttonLabel: createButtonLabel(
              INITIAL_STATE.outputToken,
              state.isFraxSellDisabled ? TICKER_SYMBOL.FEI : INITIAL_STATE.inputToken,
              SwapMode.Sell
            ),
            isFraxSellDisabled: state.isFraxSellDisabled,
          };
    }

    case 'changeInputToken':
      return {
        ...state,
        inputToken: action.value.token,
        inputValue: INITIAL_STATE.inputValue,
        inputTokenBalance: action.value.balance,
        quoteValue: INITIAL_STATE.quoteValue,
        buttonLabel: createButtonLabel(action.value.token, state.outputToken, state.mode),
      };

    case 'changeInputTokenBalance':
      return {
        ...state,
        inputTokenBalance: action.value,
      };

    case 'changeOutputToken':
      return {
        ...state,
        inputValue: INITIAL_STATE.inputValue,
        outputToken: action.value.token,
        outputTokenBalance: action.value.balance,
        quoteValue: INITIAL_STATE.quoteValue,
        buttonLabel: createButtonLabel(state.inputToken, action.value.token, state.mode),
      };

    case 'changeOutputTokenBalance':
      return {
        ...state,
        outputTokenBalance: action.value,
      };

    case 'changeInputValue':
      return { ...state, inputValue: action.value };

    case 'changeQuoteValue':
      return { ...state, quoteValue: action.value };

    case 'changeTxSettings':
      return {
        ...state,
        isSlippageTooHigh: false,
        slippageTolerance: action.value.slippageTolerance,
        deadlineMinutes: action.value.deadlineMinutes,
        buttonLabel: createButtonLabel(state.inputToken, state.outputToken, state.mode),
      };
    case 'startTx':
      return {
        ...state,
        isTransactionPending: true,
      };

    case 'endTx':
      return {
        ...state,
        inputValue: state.isSlippageTooHigh ? state.inputValue : INITIAL_STATE.inputValue,
        quoteValue: state.isSlippageTooHigh ? state.quoteValue : INITIAL_STATE.quoteValue,
        isTransactionPending: false,
      };

    case 'slippageTooHigh':
      return {
        ...state,
        isSlippageTooHigh: true,
        buttonLabel: 'INCREASE SLIPPAGE TOLERANCE',
      };

    case 'disableFraxSell':
      return {
        ...state,
        isFraxSellDisabled: true,
        outputConfig: buildSelectConfig(INITIAL_STATE.inputToken, SwapMode.Sell, true),
        outputToken: TICKER_SYMBOL.FEI,
        outputTokenBalance: action.feiBalance,
        buttonLabel:
          state.mode === SwapMode.Sell
            ? createButtonLabel(state.inputToken, TICKER_SYMBOL.FEI, state.mode)
            : state.buttonLabel,
      };

    case 'enableFraxSell':
      return {
        ...state,
        isFraxSellDisabled: false,
        outputToken: state.mode === SwapMode.Sell ? INITIAL_STATE.inputToken : state.outputToken,
        outputTokenBalance: state.mode === SwapMode.Sell ? action.fraxBalance : state.outputTokenBalance,
        outputConfig:
          state.mode === SwapMode.Sell
            ? buildSelectConfig(INITIAL_STATE.inputToken, state.mode, false)
            : state.outputConfig,
        buttonLabel:
          state.mode === SwapMode.Sell
            ? createButtonLabel(state.inputToken, INITIAL_STATE.inputToken, state.mode)
            : state.buttonLabel,
      };

    default:
      console.error('Invalid reducer action: ', action);
      return state;
  }
}
