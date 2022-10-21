import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import { INITIAL_STATE } from './constants';
import { SwapMode, SwapReducerAction, SwapReducerState } from './types';
import { buildSelectConfig, buildValueConfig, createButtonLabel } from './utils';

export function swapReducer(state: SwapReducerState, action: SwapReducerAction): SwapReducerState {
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
