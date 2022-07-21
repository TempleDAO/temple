import { useReducer } from 'react';
import { BigNumber } from 'ethers';
import { useBalance } from 'wagmi';

import { Pool } from 'components/Layouts/Ascend/types';
import { useWallet } from 'providers/WalletProvider';
import { ZERO } from 'utils/bigNumber';
import { getBigNumberFromString } from 'components/Vault/utils';
import { Nullable } from 'types/util';
import { useNotification } from 'providers/NotificationProvider';

import { useVaultContract } from './use-vault-contract';
import { getSwapLimit, getSwapDeadline } from '../utils';

type Action<A extends ActionType, P extends any> = { type: A, payload: P };

enum ActionType {
  TogglePair,
  SetSellValue,
  SetSwapQuote,
  SetSwapQuoteLoading,
  SetTransactionSettings,
  ResetQuoteState,
  UpdateSwapState,
};

type Actions = 
  Action<ActionType.TogglePair, null> |
  Action<ActionType.SetSellValue, string> |
  Action<ActionType.SetSwapQuote, Nullable<BigNumber>> |
  Action<ActionType.SetSwapQuoteLoading, boolean> |
  Action<ActionType.SetTransactionSettings, TradeState['transactionSettings']> |
  Action<ActionType.ResetQuoteState, null> |
  Action<ActionType.UpdateSwapState, { isLoading: boolean; error: string }>;

interface TradeState {
  sell: {
    name: string;
    weight: BigNumber;
    address: string;
    symbol: string;
    // Input value
    value: string;
  };
  buy: {
    name: string;
    weight: BigNumber;
    address: string;
    symbol: string;
  };
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
        sell: {
          ...state.sell,
          value: action.payload,
        },
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
        sell: {
          ...state.sell,
          value: '',
        },
        quote: {
          loading: false,
          estimate: null,
          estimateWithSlippage: null,
        },
      };
    }
    case ActionType.TogglePair: {
      return {
        ...state,
        sell: {
          ...state.buy,
          value: '',
        },
        buy: {
          ...state.sell,
        },
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
          estimateWithSlippage: getSwapLimit(state.quote.estimateWithSlippage, action.payload.slippageTolerance)
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
  const { wallet } = useWallet();
  const vaultContract = useVaultContract(pool);
  const { openNotification } = useNotification();

  const [main, base] = pool.tokens;
  const [state, dispatch] = useReducer(reducer, {
    sell: {
      name: base.name,
      weight: base.weight,
      address: base.address,
      symbol: base.symbol,
      value: '',
    },
    buy: {
      name: main.name,
      weight: main.weight,
      address: main.address,
      symbol: main.symbol,
    },
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

  const _sellTokenBalance = useBalance({
    addressOrName: (wallet || '').toLowerCase(),
    token: state.sell.address.toLowerCase(),
    enabled: !!wallet,
    watch: true,
  });

  const _buyTokenBalance = useBalance({
    addressOrName: (wallet || '').toLowerCase(),
    token: state.buy.address.toLowerCase(),
    enabled: !!wallet,
    watch: true,
  });

  const sellTokenBalance =
    (_sellTokenBalance.isLoading || _sellTokenBalance.isError || !_sellTokenBalance.data) ?
    ZERO :
    _sellTokenBalance.data.value;
  
  const buyTokenBalance = 
    (_buyTokenBalance.isLoading || _buyTokenBalance.isError || !_buyTokenBalance.data) ?
    ZERO :
    _buyTokenBalance.data.value;

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
      const quotes = await vaultContract.getSwapQuote(amount, state.sell.address, state.buy.address);
      const indexOfBuy = pool.tokensList.findIndex((address) => address === state.buy.address);
      const quote = quotes[indexOfBuy].abs();
     
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
    const { value } = state.sell;

    if (!value) {
      console.error('A sell amount is required');
      return;
    }

    dispatch({ type: ActionType.UpdateSwapState, payload: { isLoading: true, error: '' } });

    try {
      const amount = getBigNumberFromString(value);
      const deadline = getSwapDeadline(state.transactionSettings.deadlineMinutes);
      const transaction = await vaultContract.swap(
        amount,
        state.sell.address,
        state.buy.address,
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
    state: {
      ...state,
      sell: {
        ...state.sell,
        balance: sellTokenBalance,
      },
      buy: {
        ...state.buy,
        balance: buyTokenBalance,
      },
    },
    vaultAddress: vaultContract.address,
    togglePair: () => dispatch({ type: ActionType.TogglePair, payload: null }),
    setSellValue: async (value: string) => {
      dispatch({ type: ActionType.SetSellValue, payload: value });
      
      const amount = getBigNumberFromString(value);
      updateSwapQuote(amount);
    },
    swap,
    setTransactionSettings: (settings: TradeState['transactionSettings']) => {
      dispatch({ type: ActionType.SetTransactionSettings, payload: settings });
    },
  };
}
