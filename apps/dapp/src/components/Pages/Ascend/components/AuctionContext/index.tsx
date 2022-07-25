import { createContext, useContext, useState, FC, useMemo } from 'react';
import { BigNumber } from 'ethers';
import { useContractReads, useBalance } from 'wagmi';

import { DecimalBigNumber, DBN_ZERO } from 'utils/DecimalBigNumber';

import balancerVaultAbi from 'data/abis/balancerVault.json';
import balancerPoolAbi from 'data/abis/balancerPool.json';

import { Pool } from 'components/Layouts/Ascend/types';
import { ZERO } from 'utils/bigNumber';
import { noop } from 'utils/helpers';
import { useWallet } from 'providers/WalletProvider';

type TokenMap<T> = { [tokenAddress: string]: T };

interface AuctionContext {
  swapState: {
    buy: AuctionToken;
    sell: AuctionToken;
  };

  toggleTokenPair: () => void;

  vaultAddress: string;
  isPaused: boolean;

  weights?: TokenMap<DecimalBigNumber>;
  balances?: TokenMap<DecimalBigNumber>;

  userBalances: TokenMap<DecimalBigNumber>;
}

const AuctionContext = createContext<AuctionContext>({
  swapState: {
    buy: {
      name: '',
      symbol: '',
      address: '',
      decimals: 0,
      tokenIndex: 0,
    },
    sell: {
      name: '',
      symbol: '',
      address: '',
      decimals: 0,
      tokenIndex: 1,
    },
  },

  userBalances: {},
  weights: {},
  balances: {},

  toggleTokenPair: noop,
  vaultAddress: '',
  isPaused: false,
});

interface AuctionToken {
  name: string;
  address: string;
  symbol: string;
  tokenIndex: number;
  decimals: number;
}

interface Props {
  pool: Pool;
}

export const AuctionContextProvider: FC<Props> = ({ pool, children }) => {
  const { wallet } = useWallet();
  const [buy, sell] = pool.tokens;

  const [swapState, setSwapState] = useState<AuctionContext['swapState']>({
    sell: {
      name: sell.name,
      symbol: sell.symbol,
      address: sell.address,
      decimals: sell.decimals,
      tokenIndex: 1,
    },
    buy: {
      name: buy.name,
      symbol: buy.symbol,
      address: buy.address,
      decimals: buy.decimals,
      tokenIndex: 0,
    },
  });

  const { data: poolData } = useContractReads({
    contracts: [{
      addressOrName: pool.address,
      contractInterface: balancerPoolAbi,
      functionName: 'getVault',
    }, {
      addressOrName: pool.address,
      contractInterface: balancerPoolAbi,
      functionName: 'getPausedState',
    }, {
      addressOrName: pool.address,
      contractInterface: balancerPoolAbi,
      functionName: 'getNormalizedWeights',
    }],
  });

  const [vaultAddress = '', pausedState = [], tokenWeights = []] = poolData || [];

  const { data: vaultData } = useContractReads({
    contracts: [{
      addressOrName: vaultAddress as string,
      contractInterface: balancerVaultAbi,
      functionName: 'getPoolTokens',
      args: [pool.id],
    }],
    enabled: !!vaultAddress
  });

  const [vaultTokens] = vaultData || [];

  const toggleTokenPair = () => setSwapState(({ sell, buy }) => ({
    sell: buy,
    buy: sell,
  }));

  const _sellTokenBalance = useBalance({
    addressOrName: (wallet || ''),
    token: swapState.sell.address,
    enabled: !!wallet,
    watch: true,
  });

  const _buyTokenBalance = useBalance({
    addressOrName: (wallet || ''),
    token: swapState.buy.address,
    enabled: !!wallet,
    watch: true,
  });

  const sellTokenBalance = _sellTokenBalance.data
    ? DecimalBigNumber.fromBN(_sellTokenBalance.data.value, _sellTokenBalance.data.decimals)
    : DBN_ZERO;
  const buyTokenBalance = _buyTokenBalance.data
    ? DecimalBigNumber.fromBN(_buyTokenBalance.data.value, _buyTokenBalance.data.decimals)
    : DBN_ZERO;

  const weights = useMemo(() => {
    const { buy, sell } = swapState;

    if (tokenWeights?.length !== 2) {
      return undefined;
    }
    
    return {
      [buy.address]: DecimalBigNumber.fromBN(tokenWeights[buy.tokenIndex] || ZERO, 18),
      [sell.address]: DecimalBigNumber.fromBN(tokenWeights[sell.tokenIndex] || ZERO, 18),
    };
  }, [tokenWeights, swapState]);

  const poolTokenBalances: BigNumber[] = vaultTokens?.balances || [];
  const balances = useMemo(() => {
    const { buy, sell } = swapState;
    if (poolTokenBalances?.length !== 2) {
      return undefined;
    }
    
    return {
      [buy.address]: DecimalBigNumber.fromBN(poolTokenBalances[buy.tokenIndex] || ZERO, buy.decimals),
      [sell.address]: DecimalBigNumber.fromBN(poolTokenBalances[sell.tokenIndex] || ZERO, sell.decimals),
    };
  }, [swapState, poolTokenBalances]);

  return (
    <AuctionContext.Provider
      value={{
        swapState,

        userBalances: {
          [swapState.buy.address]: buyTokenBalance,
          [swapState.sell.address]: sellTokenBalance,
        },

        balances,
        weights,

        toggleTokenPair,
        vaultAddress: vaultAddress as string,
        isPaused: pausedState ? pausedState.paused : true,
      }}
    >
      {children}
    </AuctionContext.Provider>
  );
};

export const useAuctionContext = () => useContext<AuctionContext>(AuctionContext);