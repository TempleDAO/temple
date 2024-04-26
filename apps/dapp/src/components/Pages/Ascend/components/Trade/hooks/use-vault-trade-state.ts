import { useCallback, useEffect, useReducer, useRef } from 'react';

import { Pool } from 'components/Layouts/Ascend/types';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { Nullable } from 'types/util';
import { useNotification } from 'providers/NotificationProvider';

import { useVaultContract } from './use-vault-contract';
import { getSwapLimit, getSwapDeadline } from '../utils';
import { useAuctionContext } from '../../AuctionContext';
import { getBalancerErrorMessage } from 'utils/balancer';
import env from 'constants/env';

type Action<A extends ActionType, P> = { type: A; payload: P };

enum ActionType {
  SetSellValue,
  SetTransactionSettings,
  ResetQuoteState,
  UpdateSwapState,

  SetSwapQuoteRequest,
  SetSwapQuoteStart,
  SetSwapQuoteError,
  SetSwapQuoteSuccess,
}

type TokenValue = { token: string; value: DecimalBigNumber };

type Actions =
  | Action<ActionType.SetSellValue, string>
  | Action<ActionType.SetSwapQuoteRequest, TokenValue>
  | Action<ActionType.SetSwapQuoteStart, TokenValue>
  | Action<
      ActionType.SetSwapQuoteSuccess,
      TokenValue & { quote: DecimalBigNumber }
    >
  | Action<ActionType.SetSwapQuoteError, TokenValue & { error: string }>
  | Action<ActionType.SetTransactionSettings, TradeState['transactionSettings']>
  | Action<ActionType.ResetQuoteState, null>
  | Action<ActionType.UpdateSwapState, { isLoading: boolean; error: string }>;

interface TradeState {
  inputValue: string;
  quote: {
    isLoading: boolean;
    request: Nullable<{ token: string; value: DecimalBigNumber }>;
    estimate: Nullable<DecimalBigNumber>;
    estimateWithSlippage: Nullable<DecimalBigNumber>;
    error: Nullable<string>;
  };
  swap: {
    error: Nullable<string>;
    isLoading: boolean;
  };
  transactionSettings: {
    slippageTolerance: number;
    deadlineMinutes: number;
  };
}

const shouldUpdateQuoteState = (
  state: TradeState,
  actionPayload: TokenValue
) => {
  const { value: incomingDbnValue, token: incomingToken } = actionPayload;
  const { request: currentRequest } = state.quote;
  // Safe guard against race conditions for wrong query
  // There is a request pending for another token
  if (currentRequest?.token !== incomingToken) {
    return false;
  }
  // values should match as well
  if (
    currentRequest.value &&
    !incomingDbnValue.value.eq(currentRequest.value.value)
  ) {
    return false;
  }

  return true;
};

const reducer = (state: TradeState, action: Actions): TradeState => {
  switch (action.type) {
    case ActionType.SetSellValue: {
      return {
        ...state,
        inputValue: action.payload,
      };
    }
    case ActionType.UpdateSwapState: {
      return {
        ...state,
        swap: {
          ...action.payload,
        },
      };
    }
    case ActionType.ResetQuoteState: {
      return {
        ...state,
        inputValue: '',
        quote: {
          ...INITIAL_QUOTE_STATE,
        },
      };
    }
    case ActionType.SetSwapQuoteRequest: {
      const { token, value } = action.payload;
      return {
        ...state,
        quote: {
          ...state.quote,
          request: { token, value },
          isLoading: false,
          estimate: null,
          estimateWithSlippage: null,
          error: null,
        },
      };
    }
    case ActionType.SetSwapQuoteStart: {
      const shouldUpdate = shouldUpdateQuoteState(state, action.payload);
      if (!shouldUpdate) {
        return state;
      }
      return {
        ...state,
        quote: {
          ...state.quote,
          isLoading: true,
        },
      };
    }
    case ActionType.SetSwapQuoteSuccess: {
      const shouldUpdate = shouldUpdateQuoteState(state, action.payload);
      if (!shouldUpdate) {
        return state;
      }
      return {
        ...state,
        quote: {
          ...state.quote,
          isLoading: false,
          estimate: action.payload.quote,
          estimateWithSlippage: getSwapLimit(
            action.payload.quote,
            state.transactionSettings.slippageTolerance
          ),
          error: null,
        },
      };
    }
    case ActionType.SetSwapQuoteError: {
      const shouldUpdate = shouldUpdateQuoteState(state, action.payload);
      if (!shouldUpdate) {
        return state;
      }
      return {
        ...state,
        quote: {
          ...state.quote,
          isLoading: false,
          estimate: null,
          estimateWithSlippage: null,
          error: action.payload.error,
        },
      };
    }
    case ActionType.SetTransactionSettings: {
      return {
        ...state,
        quote: {
          ...state.quote,
          estimateWithSlippage: getSwapLimit(
            state.quote.estimate,
            action.payload.slippageTolerance
          ),
        },
        transactionSettings: {
          ...action.payload,
        },
      };
    }
    default: {
      return state;
    }
  }
};

