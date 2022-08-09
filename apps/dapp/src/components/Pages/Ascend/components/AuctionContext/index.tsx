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
import { sortAndGroupLBPTokens } from 'utils/balancer';
import env from 'constants/env';

type TokenMap<T> = { [tokenAddress: string]: T };

interface AuctionContext {
  // The token the user is selling by default/Temple is accumulating.
  accrued: AuctionToken;
  // The token Temple is distributing/the token the user is buying.
  base: AuctionToken;

  swapState: {
    // User selling (accrued by default)
    sell: AuctionToken;
    buy: AuctionToken;
  };

  toggleTokenPair: () => void;

  vaultAddress: string;
  isPaused: boolean;

  weights: TokenMap<DecimalBigNumber>;
  balances: TokenMap<DecimalBigNumber>;

  userBalances: TokenMap<DecimalBigNumber>;
}

const DEFAULT_SELL = {
  name: '',
  symbol: '',
  address: '',
  decimals: 0,
  tokenIndex: 1,
};

const DEFAULT_BUY = {
  name: '',
  symbol: '',
  address: '',
  decimals: 0,
  tokenIndex: 0, 
};

const AuctionContext = createContext<AuctionContext>({
  accrued: DEFAULT_SELL,
  base: DEFAULT_BUY,

  swapState: {
    sell: DEFAULT_SELL,
    buy: DEFAULT_BUY,
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
  const { accrued, base } = sortAndGroupLBPTokens(pool.tokens);

  const [swapState, setSwapState] = useState<AuctionContext['swapState']>({
    sell: accrued,
    buy: base,
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
    watch: true
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
    const weights = tokenWeights || [];
    return {
      [buy.address]: DecimalBigNumber.fromBN(weights[buy.tokenIndex] || ZERO, 18),
      [sell.address]: DecimalBigNumber.fromBN(weights[sell.tokenIndex] || ZERO, 18),
    };
  }, [tokenWeights, swapState]);

  const poolTokenBalances: BigNumber[] = vaultTokens?.balances || [];
  const balances = useMemo(() => {
    const { buy, sell } = swapState;
    const balances = poolTokenBalances || [];
    return {
      [buy.address]: DecimalBigNumber.fromBN(balances[buy.tokenIndex] || ZERO, buy.decimals),
      [sell.address]: DecimalBigNumber.fromBN(balances[sell.tokenIndex] || ZERO, sell.decimals),
    };
  }, [swapState, poolTokenBalances]);

  return (
    <AuctionContext.Provider
      value={{
        accrued,
        base,

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