import { useState, useEffect, useReducer, useRef } from 'react';
import { BigNumber, Contract } from 'ethers';
import styled from 'styled-components';
import { useBalance, useContractReads } from 'wagmi';

import balancerPoolAbi from 'data/abis/balancerPool.json'
import balancerVaultAbi from 'data/abis/balancerVault.json'
import { formatNumber } from 'utils/formatter';
import { Pool } from 'components/Layouts/Auction/types';
import { Input } from 'components/Input/Input';
import { useWallet } from 'providers/WalletProvider';
import { ZERO } from 'utils/bigNumber';
import { buttonResets, flexCenter } from 'styles/mixins';
import { getBigNumberFromString, formatBigNumber } from 'components/Vault/utils';
import { Nullable } from 'types/util';
import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { useTokenContractAllowance } from 'hooks/core/use-token-contract-allowance';

import {
  TradeWrapper,
  TradeHeader,
} from '../styles';
import Loader from 'components/Loader/Loader';

interface Props {
  pool: Pool;
}

type Action<A extends ActionType, P extends any> = { type: A, payload: P };

enum ActionType {
  TogglePair,
  SetSellValue,
  SetSwapQuote,
  SetSwapQuoteLoading,
}

type Actions = 
  Action<ActionType.TogglePair, null> |
  Action<ActionType.SetSellValue, string> |
  Action<ActionType.SetSwapQuote, [string, string]> |
  Action<ActionType.SetSwapQuoteLoading, boolean>;

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
    value: Nullable<string[]>;
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
    default: {
      return state;
    }
  }
};

class BalancerQuote {
  private _wallet: string;
  private _contract: Contract;
  private _pool: Pool;
  private _currentQuote: Nullable<{
    assetOut: string;
    assetIn: string;
    value: BigNumber;
    result: Nullable<[string, string]>;
  }>;

  constructor(
    contract: Contract,
    pool: Pool,
    wallet: string,
  ) {
    this._contract = contract;
    this._pool = pool;
    this._currentQuote = null;
    this._wallet = wallet;
  }

  isSameQuote = (value: BigNumber, buyAsset: string, sellAsset: string): boolean => {
    const quote = this._currentQuote;
    if (!quote) {
      return false;
    }

    return quote.value.eq(value) && quote.assetIn === sellAsset && quote.assetOut === buyAsset;
  }

  getSwapQuote = async (value: BigNumber, buyAsset: string, sellAsset: string, onComplete: (value: [string, string]) => void) => {
    if (this.isSameQuote(value, buyAsset, sellAsset)) {
      return;
    }

    const assetOutIndex = this._pool.tokensList.findIndex((address) => address === buyAsset);
    const assetInIndex = this._pool.tokensList.findIndex((address) => address === sellAsset);

    this._currentQuote = {
      value,
      assetOut: buyAsset,
      assetIn: sellAsset,
      result: null,
    };
    
    /*
    * queryBatchSwap simulates a call to `batchSwap`, returning an array of Vault asset deltas. Calls to `swap` cannot be
    * simulated directly, but an equivalent `batchSwap` call can and will yield the exact same result.
    *
    * Each element in the array corresponds to the asset at the same index, and indicates the number of tokens (or ETH)
    * the Vault would take from the sender (if positive) or send to the recipient (if negative). The arguments it
    * receives are the same that an equivalent `batchSwap` call would receive.
    */
    const quote = await this._contract.callStatic.queryBatchSwap(
      0,
      [{
        poolId: this._pool.id,
        assetInIndex,
        assetOutIndex,
        amount: value,
        userData: '0x',
      }],
      this._pool.tokensList,
      {
        sender: this._wallet.toLowerCase(),
        recipient: this._wallet.toLowerCase(),
        fromInternalBalance: false,
        toInternalBalance: false,
      }
    );

    if (this.isSameQuote(value, buyAsset, sellAsset)) {
      this._currentQuote.result = quote.map((value: BigNumber) => value.toString());
      onComplete(this._currentQuote.result!);
    }
  };
}

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
      limit: BigNumber,
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
      return contract!.swap(swap, funds, limit, deadline, {
        gasLimit: 400000,
      });
    },
  };
}

