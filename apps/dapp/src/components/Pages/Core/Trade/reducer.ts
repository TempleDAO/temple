import { INITIAL_STATE } from './constants';
import { SwapMode, SwapReducerAction, SwapReducerState } from './types';
import { buildSelectConfig, buildValueConfig, createButtonLabel } from './utils';

export function swapReducer(state: SwapReducerState, action: SwapReducerAction): SwapReducerState {
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
    case 'txSuccess':
      return {
        ...state,
        inputValue: INITIAL_STATE.inputValue,
        quoteValue: INITIAL_STATE.quoteValue,
      };

    case 'setError': {
      return {
        ...state,
        error: action.value,
      };
    }

    default:
      console.error('Invalid reducer action: ', action);
      return state;
  }
}
