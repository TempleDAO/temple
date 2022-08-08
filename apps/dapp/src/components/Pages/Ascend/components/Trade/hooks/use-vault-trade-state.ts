import { useEffect, useReducer } from 'react';
import { BigNumber, FixedNumber } from 'ethers';

import { Pool } from 'components/Layouts/Ascend/types';
import { ZERO } from 'utils/bigNumber';
import { formatBigNumber, getBigNumberFromString } from 'components/Vault/utils';
import { DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';
import { Nullable } from 'types/util';
import { useNotification } from 'providers/NotificationProvider';

import { useVaultContract } from './use-vault-contract';
import { getSwapLimit, getSwapDeadline } from '../utils';
import { useAuctionContext } from '../../AuctionContext';
import { getBalancerErrorMessage } from 'utils/balancer'

type Action<A extends ActionType, P extends any> = { type: A, payload: P };

enum ActionType {
  SetSellValue,
  SetTransactionSettings,
  ResetQuoteState,
  UpdateSwapState,

  SetSwapQuoteStart,
  SetSwapQuoteError,
  SetSwapQuoteSuccess,
};

type TokenValue = { token: string; value: BigNumber };

type Actions = 
  Action<ActionType.SetSellValue, string> |
  Action<ActionType.SetSwapQuoteStart, TokenValue> |
  Action<ActionType.SetSwapQuoteSuccess, TokenValue & { quote: BigNumber }> |
  Action<ActionType.SetSwapQuoteError, TokenValue & { error: string }> |
  Action<ActionType.SetTransactionSettings, TradeState['transactionSettings']> |
  Action<ActionType.ResetQuoteState, null> |
  Action<ActionType.UpdateSwapState, { isLoading: boolean; error: string }>;

interface TradeState {
  inputValue: string;
  quote: {
    isLoading: boolean;
    request: Nullable<{ token: string; value: BigNumber }>;
    estimate: Nullable<BigNumber>;
    estimateWithSlippage: Nullable<BigNumber>;
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

const shouldUpdateQuoteState = (state: TradeState, actionPayload: TokenValue) => {
  const { value, token } = actionPayload;
  // Safe guard against race conditions for wrong query
  // There is a request pending for another token
  if (state.quote.request?.token !== token) {
    return false;
  }
  // values should match as well
  if (state.quote.request.value && !value.eq(state.quote.request.value)) {
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
    case ActionType.SetSwapQuoteStart: {
      const { token, value } = action.payload;
      return {
        ...state,
        quote: {
          ...state.quote,
          request: { token, value },
          isLoading: true,
          estimate: null,
          estimateWithSlippage: null,
          error: null,
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
          estimateWithSlippage: getSwapLimit(action.payload.quote, state.transactionSettings.slippageTolerance),
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
          estimateWithSlippage: getSwapLimit(state.quote.estimate, action.payload.slippageTolerance)
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

export const useVaultTradeState = (pool: Pool) => {
  const { swapState: { sell, buy }, vaultAddress } = useAuctionContext();
  const vaultContract = useVaultContract(pool, vaultAddress);
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

  const sellTokenAddress = sell.address
  useEffect(() => {
    // Clear Quote/Input value when pair changes
    dispatch({ type: ActionType.ResetQuoteState, payload: null });
  }, [sellTokenAddress, dispatch]);

  const getSwapQuote = async (value: BigNumber) => {
    if (value.eq(ZERO)) {
      dispatch({ type: ActionType.ResetQuoteState, payload: null });
      return;
    }

    const token = sell.address;
    dispatch({ type: ActionType.SetSwapQuoteStart, payload: { value, token } });

    try {
      const quotes = await vaultContract.getSwapQuote(value, token, buy.address);
      const quote = quotes[buy.tokenIndex].abs();
     
      dispatch({
        type: ActionType.SetSwapQuoteSuccess,
        payload: { quote, token, value },
      });
    } catch (err) {
      console.error('Error fetching swap quote', err);
      const error = getBalancerErrorMessage((err as Error).message || '');
      dispatch({
        type: ActionType.SetSwapQuoteError,
        payload: { error, token, value },
      });
    }
  };

  const swap = async () => {
    const { inputValue } = state;

    if (!inputValue) {
      console.error('A sell amount is required');
      return;
    }

    dispatch({ type: ActionType.UpdateSwapState, payload: { isLoading: true, error: '' } });

    try {
      const amount = DecimalBigNumber.parseUnits(inputValue, sell.decimals);
      const deadline = getSwapDeadline(state.transactionSettings.deadlineMinutes);
      const transaction = await vaultContract.swap(
        amount,
        sell.address,
        buy.address,
        state.quote.estimateWithSlippage!,
        deadline,
      );

      await transaction.wait();

      dispatch({ type: ActionType.UpdateSwapState, payload: { isLoading: false, error: '' } });
      dispatch({ type: ActionType.ResetQuoteState, payload: null });
      
      openNotification({
        title: 'Swap success',
        hash: transaction.hash,
      });

    } catch (err) {
      const error = getBalancerErrorMessage((err as Error).message);
      dispatch({ type: ActionType.UpdateSwapState, payload: { isLoading: false, error }});
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

      const bn = DecimalBigNumber.parseUnits(value || '0', sell.decimals);
      getSwapQuote(bn.toBN(bn.getDecimals()));
    },
    setTransactionSettings: (settings: TradeState['transactionSettings']) => {
      dispatch({ type: ActionType.SetTransactionSettings, payload: settings });
    },
  };
};
