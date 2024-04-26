import { BigNumber } from 'ethers';
import { ZERO } from 'utils/bigNumber';
import { INITIAL_STATE } from './constants';
import { SwapMode, SwapReducerAction, SwapReducerState } from './types';
import { buildSelectConfig, buildValueConfig } from './utils';

export function swapReducer(
  state: SwapReducerState,
  action: SwapReducerAction
): SwapReducerState {
  switch (action.type) {
    case 'changeMode': {
      return action.value === SwapMode.Buy
        ? {
            ...state,
            mode: SwapMode.Buy,
            inputValue: INITIAL_STATE.inputValue,
            inputToken: state.outputToken,
            outputToken: state.inputToken,
            inputConfig: buildSelectConfig(SwapMode.Buy),
            outputConfig: buildValueConfig(state.inputToken),
            quote: null,
          }
        : {
            ...state,
            mode: SwapMode.Sell,
            inputValue: INITIAL_STATE.inputValue,
            inputToken: state.outputToken,
            outputToken: state.inputToken,
            inputConfig: buildValueConfig(state.outputToken),
            outputConfig: buildSelectConfig(SwapMode.Sell),
            quote: null,
          };
    }

    case 'changeInputToken':
      return {
        ...state,
        inputValue: INITIAL_STATE.inputValue,
        inputToken: action.value.token,
        inputTokenBalance: action.value.balance,
        quote: null,
      };

    case 'changeTokenBalances':
      return {
        ...state,
        inputTokenBalance: action.value.input,
        outputTokenBalance: action.value.output,
      };

    case 'changeOutputToken':
      return {
        ...state,
        outputToken: action.value.token,
        outputTokenBalance: action.value.balance,
        quote: null,
      };

    case 'changeInputValue':
      return { ...state, inputValue: action.value };

    case 'changeQuoteValue':
      return { ...state, quote: action.value };

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
        quote: INITIAL_STATE.quote,
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
