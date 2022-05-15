import { Option } from 'components/InputSelect/InputSelect';
import { TransactionSettings } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { useEffect, useReducer } from 'react';
import { TOKENS_BY_MODE } from './constants';
import { SwapReducerAction, SwapReducerState, SwapMode } from './types';
import { buildSelectConfig, buildValueConfig, createButtonLabel, isPairToken } from './utils';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { BigNumber, ethers } from 'ethers';

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
};

export function useSwapController() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { balance, updateBalance } = useWallet();
  const { getBuyQuote, getSellQuote, templePrice, updateTemplePrice, buy, sell, iv } = useSwap();

  useEffect(() => {
    const onMount = async () => {
      await updateBalance();
      await updateTemplePrice();
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

    if (state.mode === SwapMode.Buy) {
      dispatch({
        type: 'changeInputToken',
        value: { token, balance: getTokenBalance(token) },
      });
    }

    if (state.mode === SwapMode.Sell) {
      dispatch({
        type: 'changeOutputToken',
        value: { token, balance: getTokenBalance(token) },
      });
    }
  };

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

  const handleChangeMode = () => {
    dispatch({
      type: 'changeMode',
      value: state.mode === SwapMode.Buy ? SwapMode.Sell : SwapMode.Buy,
    });
  };

  const handleHintClick = () => {
    handleInputChange(`${state.inputTokenBalance}`);
  };

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
    console.log('tx starting');
    if (state.mode === SwapMode.Buy) {
      await handleBuy();
    }

    if (state.mode === SwapMode.Sell) {
      await handleSell();
    }

    updateBalance();

    dispatch({
      type: 'endTx',
    });
  };

  const handleBuy = async () => {
    const tokenAmount = Number(state.inputValue);
    const buyQuote = await getBuyQuote(toAtto(tokenAmount));

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

    await buy(toAtto(tokenAmount), toAtto(minAmountOut), state.deadlineMinutes);
  };

  const handleSell = async () => {
    const templeAmount = Number(state.inputValue);
    const sellQuote = await getSellQuote(toAtto(templeAmount));

    if (!templeAmount || !sellQuote) {
      return;
    }

    const minAmountOut = templeAmount * templePrice * (1 - state.slippageTolerance / 100);
    console.log('min amount out = ' + minAmountOut);
    console.log('sell quote = ' + fromAtto(sellQuote));

    // If there is a sell quote and it is below what you'd get selling at IV
    // the sale is directed to the IV Swap contract to prevent the AMM price to dip below IV
    const isIvSwap = !!sellQuote && fromAtto(sellQuote) < templeAmount * iv;

    if (minAmountOut > fromAtto(sellQuote)) {
      dispatch({
        type: 'slippageTooHigh',
      });
      return;
    }

    await sell(toAtto(templeAmount), toAtto(minAmountOut), isIvSwap, state.deadlineMinutes);
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
      quote = await getSellQuote(toAtto(value), state.outputToken);
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
          }
        : {
            ...INITIAL_STATE,
            mode: SwapMode.Sell,
            inputToken: INITIAL_STATE.outputToken,
            outputToken: INITIAL_STATE.inputToken,
            inputConfig: buildValueConfig(INITIAL_STATE.outputToken),
            outputConfig: buildSelectConfig(INITIAL_STATE.inputToken, SwapMode.Sell),
            buttonLabel: createButtonLabel(INITIAL_STATE.outputToken, INITIAL_STATE.inputToken, SwapMode.Sell),
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
        inputToken: action.value.token,
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
        isTransactionPending: false,
      };

    case 'slippageTooHigh':
      return {
        ...state,
        isSlippageTooHigh: true,
        buttonLabel: 'INCREASE SLIPPAGE TOLERANCE',
      };

    default:
      console.error('Invalid reducer action: ', action);
      return state;
  }
}
