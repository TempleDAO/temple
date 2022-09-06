import { createContext, useContext, useState, FC, useMemo, useRef, useEffect, useCallback } from 'react';
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

  refetchPoolTokenBalances: () => void;
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

  refetchPoolTokenBalances: noop,
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
  const intervalRef = useRef<number>();
  const { accrued, base } = sortAndGroupLBPTokens(pool.tokens);

  const [swapState, setSwapState] = useState<AuctionContext['swapState']>({
    sell: accrued,
    buy: base,
  });

  const { data: poolData, refetch: refetchPoolState } = useContractReads({
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
    enabled: !!wallet,
  });

  const [vaultAddress = '', pausedState = [], tokenWeights = []] = poolData || [];

  const { data: vaultData } = useContractReads({
    contracts: [{
      addressOrName: vaultAddress as string,
      contractInterface: balancerVaultAbi,
      functionName: 'getPoolTokens',
      args: [pool.id],
    }],
    enabled: !!vaultAddress && !!wallet,
  });

  const [vaultTokens] = vaultData || [];

  const toggleTokenPair = () => setSwapState(({ sell, buy }) => ({
    sell: buy,
    buy: sell,
  }));

  const { data: sellTokenData, refetch: refetchSell } = useBalance({
    addressOrName: (wallet || ''),
    token: swapState.sell.address,
    enabled: !!wallet,
  });

  const { data: buyTokenData, refetch: refetchBuy } = useBalance({
    addressOrName: (wallet || ''),
    token: swapState.buy.address,
    enabled: !!wallet,
  });

  const sellTokenBalance = sellTokenData
    ? DecimalBigNumber.fromBN(sellTokenData.value, sellTokenData.decimals)
    : DBN_ZERO;
  const buyTokenBalance = buyTokenData
    ? DecimalBigNumber.fromBN(buyTokenData.value, buyTokenData.decimals)
    : DBN_ZERO;

  useEffect(() => {
    if (intervalRef.current) {
      return;
    }

    intervalRef.current = window.setInterval(() => {
      refetchPoolState();
    }, 20000);
  }, [intervalRef, refetchPoolState]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [intervalRef]);

  const refetchPoolTokenBalances = () => {
    refetchBuy();
    refetchSell();
  };

  const weights = useMemo(() => {
    const weights = tokenWeights || [];

    if (!wallet) {
      return {
        [accrued.address]: DecimalBigNumber.fromBN(accrued.weight || ZERO, 18),
        [base.address]: DecimalBigNumber.fromBN(base.weight || ZERO, 18),
      };
    }

    return {
      [accrued.address]: DecimalBigNumber.fromBN(weights[accrued.tokenIndex] || ZERO, 18),
      [base.address]: DecimalBigNumber.fromBN(weights[base.tokenIndex] || ZERO, 18),
    };
  }, [tokenWeights, accrued, base, wallet]);

  const poolTokenBalances: BigNumber[] = vaultTokens?.balances || [];
  const balances = useMemo(() => {
    const balances = poolTokenBalances || [];

    if (!wallet) {
      // Fallback on pool data if disconnected
      return {
        [accrued.address]: DecimalBigNumber.fromBN(accrued.balance || ZERO, accrued.decimals),
        [base.address]: DecimalBigNumber.fromBN(base.balance || ZERO, base.decimals),
      };
    }

    return {
      [accrued.address]: DecimalBigNumber.fromBN(balances[accrued.tokenIndex] || ZERO, accrued.decimals),
      [base.address]: DecimalBigNumber.fromBN(balances[base.tokenIndex] || ZERO, base.decimals),
    };
  }, [poolTokenBalances, accrued, base, wallet]);

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

        refetchPoolTokenBalances,
      }}
    >
      {children}
    </AuctionContext.Provider>
  );
};

export const useAuctionContext = () => useContext<AuctionContext>(AuctionContext);