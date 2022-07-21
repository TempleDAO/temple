import { useEffect, useReducer } from 'react';
import { BigNumber } from 'ethers';

import { Pool } from 'components/Layouts/Ascend/types';
import { ZERO } from 'utils/bigNumber';
import { getBigNumberFromString } from 'components/Vault/utils';
import { Nullable } from 'types/util';
import { useNotification } from 'providers/NotificationProvider';

import { useVaultContract } from './use-vault-contract';
import { getSwapLimit, getSwapDeadline } from '../utils';
import { useAuctionContext } from '../../AuctionContext';

type Action<A extends ActionType, P extends any> = { type: A, payload: P };

enum ActionType {
  SetSellValue,
  SetSwapQuote,
  SetSwapQuoteLoading,
  SetTransactionSettings,
  ResetQuoteState,
  UpdateSwapState,
};

type Actions = 
  Action<ActionType.SetSellValue, string> |
  Action<ActionType.SetSwapQuote, Nullable<BigNumber>> |
  Action<ActionType.SetSwapQuoteLoading, boolean> |
  Action<ActionType.SetTransactionSettings, TradeState['transactionSettings']> |
  Action<ActionType.ResetQuoteState, null> |
  Action<ActionType.UpdateSwapState, { isLoading: boolean; error: string }>;

interface TradeState {
  inputValue: string;
  quote: {
    loading: boolean;
    estimate: Nullable<BigNumber>;
    estimateWithSlippage: Nullable<BigNumber>;
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
          loading: false,
          estimate: null,
          estimateWithSlippage: null,
        },
      };
    }
    case ActionType.SetSwapQuote: {
      return {
        ...state,
        quote: {
          ...state.quote,
          estimate: action.payload,
          estimateWithSlippage: getSwapLimit(action.payload, state.transactionSettings.slippageTolerance),
        },
      };
    }
    case ActionType.SetSwapQuoteLoading: {
      return {
        ...state,
        quote: {
          ...state.quote,
          loading: action.payload,
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

export const useVaultTradeState = (pool: Pool) => {
  const { sellToken, buyToken, vaultAddress } = useAuctionContext();
  const vaultContract = useVaultContract(pool, vaultAddress);
  const { openNotification } = useNotification();

  const [state, dispatch] = useReducer(reducer, {
    inputValue: '',
    quote: {
      loading: false,
      estimate: null,
      estimateWithSlippage: null,
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

  const sellTokenAddress = sellToken.address
  useEffect(() => {
    // Clear Quote/Input value when pair changes
    dispatch({ type: ActionType.ResetQuoteState, payload: null });
  }, [sellTokenAddress, dispatch]);

  const updateSwapQuote = async (amount: BigNumber) => {
    if (amount.eq(ZERO)) {
      dispatch({
        type: ActionType.SetSwapQuote,
        payload: null,
      });
      return;
    }

    dispatch({ type: ActionType.SetSwapQuoteLoading, payload: true });

    try {
      const quotes = await vaultContract.getSwapQuote(amount, sellToken.address, buyToken.address);
      const quote = quotes[buyToken.tokenIndex].abs();
     
      dispatch({
        type: ActionType.SetSwapQuote,
        payload: quote,
      });
    } catch (err) {
      console.error('Error fetching swap quote', err)
    } finally {
      dispatch({ type: ActionType.SetSwapQuoteLoading, payload: false });
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
      const amount = getBigNumberFromString(inputValue);
      const deadline = getSwapDeadline(state.transactionSettings.deadlineMinutes);
      const transaction = await vaultContract.swap(
        amount,
        sellToken.address,
        buyToken.address,
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
      dispatch({ type: ActionType.UpdateSwapState, payload: { isLoading: false, error: (err as Error).message } });
    }
  };

  return {
    state,
    swap,
    setSellValue: async (value: string) => {
      dispatch({ type: ActionType.SetSellValue, payload: value });
      const amount = getBigNumberFromString(value);
      updateSwapQuote(amount);
    },
    setTransactionSettings: (settings: TradeState['transactionSettings']) => {
      dispatch({ type: ActionType.SetTransactionSettings, payload: settings });
    },
  };
};
