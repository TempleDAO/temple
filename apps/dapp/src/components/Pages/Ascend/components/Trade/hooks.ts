import { useEffect, useReducer, useRef } from 'react';
import { BigNumber, Contract } from 'ethers';
import { useBalance, useContractReads } from 'wagmi';

import balancerPoolAbi from 'data/abis/balancerPool.json';
import balancerVaultAbi from 'data/abis/balancerVault.json';
import { formatNumber } from 'utils/formatter';
import { Pool } from 'components/Layouts/Ascend/types';
import { useWallet } from 'providers/WalletProvider';
import { ZERO } from 'utils/bigNumber';
import { getBigNumberFromString, formatBigNumber } from 'components/Vault/utils';
import { Nullable } from 'types/util';
import { getLimitsForSlippage } from './utils';

type Action<A extends ActionType, P extends any> = { type: A, payload: P };

enum ActionType {
  TogglePair,
  SetSellValue,
  SetSwapQuote,
  SetSwapQuoteLoading,
  SetTransactionSettings,
}

type Actions = 
  Action<ActionType.TogglePair, null> |
  Action<ActionType.SetSellValue, string> |
  Action<ActionType.SetSwapQuote, [BigNumber, BigNumber]> |
  Action<ActionType.SetSwapQuoteLoading, boolean> |
  Action<ActionType.SetTransactionSettings, TradeState['transactionSettings']>;

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
    // input Value
    value: string;
  };
  quote: {
    loading: boolean;
    value: Nullable<BigNumber[]>;
  };
  transactionSettings: {
    slippageTolerance: number;
    deadlineMinutes: number;
  };
}

const reducer = (state: TradeState, action: Actions) => {
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
    case ActionType.TogglePair: {
      return {
        ...state,
        sell: {
          ...state.buy,
          value: '',
        },
        buy: {
          ...state.sell,
          value: '',
        },
        quote: {
          value: null,
          loading: false,
        },
      };
    }
    case ActionType.SetSwapQuote: {
      return {
        ...state,
        quote: {
          ...state.quote,
          value: action.payload,
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

const useLBPVault = (pool: Pool) => {
  const { wallet, signer } = useWallet();
  const vaultContractRef = useRef<Contract>();

  const { data } = useContractReads({
    contracts: [{
      addressOrName: pool.address,
      contractInterface: balancerPoolAbi,
      functionName: 'getVault',
    }],
  });

  useEffect(() => {
    if (vaultContractRef.current || !data || !signer) {
      return;
    }

    const vaultAddress = !!data && data.length > 0 ? data[0] : '';
    vaultContractRef.current = new Contract(vaultAddress as string, balancerVaultAbi, signer);
  }, [data, vaultContractRef, signer]);

  return {
    vaultAddress: vaultContractRef.current?.address || '',
    isReady: !!vaultContractRef.current && !!wallet,
    async getSwapQuote(amount: BigNumber, sellAssetAddress: string, buyAssetAddress: string) {
      const assetOutIndex = pool.tokensList.findIndex((address) => address === buyAssetAddress);
      const assetInIndex = pool.tokensList.findIndex((address) => address === sellAssetAddress);

      const contract = vaultContractRef.current;

      return contract!.callStatic.queryBatchSwap(
        0,
        [{
          poolId: pool.id,
          assetInIndex,
          assetOutIndex,
          amount,
          userData: '0x',
        }],
        pool.tokensList,
        {
          sender: wallet!.toLowerCase(),
          recipient: wallet!.toLowerCase(),
          fromInternalBalance: false,
          toInternalBalance: false,
        }
      );
    },
    async swap(
      amount: BigNumber,
      sellAssetAddress: string,
      buyAssetAddress: string,
      limits: BigNumber[],
      deadline: BigNumber,
    ) {
      const swap = {
        poolId: pool.id,
        kind: 0,
        assetIn: sellAssetAddress,
        assetOut: buyAssetAddress,
        amount,
        userData: '0x',
      };
      
      const funds = {
        sender: wallet!.toLowerCase(),
        recipient: wallet!.toLowerCase(),
        fromInternalBalance: false,
        toInternalBalance: false,
      };

      const contract = vaultContractRef.current;
      return contract!.swap(swap, funds, limits, deadline, {
        gasLimit: 400000,
      });
    },
  };
}

export const useTradeState = (pool: Pool) => {
  const { wallet } = useWallet();
  const vaultService = useLBPVault(pool);

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
      value: '',
    },
    quote: {
      loading: false,
      value: null,
    },
    transactionSettings: {
      slippageTolerance: 1,
      deadlineMinutes: 20,
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

  const queryBatchSwap = async (amount: BigNumber) => {
    dispatch({ type: ActionType.SetSwapQuoteLoading, payload: true });

    try {
      const resp = await vaultService.getSwapQuote(amount, state.sell.address, state.buy.address);

      dispatch({
        type: ActionType.SetSwapQuote,
        payload: resp.map((value: BigNumber) => formatNumber(formatBigNumber(value))),
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

    dispatch({ type: ActionType.SetSwapQuoteLoading, payload: true });
    console.log(BigNumber)
    debugger;
    // const limits = getLimitsForSlippage(
    //   [state.sell.address],
    //   [state.buy.address],
    //   0,
    //   state.quote.value!,
    //   pool.tokensList,
    //   getBigNumberFromString(`${state.transactionSettings.slippageTolerance / 100}`)
    // );
    try {
      const amount = getBigNumberFromString(value);
      
      console.log(limits)
      const resp = await vaultService.swap(
        amount,
        state.sell.address,
        state.buy.address,
        limits,
        BigNumber.from(state.transactionSettings.deadlineMinutes),
      );
      console.log(resp)
    } catch (err) {
      console.error('Error swapping', err)
    } finally {
      dispatch({ type: ActionType.SetSwapQuoteLoading, payload: false });
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
    vaultAddress: vaultService.vaultAddress,
    togglePair: () => dispatch({ type: ActionType.TogglePair, payload: null }),
    setSellValue: async (value: string) => {
      dispatch({ type: ActionType.SetSellValue, payload: value });
      
      if (!value) {
        return;
      }

      const amount = getBigNumberFromString(value);
      await queryBatchSwap(amount);
    },
    queryBatchSwap,
    swap,
    setTransactionSettings: (settings: TradeState['transactionSettings']) => {
      dispatch({ type: ActionType.SetTransactionSettings, payload: settings });
    },
  };
}
