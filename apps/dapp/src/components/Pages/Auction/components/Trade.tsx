import { useState, useEffect, useReducer } from 'react';
import { BigNumber, utils, Contract } from 'ethers';
import styled from 'styled-components';
import { useBalance, useContractRead, useContractReads, useContractWrite, useProvider } from 'wagmi';
import { formatDistanceStrict, formatDuration, format, intervalToDuration } from 'date-fns';
import { FlexibleXYPlot, XAxis, YAxis, LineSeries, HorizontalGridLines, VerticalGridLines} from 'react-vis';

import arrow from 'assets/icons/amm-arrow.svg';
import balancerPoolAbi from 'data/abis/balancerPool.json'
import balancerVaultAbi from 'data/abis/balancerVault.json'
import { useAuctionContext } from 'components/Layouts/Auction';
import { UnstyledList } from 'styles/common';
import { formatNumber } from 'utils/formatter';
import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import { Pool } from 'components/Layouts/Auction/types';
import { theme } from 'styles/theme';
import env from 'constants/env';
import { CenterScreenWrapper } from 'components/Pages/Core/styles';
import { useTimeRemaining } from '../utils';
import { Input } from 'components/Input/Input';
import { useWallet } from 'providers/WalletProvider';
import { ZERO } from 'utils/bigNumber';
import { buttonResets, flexCenter } from 'styles/mixins';
import { getBigNumberFromString, formatBigNumber } from 'components/Vault/utils';

import {
  TradeWrapper,
  TradeHeader,
} from '../styles';

interface Props {
  pool: Pool;
}

type Action<A extends ActionType, P extends any> = { type: A, payload: P };

enum ActionType {
  TogglePair,
  SetSellValue,
}

type Actions = 
  Action<ActionType.TogglePair, null> |
  Action<ActionType.SetSellValue, string>;

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
      };
    }
    default: {
      return state;
    }
  }
}

const useTradeState = (pool: Pool) => {
  const { wallet } = useWallet();
  const provider = useProvider()
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
  });

  const { data, error } = useContractReads({
    contracts: [{
      addressOrName: pool.address,
      contractInterface: balancerPoolAbi,
      functionName: 'getVault',
    }],
  });

  const vaultAddress = !!data && data.length > 0 ? data[0] : '';

  const assetInIndex = pool.tokensList.findIndex((address) => address === state.buy.address);
  const assetOutIndex = pool.tokensList.findIndex((address) => address === state.sell.address);

  const args = [
    0,
    [{
      poolId: pool.id,
      assetInIndex,
      assetOutIndex,
      amount: getBigNumberFromString(state.sell.value),
      userData: 0x0,
    }],
    pool.tokensList,
    {
      sender: wallet!.toLowerCase(),
      recipient: wallet!.toLowerCase(),
      fromInternalBalance: false,
      toInternalBalance: false,
    },
  ];

  const { write, data: swapData, isLoading } = useContractWrite({
    addressOrName: vaultAddress as string,
    contractInterface: balancerVaultAbi,
    functionName: 'queryBatchSwap',
    args,
  });
  console.log(swapData)
  return {
    state,
    togglePair: () => dispatch({ type: ActionType.TogglePair, payload: null }),
    setSellValue: (value: string) => dispatch({ type: ActionType.SetSellValue, payload: value }),
    async swapAssets () {
      try {
        await write();
      } catch (err) {
        console.log('error', err)
      }
    }
  };
}

export const Trade = ({ pool }: { pool: Pool }) => {
  const { wallet } = useWallet();
  const {
    state,
    togglePair,
    setSellValue,
    swapAssets,
  } = useTradeState(pool);

  const _sellTokenBalance = useBalance({
    addressOrName: (wallet || '').toLowerCase(),
    token: state.sell.address.toLowerCase(),
    enabled: !!wallet,
  });

  const _buyTokenBalance = useBalance({
    addressOrName: (wallet || '').toLowerCase(),
    token: state.buy.address.toLowerCase(),
    enabled: !!wallet,
  });
  // console.log(pool.add)
  
  // console.log(contractRead);
  const sellTokenBalance =
    (_sellTokenBalance.isLoading || _sellTokenBalance.isError || !_sellTokenBalance.data) ?
    ZERO :
    _sellTokenBalance.data.value;
  
  const buyTokenBalance = 
    (_buyTokenBalance.isLoading || _buyTokenBalance.isError || !_buyTokenBalance.data) ?
    ZERO :
    _buyTokenBalance.data.value;

  return (
    <TradeWrapper>
      <TradeHeader>Trade TEMPLE</TradeHeader>
      <Input
        isNumber
        crypto={{ kind: 'value', value: state.sell.symbol }}
        placeholder="0.00"
        value={state.sell.value}
        hint={`Balance: ${formatNumber(formatBigNumber(sellTokenBalance as BigNumber))}`}
        onHintClick={() => {
          setSellValue(formatBigNumber(sellTokenBalance as BigNumber));
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
      />
      <Input
        isNumber
        placeholder="0.00"
        crypto={{ kind: 'value', value: state.buy.symbol }}
        value={state.buy.value}
        hint={`Balance: ${formatNumber(formatBigNumber(buyTokenBalance as BigNumber))}`}
        disabled
      />
      <SwapButton
        type="button"
        onClick={() => {
          swapAssets();
        }}
      >
        Swap
      </SwapButton>
    </TradeWrapper>
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