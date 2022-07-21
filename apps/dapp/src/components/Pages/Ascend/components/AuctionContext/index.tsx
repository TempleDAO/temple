import { createContext, useContext, useState, FC } from 'react';
import { BigNumber } from 'ethers';
import { useContractReads, useBalance } from 'wagmi';

import balancerPoolAbi from 'data/abis/balancerPool.json';

import { Pool } from 'components/Layouts/Ascend/types';
import { ZERO } from 'utils/bigNumber';
import { noop } from 'utils/helpers';
import { useWallet } from 'providers/WalletProvider';

interface AuctionContext {
  sellToken: AuctionToken;
  buyToken: AuctionToken;
  vaultAddress: string;
  toggleTokenPair: () => void;
  totalLiquidity: BigNumber;
  isPaused: boolean;
}

const AuctionContext = createContext<AuctionContext>({
  sellToken: {
    name: '',
    weight: ZERO,
    address: '',
    symbol: '',
    tokenIndex: 0,
    balance: ZERO,
  },
  buyToken: {
    name: '',
    weight: ZERO,
    address: '',
    symbol: '',
    tokenIndex: 1,
    balance: ZERO,
  },
  toggleTokenPair: noop,
  vaultAddress: '',
  totalLiquidity: ZERO,
  isPaused: false,
});

interface AuctionToken {
  name: string;
  weight: BigNumber;
  address: string;
  symbol: string;
  tokenIndex: number;
  balance: BigNumber;
}

type AuctionTokenState = Pick<AuctionContext, 'sellToken' | 'buyToken'>;

interface Props {
  pool: Pool;
}

export const AuctionContextProvider: FC<Props> = ({ pool, children }) => {
  const { wallet } = useWallet();
  const [buy, sell] = pool.tokens;
  const tokenList = pool.tokensList;
  
  const [tokenState, setTokenState] = useState<AuctionTokenState>({
    sellToken: {
      name: sell.name,
      weight: sell.weight,
      address: sell.address,
      symbol: sell.symbol,
      tokenIndex: tokenList.findIndex((address) => address === sell.address),
      balance: ZERO,
    },
    buyToken: {
      name: buy.name,
      weight: buy.weight,
      address: buy.address,
      symbol: buy.symbol,
      tokenIndex: tokenList.findIndex((address) => address === buy.address),
      balance: ZERO,
    },
  });

  const { data } = useContractReads({
    contracts: [{
      addressOrName: pool.address,
      contractInterface: balancerPoolAbi,
      functionName: 'getVault',
    }],
  });

  const vaultAddress = !!data && data.length > 0 ? (data[0] as any) : '';

  const toggleTokenPair = () => setTokenState(({ sellToken, buyToken }) => ({
    sellToken: buyToken,
    buyToken: sellToken,
  }));

  const _sellTokenBalance = useBalance({
    addressOrName: (wallet || '').toLowerCase(),
    token: tokenState.sellToken.address,
    enabled: !!wallet,
    watch: true,
  });

  const _buyTokenBalance = useBalance({
    addressOrName: (wallet || '').toLowerCase(),
    token: tokenState.buyToken.address,
    enabled: !!wallet,
    watch: true,
  });

  const sellTokenBalance = _sellTokenBalance.data?.value || ZERO;
  const buyTokenBalance = _buyTokenBalance.data?.value || ZERO;

  return (
    <AuctionContext.Provider
      value={{
        sellToken: {
          ...tokenState.sellToken,
          balance: sellTokenBalance,
        },
        buyToken: {
          ...tokenState.buyToken,
          balance: buyTokenBalance,
        },
        toggleTokenPair,
        vaultAddress,
        totalLiquidity: ZERO,
        isPaused: false,
      }}
    >
      {children}
    </AuctionContext.Provider>
  );
};

export const useAuctionContext = () => useContext<AuctionContext>(AuctionContext);