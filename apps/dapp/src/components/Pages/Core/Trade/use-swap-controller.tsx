import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useWallet } from 'providers/WalletProvider';
import { useCallback, useReducer } from 'react';
import { TOKENS_BY_MODE } from './constants';
import { SwapReducerAction, SwapReducerState } from './types';
import { buildSelectConfig, buildValueConfig } from './utils';

const INITIAL_STATE: SwapReducerState = {
  mode: 'BUY',
  ongoingTx: false,
  slippageTooHigh: false,
  zap: false,
  inputToken: TICKER_SYMBOL.FRAX,
  outputToken: TICKER_SYMBOL.TEMPLE_TOKEN,
  inputTokenBalance: 0,
  inputValue: '',
  quoteValue: 0,
  slippageValue: 1,
  inputConfig: buildSelectConfig(TICKER_SYMBOL.FRAX, 'BUY'),
  outputConfig: buildValueConfig(TICKER_SYMBOL.TEMPLE_TOKEN),
};

export function useSwapController() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // Handles selection of a new value in the select dropdown
  const handleSelectChange = useCallback(
    (event) => {
      const token = Object.values(TOKENS_BY_MODE[state.mode]).find(
        (token) => token === event.value
      );

      if (!token) {
        throw new Error('Invalid token selected');
      }

      if (state.mode === 'BUY') {
        dispatch({
          type: 'changeInputToken',
          value: { token, balance: 0 },
        });

        return;
      }

      dispatch({
        type: 'changeOutputToken',
        value: { token },
      });
    },
    [dispatch]
  );

  const handleChangeMode = () => {
    dispatch({
      type: 'changeMode',
      value: state.mode === 'BUY' ? 'SELL' : 'BUY',
    });
  };

  return {
    state,
    handleSelectChange,
    handleChangeMode,
  };
}

function reducer(
  state: SwapReducerState,
  action: SwapReducerAction
): SwapReducerState {
  switch (action.type) {
    case 'changeMode': {
      console.log('changing mode to ' + action.value);
      return action.value === 'BUY'
        ? {
            ...INITIAL_STATE,
          }
        : {
            ...INITIAL_STATE,
            mode: 'SELL',
            inputToken: INITIAL_STATE.outputToken,
            outputToken: INITIAL_STATE.inputToken,
            inputConfig: buildValueConfig(INITIAL_STATE.outputToken),
            outputConfig: buildSelectConfig(INITIAL_STATE.inputToken, 'SELL'),
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
      console.log('changing input token to ' + action.value.token);
      return {
        ...state,
        inputToken: action.value.token,
        inputValue: INITIAL_STATE.inputValue,
        inputTokenBalance: action.value.balance,
        quoteValue: INITIAL_STATE.quoteValue,
        slippageValue: INITIAL_STATE.slippageValue,
        zap: state.mode === 'BUY' && action.value.token !== TICKER_SYMBOL.FRAX,
      };

    case 'changeOutputToken':
      console.log('changing output token to ' + action.value.token);
      return {
        ...state,
        outputToken: action.value.token,
        inputValue: INITIAL_STATE.inputValue,
        quoteValue: INITIAL_STATE.quoteValue,
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