const INITIAL_QUOTE_STATE = {
  isLoading: false,
  request: null,
  estimate: null,
  estimateWithSlippage: null,
  error: null,
};

export type VaultTradeSuccessCallback = (
  tokenSold: string,
  tokenBought: string,
  amount: string,
  poolId: string
) => Promise<void>;

export const useVaultTradeState = (
  pool: Pool,
  onSuccess?: VaultTradeSuccessCallback
) => {
  const {
    swapState: { sell, buy },
    vaultAddress,
    refetchPoolTokenBalances,
  } = useAuctionContext();
  const vaultContract = useVaultContract(pool, vaultAddress as any);
  const { openNotification } = useNotification();

  const [state, dispatch] = useReducer(reducer, {
    inputValue: '',
    quote: {
      ...INITIAL_QUOTE_STATE,
    },
    swap: {
      error: '',
      isLoading: false,
    },
    transactionSettings: {
      slippageTolerance: 1,
      deadlineMinutes: 5,
    },
  });

  const intervalRef = useRef<number>();

  const maybeClearInterval = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, [intervalRef]);

  useEffect(() => {
    // Cleanup interval when user leaves ascend
    return () => {
      maybeClearInterval();
    };
  }, [maybeClearInterval]);

  const sellTokenAddress = sell.address;
  useEffect(() => {
    // Clear Quote/Input value when pair changes
    dispatch({ type: ActionType.ResetQuoteState, payload: null });
    // Clear any interval
    maybeClearInterval();
  }, [sellTokenAddress, dispatch, maybeClearInterval]);

  const getSwapQuote = async (value: DecimalBigNumber) => {
    maybeClearInterval();

    if (value.isZero()) {
      dispatch({ type: ActionType.ResetQuoteState, payload: null });
      return;
    }

    const token = sell.address;
    dispatch({
      type: ActionType.SetSwapQuoteRequest,
      payload: { value, token } as any,
    });

    const fetchQuote = async () => {
      dispatch({
        type: ActionType.SetSwapQuoteStart,
        payload: { value, token } as any,
      });

      try {
        const quotes = await vaultContract.getSwapQuote.request(
          value,
          token as any,
          buy.address as any
        );
        const quote = DecimalBigNumber.fromBN(
          quotes[buy.tokenIndex].abs(),
          value.getDecimals()
        );

        dispatch({
          type: ActionType.SetSwapQuoteSuccess,
          payload: { quote, token, value } as any,
        });
      } catch (err) {
        console.error('Error fetching swap quote', err);
        const error = getBalancerErrorMessage((err as Error).message || '');
        dispatch({
          type: ActionType.SetSwapQuoteError,
          payload: { error, token, value } as any,
        });
      }
    };

    // Fetch quote and begin polling
    fetchQuote();
    intervalRef.current = window.setInterval(
      fetchQuote,
      env.intervals.ascendQuote
    );
  };

  const swap = async () => {
    const { inputValue } = state;

    if (!inputValue) {
      console.error('A sell amount is required');
      return;
    }

    dispatch({
      type: ActionType.UpdateSwapState,
      payload: { isLoading: true, error: '' },
    });

    try {
      const amount = DecimalBigNumber.parseUnits(inputValue, sell.decimals);
      const deadline = getSwapDeadline(
        state.transactionSettings.deadlineMinutes
      );
      const transaction = await vaultContract.swap(
        amount,
        sell.address as any,
        buy.address as any,
        state.quote.estimateWithSlippage!.value,
        deadline
      );

      await transaction.wait();

      dispatch({
        type: ActionType.UpdateSwapState,
        payload: { isLoading: false, error: '' },
      });
      dispatch({ type: ActionType.ResetQuoteState, payload: null });

      openNotification({
        title: 'Swap success',
        hash: transaction.hash,
      });

      refetchPoolTokenBalances();

      if (onSuccess) {
        await onSuccess(sell.symbol, buy.symbol, inputValue, pool.id);
      }
    } catch (err) {
      const error = getBalancerErrorMessage((err as Error).message);
      dispatch({
        type: ActionType.UpdateSwapState,
        payload: { isLoading: false, error },
      });
    }
  };

  return {
    state,
    swap,
    setSellValue: async (value: string) => {
      dispatch({ type: ActionType.SetSellValue, payload: value });

      if (value.trim() === '.') {
        return;
      }

      const dbn = DecimalBigNumber.parseUnits(value || '0', sell.decimals);
      getSwapQuote(dbn);
    },
    setTransactionSettings: (settings: TradeState['transactionSettings']) => {
      dispatch({ type: ActionType.SetTransactionSettings, payload: settings });
    },
  };
};
