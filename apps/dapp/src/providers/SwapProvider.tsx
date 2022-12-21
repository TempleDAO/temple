import { useState, useContext, createContext, PropsWithChildren, useEffect } from 'react';
import { BigNumber, ethers } from 'ethers';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { useWallet } from 'providers/WalletProvider';
import { useNotification } from 'providers/NotificationProvider';
import { SwapService } from 'providers/types';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { asyncNoop } from 'utils/helpers';
import { ERC20__factory, TempleERC20Token__factory } from 'types/typechain';
import env from 'constants/env';
import { AnalyticsEvent } from 'constants/events';
import { AnalyticsService } from 'services/AnalyticsService';
import { formatBigNumber, getTokenInfo } from 'components/Vault/utils';
import { SwapInfo } from '@balancer-labs/sor';
import { BalancerSDK, Network } from '@balancer-labs/sdk';

// Initialize balancer SOR
const gasPrice = BigNumber.from('14000000000');
const maxPools = 4;
const balancer = new BalancerSDK({
  network: Network.MAINNET,
  rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/AorwfDdHDsEjIX4HPwS70zkVjWqjv5vZ',
  // customSubgraphUrl: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
});
const sor = balancer.sor;

const INITIAL_STATE: SwapService = {
  buy: asyncNoop,
  sell: asyncNoop,
  getSellQuote: asyncNoop,
  getBuyQuote: asyncNoop,
  error: null,
  sor: balancer.sor,
};

const SwapContext = createContext(INITIAL_STATE);

export const SwapProvider = (props: PropsWithChildren<{}>) => {
  const [error, setError] = useState<Error | null>(null);
  const { wallet, signer, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();

  useEffect(() => {
    const onMount = async () => {
      try {
        await sor.fetchPools();
      } catch (e) {
        console.log('test');
      }
    };
    onMount();
  }, []);

  // const get1inchSwap = async (
  //   tokenAmount: BigNumber,
  //   tokenIn: TICKER_SYMBOL,
  //   tokenOut: TICKER_SYMBOL,
  //   slippage: number
  // ) => {
  //   if (!wallet || !signer) return;
  //   const tokenInInfo = getTokenInfo(tokenIn);
  //   const tokenOutInfo = getTokenInfo(tokenOut);
  //   const bigAmount = utils.parseUnits(tokenAmount.toString(), tokenInInfo.decimals);
  //   const tokenContract = ERC20__factory.connect(tokenInInfo.address, signer);

  //   await ensureAllowance(tokenIn, tokenContract, env.contracts.swap1InchRouter, bigAmount);
  //   const data = await get1inchApi('swap', {
  //     amount: tokenAmount,
  //     slippage: slippage,
  //     fromTokenAddress: tokenInInfo.address,
  //     toTokenAddress: tokenOutInfo.address,
  //     fromAddress: wallet,
  //   });
  //   delete data.tx.gas;
  //   const swapTx = await signer.sendTransaction(data.tx);
  //   return swapTx;
  // };

  const buy = async (amountIn: BigNumber, token: TICKER_SYMBOL, slippage: number) => {
    if (!wallet || !signer) {
      console.error("Couldn't find wallet or signer");
      setError({
        name: 'Missing wallet or signer',
        message: "Couldn't fetch buy quote - unable to get wallet or signer",
      });
      return;
    }

    setError(null);

    const tokenInfo = getTokenInfo(token);
    const tokenContract = new ERC20__factory(signer).attach(tokenInfo.address);
    const balance = await tokenContract.balanceOf(wallet);
    const verifiedAmountIn = amountIn.lt(balance) ? amountIn : balance;

    let receipt: TransactionReceipt | undefined;
    try {
      // const swap = await get1inchSwap(verifiedAmountIn, token, TICKER_SYMBOL.TEMPLE_TOKEN, slippage);
      // receipt = await swap?.wait();
    } catch (e) {
      // 4001 is user manually cancelling transaction,
      // so we don't want to return it as an error
      if ((e as any).code !== 4001) {
        console.error("Couldn't complete buy transaction", e);
        setError(e as Error);
      }
    }
    if (!receipt) return;

    AnalyticsService.captureEvent(AnalyticsEvent.Trade.Buy, { token, amount: formatBigNumber(verifiedAmountIn) });
    openNotification({
      title: `Sacrificed ${token}`,
      hash: receipt.transactionHash,
    });
    return receipt;
  };

  /**
   * AMM Sell
   * @param amountInTemple: Amount of $TEMPLE user wants to sell
   * @param minAmountOutFrax: % user is giving as slippage
   */
  const sell = async (amountInTemple: BigNumber, token: TICKER_SYMBOL, slippage: number) => {
    if (!wallet || !signer) {
      console.error("Couldn't find wallet or signer");
      setError({
        name: 'Missing wallet or signer',
        message: "Couldn't complete sell transaction - unable to get wallet or signer",
      });
      return;
    }

    setError(null);

    const templeContract = new TempleERC20Token__factory(signer).attach(env.contracts.temple);
    const balance = await templeContract.balanceOf(wallet);
    const verifiedAmountInTemple = amountInTemple.lt(balance) ? amountInTemple : balance;

    let receipt: TransactionReceipt | undefined;
    try {
      // const swap = await get1inchSwap(verifiedAmountInTemple, TICKER_SYMBOL.TEMPLE_TOKEN, token, slippage);
      // receipt = await swap?.wait();
    } catch (e) {
      // 4001 is user manually cancelling transaction,
      // so we don't want to return it as an error
      if ((e as any).code !== 4001) {
        console.error("Couldn't complete sell transaction", e);
        setError(e as Error);
      }
    }

    if (!receipt) return;

    AnalyticsService.captureEvent(AnalyticsEvent.Trade.Sell, {
      token,
      amount: formatBigNumber(verifiedAmountInTemple),
    });
    openNotification({
      title: `${TICKER_SYMBOL.TEMPLE_TOKEN} renounced`,
      hash: receipt.transactionHash,
    });
    return receipt;
  };

  const getBuyQuote = async (amountIn: BigNumber, token: TICKER_SYMBOL) => {
    const tokenInInfo = getTokenInfo(token);
    const tokenOutInfo = getTokenInfo(TICKER_SYMBOL.TEMPLE_TOKEN);
    // Find swapInfo for best trade given pair and amount
    const swapInfo: SwapInfo = await sor.getSwaps(
      tokenInInfo.address,
      tokenOutInfo.address,
      0,
      amountIn,
      { gasPrice, maxPools },
      false
    );
    return swapInfo.returnAmount;
  };

  const getSellQuote = async (amountToSell: BigNumber, token: TICKER_SYMBOL) => {
    const tokenInInfo = getTokenInfo(TICKER_SYMBOL.TEMPLE_TOKEN);
    const tokenOutInfo = getTokenInfo(token);
    // Find swapInfo for best trade given pair and amount
    const swapInfo: SwapInfo = await sor.getSwaps(
      tokenInInfo.address,
      tokenOutInfo.address,
      0,
      amountToSell,
      { gasPrice, maxPools },
      false
    );
    return swapInfo.returnAmount;
  };

  return (
    <SwapContext.Provider
      value={{
        buy,
        sell,
        getBuyQuote,
        getSellQuote,
        error,
        sor,
      }}
    >
      {props.children}
    </SwapContext.Provider>
  );
};

export const useSwap = () => useContext(SwapContext);
