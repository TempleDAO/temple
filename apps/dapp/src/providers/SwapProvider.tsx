import { useState, useContext, createContext, PropsWithChildren } from 'react';
import { BigNumber, Signer, utils } from 'ethers';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import axios from 'axios';

import { useWallet } from 'providers/WalletProvider';
import { useNotification } from 'providers/NotificationProvider';
import { SwapService } from 'providers/types';
import { NoWalletAddressError } from 'providers/errors';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { asyncNoop } from 'utils/helpers';
import { fromAtto, ZERO } from 'utils/bigNumber';

import {
  ERC20__factory,
  TempleERC20Token__factory,
  TempleStableAMMRouter__factory,
  TempleUniswapV2Pair__factory,
  TreasuryIV__factory,
} from 'types/typechain';
import env from 'constants/env';
import { AnalyticsEvent } from 'constants/events';
import { AnalyticsService } from 'services/AnalyticsService';
import { formatBigNumber } from 'components/Vault/utils';
import { Tokens } from 'constants/env/types';

const INITIAL_STATE: SwapService = {
  templePrice: 0,
  iv: 0,
  buy: asyncNoop,
  sell: asyncNoop,
  getSellQuote: asyncNoop,
  getBuyQuote: asyncNoop,
  updateTemplePrice: asyncNoop,
  updateIv: asyncNoop,
  error: null,
  get1inchQuote: asyncNoop,
  get1inchSwap: asyncNoop,
};

const SwapContext = createContext(INITIAL_STATE);

