import { useState, useContext, createContext, PropsWithChildren } from 'react';
import { BigNumber, Signer, utils } from 'ethers';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { useWallet } from 'providers/WalletProvider';
import { useNotification } from 'providers/NotificationProvider';
import { SwapService } from 'providers/types';
import { NoWalletAddressError } from 'providers/errors';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { asyncNoop } from 'utils/helpers';
import { fromAtto } from 'utils/bigNumber';
import { ERC20__factory, TempleERC20Token__factory, TempleUniswapV2Pair__factory } from 'types/typechain';
import env from 'constants/env';
import { AnalyticsEvent } from 'constants/events';
import { AnalyticsService } from 'services/AnalyticsService';
import { formatBigNumber, getTokenInfo } from 'components/Vault/utils';

const INITIAL_STATE: SwapService = {
  templePrice: 0,
  buy: asyncNoop,
  sell: asyncNoop,
  getSellQuote: asyncNoop,
  getBuyQuote: asyncNoop,
  updateTemplePrice: asyncNoop,
  error: null,
  get1inchSwap: asyncNoop,
};

const SwapContext = createContext(INITIAL_STATE);

export const SwapProvider = (props: PropsWithChildren<{}>) => {
  const [templePrice, setTemplePrice] = useState(INITIAL_STATE.templePrice);
  const [error, setError] = useState<Error | null>(null);

  const { wallet, signer, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();

  const get1inchApi = async (
    queryPath: 'quote' | 'swap',
    params:
      | { amount: BigNumber; fromTokenAddress: string; toTokenAddress: string }
      | { amount: BigNumber; fromTokenAddress: string; toTokenAddress: string; fromAddress: string; slippage: number }
  ) => {
    const queryFormat = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    const data = await fetch(`https://api.1inch.exchange/v5.0/1` + `/${queryPath}?${queryFormat}`);
    return await data.json();
  };

  const get1inchQuote = async (
    tokenAmount: BigNumber,
    tokenIn: TICKER_SYMBOL,
    tokenOut: TICKER_SYMBOL
  ): Promise<{ toTokenAmount: BigNumber }> => {
    const tokenInInfo = getTokenInfo(tokenIn);
    const tokenOutInfo = getTokenInfo(tokenOut);
    const amountFormat = utils.formatUnits(tokenAmount, tokenInInfo.decimals);
    const decimalFormat = utils.parseUnits(amountFormat, tokenInInfo.decimals);
    const data = await get1inchApi('quote', {
      amount: decimalFormat,
      fromTokenAddress: tokenInInfo.address,
      toTokenAddress: tokenOutInfo.address,
    });
    const weiFormat = utils.formatUnits(data.toTokenAmount, tokenOutInfo.decimals);
    const weiBigNumber = utils.parseUnits(weiFormat, tokenOutInfo.decimals);
    return { toTokenAmount: weiBigNumber };
  };

  const get1inchSwap = async (
    tokenAmount: BigNumber,
    tokenIn: TICKER_SYMBOL,
    tokenOut: TICKER_SYMBOL,
    slippage: number
  ) => {
    if (!wallet || !signer) return;
    const tokenInInfo = getTokenInfo(tokenIn);
    const tokenOutInfo = getTokenInfo(tokenOut);
    const bigAmount = utils.parseUnits(tokenAmount.toString(), tokenInInfo.decimals);
    const tokenContract = ERC20__factory.connect(tokenInInfo.address, signer);

    await ensureAllowance(tokenIn, tokenContract, env.contracts.swap1InchRouter, bigAmount);
    const data = await get1inchApi('swap', {
      amount: tokenAmount,
      slippage: slippage,
      fromTokenAddress: tokenInInfo.address,
      toTokenAddress: tokenOutInfo.address,
      fromAddress: wallet,
    });
    delete data.tx.gas;
    const swapTx = await signer.sendTransaction(data.tx);
    return swapTx;
  };

  const getTemplePrice = async (walletAddress: string, signerState: Signer, pairAddress: string) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const pairContract = new TempleUniswapV2Pair__factory(signerState).attach(env.contracts.templeV2FraxPair);

    const { _reserve0, _reserve1 } = await pairContract.getReserves();

    return fromAtto(_reserve1) / fromAtto(_reserve0);
  };

  const updateTemplePrice = async (token: TICKER_SYMBOL = TICKER_SYMBOL.FRAX) => {
    if (!wallet || !signer) {
      setError({
        name: 'Missing wallet or signer',
        message: "Couldn't update temple price - unable to get wallet or signer",
      });
      return;
    }

    setError(null);

    const price = await getTemplePrice(wallet, signer, env.contracts.templeV2FraxPair);

    setTemplePrice(price);
  };

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
      const swap = await get1inchSwap(verifiedAmountIn, token, TICKER_SYMBOL.TEMPLE_TOKEN, slippage);
      receipt = await swap?.wait();
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
   * @param isIvSwap: should sale be directed to TempleIvSwap contract
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
      const swap = await get1inchSwap(verifiedAmountInTemple, TICKER_SYMBOL.TEMPLE_TOKEN, token, slippage);
      receipt = await swap?.wait();
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
    const { toTokenAmount } = await get1inchQuote(amountIn, token, TICKER_SYMBOL.TEMPLE_TOKEN);
    return toTokenAmount;
  };

  const getSellQuote = async (amountToSell: BigNumber, token: TICKER_SYMBOL) => {
    const { toTokenAmount } = await get1inchQuote(amountToSell, TICKER_SYMBOL.TEMPLE_TOKEN, token);
    return toTokenAmount;
  };

  return (
    <SwapContext.Provider
      value={{
        templePrice,
        buy,
        sell,
        getBuyQuote,
        getSellQuote,
        updateTemplePrice,
        error,
        get1inchSwap,
      }}
    >
      {props.children}
    </SwapContext.Provider>
  );
};

export const useSwap = () => useContext(SwapContext);
