import {
  useState,
  useContext,
  createContext,
  PropsWithChildren,
  useEffect,
} from 'react';
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
import { BalancerSDK, Network, SwapType, SwapInfo } from '@balancer-labs/sdk';
import VaultABI from 'data/abis/balancerVault.json';
import { formatToken } from 'utils/formatter';
import { ADDRESS_ZERO } from 'utils/bigNumber';

// Initialize balancer SOR
const maxPools = 4;
const balancer = new BalancerSDK({
  network: Network.MAINNET,
  rpcUrl: env.rpcUrl,
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

// Build batchSwap transaction details
const buildBatchTransaction = (
  quote: SwapInfo,
  wallet: string,
  slippage: number
) => {
  // Compute slippage tolerance
  const limits: string[] = [];
  const slippageBps = BigNumber.from(10_000 + 100 * slippage);
  quote.tokenAddresses.forEach((token, i) => {
    // tokenIn = Max to send, should be positive
    // tokenOut = Min to receive, should be negative
    // Intermediate tokens should be 0 for multihops
    if (token.toLowerCase() === quote.tokenIn.toLowerCase())
      limits[i] = quote.swapAmount.toString();
    else if (token.toLowerCase() === quote.tokenOut.toLowerCase())
      limits[i] = quote.returnAmount
        .mul(10_000)
        .div(slippageBps)
        .mul(-1)
        .toString();
    else limits[i] = '0';
  });

  return {
    funds: {
      sender: wallet,
      recipient: wallet,
      fromInternalBalance: false,
      toInternalBalance: false,
    },
    limits,
    overrides: {
      // ETH in swaps must send ETH value
      value: quote.tokenIn === ADDRESS_ZERO ? quote.swapAmount.toString() : '0',
    },
  };
};

const buildSingleTransaction = (
  quote: SwapInfo,
  wallet: string,
  slippage: number
) => {
  const slippageBps = BigNumber.from(10_000 + 100 * slippage);
  return {
    single: {
      poolId: quote.swaps[0].poolId,
      kind: SwapType.SwapExactIn,
      assetIn: quote.tokenAddresses[quote.swaps[0].assetInIndex],
      assetOut: quote.tokenAddresses[quote.swaps[0].assetOutIndex],
      amount: quote.swaps[0].amount,
      userData: quote.swaps[0].userData,
    },
    funds: {
      sender: wallet,
      recipient: wallet,
      fromInternalBalance: false,
      toInternalBalance: false,
    },
    limit: quote.returnAmount.mul(10_000).div(slippageBps),
    overrides: {
      // ETH in swaps must send ETH value
      value: quote.tokenIn === ADDRESS_ZERO ? quote.swapAmount.toString() : '0',
    },
  };
};

const SwapContext = createContext(INITIAL_STATE);

// eslint-disable-next-line @typescript-eslint/ban-types
export const SwapProvider = (props: PropsWithChildren<{}>) => {
  const [error, setError] = useState<Error | null>(null);
  const { wallet, signer, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();

  useEffect(() => {
    const onMount = async () => {
      try {
        await sor.fetchPools();
      } catch (e) {
        console.log('failed to fetch sor pools');
      }
    };
    onMount();
  }, []);

  // Buy TEMPLE with tokenIn
  const buy = async (
    quote: SwapInfo,
    tokenIn: TICKER_SYMBOL,
    deadline: number,
    slippage: number
  ) => {
    // Check for signer
    if (!wallet || !signer) {
      console.error("Couldn't find wallet or signer");
      setError({
        name: 'Missing wallet or signer',
        message: "Couldn't fetch buy quote - unable to get wallet or signer",
      });
      return;
    }
    setError(null);

    // Initialize vars
    let receipt: TransactionReceipt | undefined;
    const swapType: SwapType = SwapType.SwapExactIn;
    const tokenInfo = getTokenInfo(tokenIn);
    const vaultContract = new ethers.Contract(
      env.contracts.balancerVault,
      VaultABI,
      signer
    );
    const deadlineBn = Math.floor(Date.now() / 1000) + deadline * 60;

    // Execute swap
    try {
      if (tokenInfo.address !== ADDRESS_ZERO) {
        const tokenContract = new ERC20__factory(signer).attach(
          tokenInfo.address
        );
        await ensureAllowance(
          tokenInfo.address,
          tokenContract,
          env.contracts.balancerVault,
          quote.swapAmount
        );
      }
      // Execute single swap
      if (quote.swaps.length === 1) {
        const tx = buildSingleTransaction(quote, wallet, slippage);
        const swap = await vaultContract.swap(
          tx.single,
          tx.funds,
          tx.limit,
          deadlineBn,
          tx.overrides
        );
        receipt = await swap.wait();
      } else {
        // Execute batch swap
        const tx = buildBatchTransaction(quote, wallet, slippage);
        const swap = await vaultContract.batchSwap(
          swapType,
          quote.swaps,
          quote.tokenAddresses,
          tx.funds,
          tx.limits,
          deadlineBn,
          tx.overrides
        );
        receipt = await swap.wait();
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
    // Posthog event
    AnalyticsService.captureEvent(AnalyticsEvent.Trade.Buy, {
      token: tokenInfo.address,
      amount: formatBigNumber(quote.swapAmount),
    });
    openNotification({
      title: `Sacrificed ${formatToken(quote.swapAmount, tokenIn, 0)} ${
        tokenInfo.name
      }`,
      hash: receipt.transactionHash,
    });
    return receipt;
  };

  // Sell TEMPLE for tokenOut
  const sell = async (
    quote: SwapInfo,
    tokenOut: TICKER_SYMBOL,
    deadline: number,
    slippage: number
  ) => {
    if (!wallet || !signer) {
      console.error("Couldn't find wallet or signer");
      setError({
        name: 'Missing wallet or signer',
        message:
          "Couldn't complete sell transaction - unable to get wallet or signer",
      });
      return;
    }
    setError(null);

    // Initialize vars
    let receipt: TransactionReceipt | undefined;
    const swapType: SwapType = SwapType.SwapExactIn;
    const templeContract = new TempleERC20Token__factory(signer).attach(
      env.contracts.temple
    );
    const vaultContract = new ethers.Contract(
      env.contracts.balancerVault,
      VaultABI,
      signer
    );
    const deadlineBn = Math.floor(Date.now() / 1000) + deadline * 60;

    try {
      await ensureAllowance(
        env.contracts.temple,
        templeContract,
        env.contracts.balancerVault,
        quote.swapAmount
      );
      // Execute single swap
      if (quote.swaps.length === 1) {
        const tx = buildSingleTransaction(quote, wallet, slippage);
        const swap = await vaultContract.swap(
          tx.single,
          tx.funds,
          tx.limit,
          deadlineBn,
          tx.overrides
        );
        receipt = await swap.wait();
      } else {
        // Execute batch swap
        const tx = buildBatchTransaction(quote, wallet, slippage);
        const swap = await vaultContract.batchSwap(
          swapType,
          quote.swaps,
          quote.tokenAddresses,
          tx.funds,
          tx.limits,
          deadlineBn,
          tx.overrides
        );
        receipt = await swap.wait();
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
      token: quote.tokenOut,
      amount: formatBigNumber(quote.swapAmount),
    });
    openNotification({
      title: `${formatBigNumber(quote.swapAmount)} ${
        TICKER_SYMBOL.TEMPLE_TOKEN
      } renounced`,
      hash: receipt.transactionHash,
    });
    return receipt;
  };

  // Get quote for buying TEMPLE_TOKEN with tokenIn
  const getBuyQuote = async (amountIn: BigNumber, token: TICKER_SYMBOL) => {
    console.debug('getBuyQuote', amountIn.toString(), token);
    const tokenInInfo = getTokenInfo(token);
    const tokenOutInfo = getTokenInfo(TICKER_SYMBOL.TEMPLE_TOKEN);
    const gasPrice = signer ? await signer?.getGasPrice() : BigNumber.from(0);

    // Find swapInfo for best trade given pair and amount
    const swapInfo: SwapInfo = await sor.getSwaps(
      tokenInInfo.address,
      tokenOutInfo.address,
      0,
      amountIn,
      { gasPrice, maxPools },
      false
    );
    console.debug('swapInfo', swapInfo);
    return swapInfo;
  };

  // Get quote for selling TEMPLE_TOKEN for tokenOut
  const getSellQuote = async (
    amountToSell: BigNumber,
    token: TICKER_SYMBOL
  ) => {
    const tokenInInfo = getTokenInfo(TICKER_SYMBOL.TEMPLE_TOKEN);
    const tokenOutInfo = getTokenInfo(token);
    const gasPrice = signer ? await signer?.getGasPrice() : BigNumber.from(0);

    // Find swapInfo for best trade given pair and amount
    const swapInfo: SwapInfo = await sor.getSwaps(
      tokenInInfo.address,
      tokenOutInfo.address,
      0,
      amountToSell,
      { gasPrice, maxPools },
      false
    );
    return swapInfo;
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
