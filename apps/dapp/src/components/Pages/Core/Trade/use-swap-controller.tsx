import { Option } from 'components/InputSelect/InputSelect';
import { TransactionSettings } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useReducer } from 'react';
import { TOKENS_BY_MODE } from './constants';
import { SwapReducerAction, SwapReducerState, SwapMode } from './types';
import { buildSelectConfig, buildValueConfig, createButtonLabel } from './utils';

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
};

export function useSwapController() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // Handles selection of a new value in the select dropdown
  const handleSelectChange = (event: Option) => {
    const token = Object.values(TOKENS_BY_MODE[state.mode]).find((token) => token === event.value);

    if (!token) {
      throw new Error('Invalid token selected');
    }

    if (state.mode === SwapMode.Buy) {
      dispatch({
        type: 'changeInputToken',
        value: { token, balance: 0 },
      });
    }

    if (state.mode === SwapMode.Sell) {
      dispatch({
        type: 'changeOutputToken',
        value: { token },
      });
    }
  };

  const handleInputChange = (value: string) => {
    const numericValue = Number(value);
    dispatch({ type: 'changeInputValue', value: numericValue === 0 ? '' : value });
    dispatch({ type: 'changeQuoteValue', value: 0 });
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

  return {
    state,
    handleSelectChange,
    handleInputChange,
    handleChangeMode,
    handleHintClick,
    handleTxSettingsUpdate,
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

    case 'changeOutputToken':
      return {
        ...state,
        outputToken: action.value.token,
        buttonLabel: createButtonLabel(state.inputToken, action.value.token, state.mode),
      };

    case 'changeInputValue':
      return { ...state, inputValue: action.value };

    case 'changeQuoteValue':
      return { ...state, quoteValue: action.value };

    case 'changeTxSettings':
      return {
        ...state,
        slippageTolerance: action.value.slippageTolerance,
        deadlineMinutes: action.value.deadlineMinutes,
      };

    default:
      console.error('Invalid reducer action: ', action);
      return state;
  }
}