const useTradeState = (pool: Pool) => {
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

    try {
      const amount = getBigNumberFromString(value);
      const resp = await vaultService.swap(
        amount,
        state.sell.address,
        state.buy.address,
        getBigNumberFromString('100'),
        getBigNumberFromString('999'),
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
  };
}

interface Props {
  pool: Pool;
}

const useLBPTokenAllowance = () => {

};

export const Trade = ({ pool }: Props) => {
  const [transactionSettingsOpen, setTransactionSettingsOpen] = useState(false);
  const {
    state,
    togglePair,
    setSellValue,
    swap,
    vaultAddress: lbpVaultAddress,
  } = useTradeState(pool);
  const [{ allowance, isLoading: allowanceIsLoading }, increaseAllowance] = useTokenContractAllowance(state.sell, lbpVaultAddress);

  const bigSellAmount = getBigNumberFromString(state.sell.value);

  const indexOfSell = pool.tokensList.findIndex((address) => address === state.sell.address);
  const indexOfBuy = pool.tokensList.findIndex((address) => address === state.buy.address);

  let receiveEstimate = '';
  if (state.quote.value) {
    receiveEstimate = Math.abs(Number(state.quote.value[indexOfBuy])).toString();
  } 

  return (
    <>
      <TransactionSettingsModal
        isOpen={transactionSettingsOpen}
        onClose={() => setTransactionSettingsOpen(false)}
        onChange={(v) => {
          console.log(v)
        }}
      />
      <TradeWrapper>
        <TradeHeader>Trade TEMPLE</TradeHeader>
        <Input
          isNumber
          crypto={{ kind: 'value', value: state.sell.symbol }}
          placeholder="0.00"
          value={state.sell.value}
          hint={`Balance: ${formatNumber(formatBigNumber(state.sell.balance as BigNumber))}`}
          onHintClick={() => {
            setSellValue(formatBigNumber(state.sell.balance as BigNumber));
          }}
          handleChange={(value) => {
            const stringValue = value.toString();
            if (
              !stringValue.startsWith('.') && 
              Number(stringValue) === 0
            ) {
              setSellValue('');
            } else {
              setSellValue(stringValue);
            }
          }}
        />
        <ToggleButton
          type="button"
          onClick={() => togglePair()}
          aria-label="Toggle Inputs"
          disabled={state.quote.loading}
        />
        <Input
          isNumber
          placeholder="0.00"
          crypto={{ kind: 'value', value: state.buy.symbol }}
          value={receiveEstimate}
          hint={`Balance: ${formatNumber(formatBigNumber(state.buy.balance as BigNumber))}`}
          disabled
        />
        {allowance === 0 && (
          <SwapButton
            type="button"
            disabled={
              allowanceIsLoading
            }
            onClick={() => {
              increaseAllowance();
            }}
          >
            {allowanceIsLoading ? <Loader /> : <>Increase Allowance</>}
          </SwapButton>
        )}
        {allowance !== 0 && (
          <SwapButton
            type="button"
            disabled={
              bigSellAmount.eq(ZERO) ||
              bigSellAmount.gt(state.sell.balance) ||
              state.quote.loading
            }
            onClick={() => {
              swap();
            }}
          >
            Swap
          </SwapButton>
        )}
        {state.quote.value && (
          <div>
            Estimate <br />
            Receive: {Math.abs(Number(state.quote.value[indexOfBuy]))}
            For: {state.quote.value[indexOfSell]}
          </div>
        )}
      </TradeWrapper>
    </>
  );
};

const ToggleButton = styled.button`
  ${buttonResets}

  background-color: ${({ theme }) => theme.palette.brand};
 

  width: 1.875rem;
  height: 1.875rem;
  border-radius: 50%;
  margin-top: calc(-0.2rem - 0.5625rem);
  margin-bottom: -0.5625rem;
  z-index: 50;
`;

const SwapButton = styled.button`
  ${buttonResets}
  ${flexCenter}

  border-radius: 0.625rem;
  background-color: ${({ theme }) => theme.palette.brand};
  font-weight: 700;
  color: #fff;
  display: flex;
  padding: 1.25rem 0;
  width: 100%;
  text-transform: uppercase;
`;