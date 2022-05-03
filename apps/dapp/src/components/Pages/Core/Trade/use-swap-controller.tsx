import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useCallback, useReducer } from 'react';
import { TOKENS_BY_MODE } from './constants';
import { SwapReducerAction, SwapReducerState, SwapMode } from './types';
import { buildSelectConfig, buildValueConfig } from './utils';

const INITIAL_STATE: SwapReducerState = {
  mode: SwapMode.BUY,
  inputToken: TICKER_SYMBOL.FRAX,
  outputToken: TICKER_SYMBOL.TEMPLE_TOKEN,
  inputConfig: buildSelectConfig(TICKER_SYMBOL.FRAX, SwapMode.BUY),
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

      switch (state.mode) {
        case SwapMode.BUY: {
          dispatch({
            type: 'changeInputToken',
            value: { token, balance: 0 },
          });
          break;
        }
        case SwapMode.SELL: {
          dispatch({
            type: 'changeOutputToken',
            value: { token },
          });
          break;
        }
        default: {
          throw new Error('Waaaaa');
          break;
        }
      }
    },
    [state]
  );

  const handleChangeMode = () => {
    dispatch({
      type: 'changeMode',
      value: state.mode === SwapMode.BUY ? SwapMode.SELL : SwapMode.BUY,
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
      return action.value === SwapMode.BUY
        ? {
            ...INITIAL_STATE,
          }
        : {
            ...INITIAL_STATE,
            mode: SwapMode.SELL,
            inputToken: INITIAL_STATE.outputToken,
            outputToken: INITIAL_STATE.inputToken,
            inputConfig: buildValueConfig(INITIAL_STATE.outputToken),
            outputConfig: buildSelectConfig(
              INITIAL_STATE.inputToken,
              SwapMode.SELL
            ),
          };
    }

    case 'changeInputToken':
      return {
        ...state,
        inputToken: action.value.token,
      };

    case 'changeOutputToken':
      return {
        ...state,
        outputToken: action.value.token,
      };

    default:
      console.error('Invalid reducer action: ', action);
      return state;
  }
}
