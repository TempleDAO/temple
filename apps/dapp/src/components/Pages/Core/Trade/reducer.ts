import { INITIAL_STATE } from './constants';
import { SwapMode, SwapReducerAction, SwapReducerState } from './types';
import { buildSelectConfig, buildValueConfig } from './utils';

export function swapReducer(state: SwapReducerState, action: SwapReducerAction): SwapReducerState {
  switch (action.type) {
    case 'changeMode': {
      console.log(state);
      return action.value === SwapMode.Buy
        ? {
            ...INITIAL_STATE,
            inputToken: state.outputToken,
            outputToken: state.inputToken,
            inputConfig: buildSelectConfig(state.outputToken, SwapMode.Buy),
            outputConfig: buildValueConfig(state.inputToken),
          }
        : {
            ...INITIAL_STATE,
            mode: SwapMode.Sell,
            inputToken: state.outputToken,
            outputToken: state.inputToken,
            inputConfig: buildValueConfig(state.outputToken),
            outputConfig: buildSelectConfig(state.inputToken, SwapMode.Sell),
          };
    }

    case 'changeInputToken':
      return {
        ...state,
        inputToken: action.value.token,
        inputValue: state.inputValue,
        inputTokenBalance: action.value.balance,
        quoteValue: state.quoteValue,
      };

    case 'changeInputTokenBalance':
      return {
        ...state,
        inputTokenBalance: action.value,
      };

    case 'changeOutputToken':
      return {
        ...state,
        inputValue: state.inputValue,
        outputToken: action.value.token,
        outputTokenBalance: action.value.balance,
        quoteValue: state.quoteValue,
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