export const SwapProvider = (props: PropsWithChildren<{}>) => {
  const [templePrice, setTemplePrice] = useState(INITIAL_STATE.templePrice);
  const [iv, setIv] = useState(INITIAL_STATE.iv);
  const [error, setError] = useState<Error | null>(null);

  const { wallet, signer, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();

  const get1inchApi = async (
    queryPath: 'quote' | 'swap',
    params:
      | { amount: BigNumber; fromTokenAddress: string; toTokenAddress: string }
      | { amount: BigNumber; fromTokenAddress: string; toTokenAddress: string; from: string; slippage: number }
  ) => {
    const queryFormat = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return await axios.get(`https://api.1inch.exchange/v5.0/1` + `/${queryPath}?${queryFormat}`);
  };

  const get1inchQuote = async (tokenAmount: BigNumber, tokenIn: TICKER_SYMBOL, tokenOut: TICKER_SYMBOL) => {
    const tokenInFormat = tokenIn.toLowerCase().replace('$', '') as keyof Tokens;
    const tokenInInfo = env.tokens[tokenInFormat];
    const tokenOutFormat = tokenOut.toLowerCase().replace('$', '') as keyof Tokens;
    const tokenOutInfo = env.tokens[tokenOutFormat];
    const amountFormat = utils.formatUnits(tokenAmount); //, tokenInInfo.decimals);
    const decimalFormat = utils.parseUnits(amountFormat, tokenInInfo.decimals);
    const { data } = await get1inchApi('quote', {
      amount: decimalFormat,
      fromTokenAddress: tokenInInfo.address,
      toTokenAddress: tokenOutInfo.address,
    });
    // reformats as a price in wei for formatting
    const weiFormat = utils.formatUnits(data.toTokenAmount, tokenOutInfo.decimals);
    const weiBigNumber = utils.parseEther(weiFormat);
    return { ...data, toTokenAmount: weiBigNumber.toString() };
  };

  const get1inchSwap = async (
    tokenAmount: BigNumber,
    tokenIn: TICKER_SYMBOL,
    tokenOut: TICKER_SYMBOL,
    slippage: number
  ) => {
    if (!wallet || !signer) return;
    const tokenInFormat = tokenIn.toLowerCase().replace('$', '') as keyof Tokens;
    const tokenInInfo = env.tokens[tokenInFormat];
    const bigAmount = utils.parseUnits(tokenAmount.toString(), tokenInInfo.decimals);
    const tokenContract = ERC20__factory.connect(tokenInInfo.address, signer);

    await ensureAllowance(tokenIn, tokenContract, env.contracts.swap1InchRouter, bigAmount);
    const { data } = await get1inchApi('swap', {
      amount: tokenAmount,
      slippage: slippage,
      fromTokenAddress: tokenIn,
      toTokenAddress: tokenOut,
      from: wallet,
    });
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

  const updateTemplePrice = async (token: TICKER_SYMBOL.FRAX | TICKER_SYMBOL.FEI = TICKER_SYMBOL.FRAX) => {
    if (!wallet || !signer) {
      setError({
        name: 'Missing wallet or signer',
        message: "Couldn't update temple price - unable to get wallet or signer",
      });
      return;
    }

    setError(null);

    const pair = token === TICKER_SYMBOL.FEI ? env.contracts.templeV2FeiPair : env.contracts.templeV2FraxPair;
    const price = await getTemplePrice(wallet, signer, pair);

    setTemplePrice(price);
  };

  const getIv = async (walletAddress: string, signerState: Signer) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const templeTreasury = new TreasuryIV__factory(signerState).attach(env.contracts.treasuryIv);

    const { frax, temple } = await templeTreasury.intrinsicValueRatio();
    return fromAtto(frax) / fromAtto(temple);
  };

  const updateIv = async () => {
    if (!wallet || !signer) {
      return;
    }

    const iv = await getIv(wallet, signer);
    setIv(iv);
  };

  const buy = async (
    amountIn: BigNumber,
    minAmountOutTemple: BigNumber,
    token: TICKER_SYMBOL,
    deadlineInMinutes = 20,
    slippage?: number
  ) => {
    if (!wallet || !signer) {
      console.error("Couldn't find wallet or signer");
      setError({
        name: 'Missing wallet or signer',
        message: "Couldn't fetch buy quote - unable to get wallet or signer",
      });
      return;
    }

    setError(null);

    const tokenAddress = token === TICKER_SYMBOL.FEI ? env.contracts.fei : env.contracts.frax;
    const tokenContract = new ERC20__factory(signer).attach(tokenAddress);
    const balance = await tokenContract.balanceOf(wallet);
    const verifiedAmountIn = amountIn.lt(balance) ? amountIn : balance;

    let receipt: TransactionReceipt | undefined;
    try {
      const nonFrax = [TICKER_SYMBOL.USDC, TICKER_SYMBOL.USDT, TICKER_SYMBOL.DAI];
      if (nonFrax.includes(token) && slippage) {
        // has to use balancer via 1inch
        const swap = await get1inchSwap(verifiedAmountIn, token, TICKER_SYMBOL.TEMPLE_TOKEN, slippage);
        receipt = await swap?.wait();
      } else {
        await ensureAllowance(token, tokenContract, env.contracts.templeV2Router, amountIn);

        const deadlineInSeconds = deadlineInMinutes * 60;
        const deadline = formatNumberFixedDecimals(Date.now() / 1000 + deadlineInSeconds, 0);
        const ammRouter = new TempleStableAMMRouter__factory(signer).attach(env.contracts.templeV2Router);
        const buyTXN = await ammRouter.swapExactStableForTemple(
          verifiedAmountIn,
          minAmountOutTemple,
          tokenAddress,
          wallet,
          deadline,
          {
            gasLimit: env.gas?.swapFraxForTemple || 300000,
          }
        );
        receipt = await buyTXN.wait();
      }
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
  const sell = async (
    amountInTemple: BigNumber,
    minAmountOut: BigNumber,
    token: TICKER_SYMBOL,
    isIvSwap = false,
    deadlineInMinutes = 20,
    slippage?: number
  ) => {
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

    let tokenAddress = token === TICKER_SYMBOL.FEI ? env.contracts.fei : env.contracts.frax;
    if (isIvSwap) {
      tokenAddress = env.contracts.fei;
    }
    const tokenContract = new ERC20__factory(signer).attach(tokenAddress);
    const balance = await templeContract.balanceOf(wallet);
    const verifiedAmountInTemple = amountInTemple.lt(balance) ? amountInTemple : balance;

    let receipt: TransactionReceipt | undefined;
    try {
      const nonFrax = [TICKER_SYMBOL.USDC, TICKER_SYMBOL.USDT, TICKER_SYMBOL.DAI];
      if (nonFrax.includes(token) && slippage) {
        // has to use balancer via 1inch
        const swap = await get1inchSwap(verifiedAmountInTemple, TICKER_SYMBOL.TEMPLE_TOKEN, token, slippage);
        receipt = await swap?.wait();
      } else {
        await ensureAllowance(TICKER_SYMBOL.TEMPLE_TOKEN, templeContract, env.contracts.templeV2Router, amountInTemple);

        const deadlineInSeconds = deadlineInMinutes * 60;
        const deadline = formatNumberFixedDecimals(Date.now() / 1000 + deadlineInSeconds, 0);
        const ammRouter = new TempleStableAMMRouter__factory(signer).attach(env.contracts.templeV2Router);
        const sellTx = await ammRouter.swapExactTempleForStable(
          verifiedAmountInTemple,
          minAmountOut,
          tokenAddress,
          wallet,
          deadline,
          {
            gasLimit: env.gas?.swapTempleForFrax || 195000,
          }
        );

        receipt = await sellTx.wait();
      }
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

  const getBuyQuote = async (amountIn: BigNumber, token: TICKER_SYMBOL): Promise<BigNumber> => {
    if (!wallet || !signer) {
      console.error("Couldn't find wallet or signer");

      setError({
        name: 'Missing wallet or signer',
        message: "Couldn't complete buy transaction - unable to get wallet or signer",
      });

      return ZERO;
    }

    setError(null);

    const AMM_ROUTER = new TempleStableAMMRouter__factory(signer).attach(env.contracts.templeV2Router);

    const pair = token === TICKER_SYMBOL.FEI ? env.contracts.templeV2FeiPair : env.contracts.templeV2FraxPair;

    const amountOut = await AMM_ROUTER.swapExactStableForTempleQuote(pair, amountIn);

    return amountOut;
  };

  const getSellQuote = async (amountToSell: BigNumber, token: TICKER_SYMBOL) => {
    if (!wallet || !signer) {
      console.error("Couldn't find wallet or signer");
      setError({
        name: 'Missing wallet or signer',
        message: "Couldn't fetch sell quote - unable to get wallet or signer",
      });
      return {
        amountOut: BigNumber.from(0),
        priceBelowIV: false,
      };
    }

    setError(null);

    const AMM_ROUTER = new TempleStableAMMRouter__factory(signer).attach(env.contracts.templeV2Router);

    const pair = token === TICKER_SYMBOL.FEI ? env.contracts.templeV2FeiPair : env.contracts.templeV2FraxPair;

    const { amountOut, priceBelowIV } = await AMM_ROUTER.swapExactTempleForStableQuote(pair, amountToSell);

    return {
      amountOut: amountOut,
      priceBelowIV: priceBelowIV,
    };
  };

  return (
    <SwapContext.Provider
      value={{
        templePrice,
        iv,
        buy,
        sell,
        getBuyQuote,
        getSellQuote,
        updateTemplePrice,
        updateIv,
        error,
        get1inchQuote,
        get1inchSwap,
      }}
    >
      {props.children}
    </SwapContext.Provider>
  );
};

export const useSwap = () => useContext(SwapContext);
