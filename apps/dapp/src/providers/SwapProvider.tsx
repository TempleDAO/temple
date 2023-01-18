import { useState, useContext, createContext, PropsWithChildren, useEffect } from 'react';
import { BigNumber } from 'ethers';
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
import { BalancerSDK, Network, SwapType } from '@balancer-labs/sdk';
import { Vault__factory } from '@balancer-labs/typechain/dist/factories/Vault__factory';
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

// Compute slippage tolerance
function getLimits(quote: SwapInfo, slippage: number): string[] {
  const limits: string[] = [];
  const slippageBps = BigNumber.from(10_000 + 100 * slippage);
  quote.tokenAddresses.forEach((token, i) => {
    // tokenIn = Max to send, should be positive
    // tokenOut = Min to receive, should be negative
    // Intermediate tokens should be 0 for multihops
    if (token.toLowerCase() === quote.tokenIn.toLowerCase()) limits[i] = quote.swapAmount.toString();
    else if (token.toLowerCase() === quote.tokenOut.toLowerCase())
      limits[i] = quote.returnAmount.mul(10_000).div(slippageBps).mul(-1).toString();
    else limits[i] = '0';
  });
  return limits;
}
// Build batchSwap transaction details
const buildTransaction = (quote: SwapInfo, wallet: string, deadline: number, slippage: number) => {
  const tx = {
    funds: {
      sender: wallet,
      recipient: wallet,
      fromInternalBalance: false,
      toInternalBalance: false,
    },
    limits: getLimits(quote, slippage),
    deadline: Math.floor(Date.now() / 1000) + deadline * 60,
    overRides: {
      // ETH in swaps must send ETH value
      value: quote.tokenIn === ADDRESS_ZERO ? quote.swapAmount.toString() : '0',
    },
  };
  return tx;
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

  const buy = async (quote: SwapInfo, tokenIn: TICKER_SYMBOL, deadline: number, slippage: number) => {
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
    const tokenContract = new ERC20__factory(signer).attach(tokenInfo.address);
    const vaultContract = Vault__factory.connect(env.contracts.balancerVault, signer);

    // Execute batch swap
    try {
      await ensureAllowance(tokenInfo.address, tokenContract, env.contracts.balancerVault, quote.swapAmount);
      const tx = buildTransaction(quote, wallet, deadline, slippage);
      const swap = await vaultContract.batchSwap(
        swapType,
        quote.swaps,
        quote.tokenAddresses,
        tx.funds,
        tx.limits,
        tx.deadline,
        tx.overRides
      );
      receipt = await swap.wait();
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
      title: `Sacrificed ${formatToken(quote.swapAmount, tokenIn, 0)} ${tokenInfo.name}`,
      hash: receipt.transactionHash,
    });
    return receipt;
  };

  const sell = async (quote: SwapInfo, tokenOut: TICKER_SYMBOL, deadline: number, slippage: number) => {
    if (!wallet || !signer) {
      console.error("Couldn't find wallet or signer");
      setError({
        name: 'Missing wallet or signer',
        message: "Couldn't complete sell transaction - unable to get wallet or signer",
      });
      return;
    }
    setError(null);

    // Initialize vars
    let receipt: TransactionReceipt | undefined;
    const swapType: SwapType = SwapType.SwapExactIn;
    const templeContract = new TempleERC20Token__factory(signer).attach(env.contracts.temple);
    const vaultContract = Vault__factory.connect(env.contracts.balancerVault, signer);

    try {
      await ensureAllowance(env.contracts.temple, templeContract, env.contracts.balancerVault, quote.swapAmount);
      const tx = buildTransaction(quote, wallet, deadline, slippage);
      const swap = await vaultContract.batchSwap(
        swapType,
        quote.swaps,
        quote.tokenAddresses,
        tx.funds,
        tx.limits,
        tx.deadline,
        tx.overRides
      );
      receipt = await swap.wait();
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
      title: `${formatBigNumber(quote.swapAmount)} ${TICKER_SYMBOL.TEMPLE_TOKEN} renounced`,
      hash: receipt.transactionHash,
    });
    return receipt;
  };

  const getBuyQuote = async (amountIn: BigNumber, token: TICKER_SYMBOL) => {
    const tokenInInfo = getTokenInfo(token);
    const tokenOutInfo = getTokenInfo(TICKER_SYMBOL.TEMPLE_TOKEN);
    const gasPrice = await signer?.getGasPrice();
    // Find swapInfo for best trade given pair and amount
    const swapInfo: SwapInfo = await sor.getSwaps(
      tokenInInfo.address,
      tokenOutInfo.address,
      0,
      amountIn,
      { gasPrice, maxPools },
      false
    );
    return swapInfo;
  };

  const getSellQuote = async (amountToSell: BigNumber, token: TICKER_SYMBOL) => {
    const tokenInInfo = getTokenInfo(TICKER_SYMBOL.TEMPLE_TOKEN);
    const tokenOutInfo = getTokenInfo(token);
    const gasPrice = await signer?.getGasPrice();
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
