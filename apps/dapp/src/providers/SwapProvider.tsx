import { useState, useContext, createContext, PropsWithChildren } from 'react';
import { BigNumber, Signer } from 'ethers';

import { useWallet } from 'providers/WalletProvider';
import { useNotification } from 'providers/NotificationProvider';
import { SwapService } from 'providers/types';
import { NoWalletAddressError } from 'providers/errors';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { asyncNoop } from 'utils/helpers';
import { fromAtto } from 'utils/bigNumber';

import {
  ERC20__factory,
  TempleERC20Token__factory,
  TempleStableAMMRouter__factory,
  TempleUniswapV2Pair__factory,
  TempleTreasury__factory,
} from 'types/typechain';
import {
  FRAX_ADDRESS,
  FEI_ADDRESS,
  TEMPLE_V2_ROUTER_ADDRESS,
  TEMPLE_V2_FRAX_PAIR_ADDRESS,
  TEMPLE_V2_FEI_PAIR_ADDRESS,
  VITE_PUBLIC_AMM_FRAX_FOR_TEMPLE_GAS_LIMIT,
  VITE_PUBLIC_AMM_TEMPLE_FOR_FRAX_GAS_LIMIT,
  TREASURY_ADDRESS,
  TEMPLE_ADDRESS,
} from 'providers/env';

const INITIAL_STATE: SwapService = {
  templePrice: 0,
  iv: 0,
  buy: asyncNoop,
  sell: asyncNoop,
  getSellQuote: asyncNoop,
  getBuyQuote: asyncNoop,
  updateTemplePrice: asyncNoop,
  updateIv: asyncNoop,
};

const SwapContext = createContext(INITIAL_STATE);

export const SwapProvider = (props: PropsWithChildren<{}>) => {
  const [templePrice, setTemplePrice] = useState(INITIAL_STATE.templePrice);
  const [iv, setIv] = useState(INITIAL_STATE.iv);

  const { wallet, signer, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();

  const getTemplePrice = async (walletAddress: string, signerState: Signer, pairAddress: string) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const pairContract = new TempleUniswapV2Pair__factory(signerState).attach(pairAddress);

    const { _reserve0, _reserve1 } = await pairContract.getReserves();

    return fromAtto(_reserve1) / fromAtto(_reserve0);
  };

  const updateTemplePrice = async (token: TICKER_SYMBOL.FRAX | TICKER_SYMBOL.FEI = TICKER_SYMBOL.FRAX) => {
    if (!wallet || !signer) {
      return;
    }

    const pair = token === TICKER_SYMBOL.FEI ? TEMPLE_V2_FEI_PAIR_ADDRESS : TEMPLE_V2_FRAX_PAIR_ADDRESS;
    console.log('updateTemplePrice start');
    const price = await getTemplePrice(wallet, signer, pair);
    console.log('updateTemplePrice end');
    setTemplePrice(price);
  };

  const getIv = async (walletAddress: string, signerState: Signer) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const templeTreasury = new TempleTreasury__factory(signerState).attach(TREASURY_ADDRESS);

    const { stablec, temple } = await templeTreasury.intrinsicValueRatio();
    return fromAtto(stablec) / fromAtto(temple);
  };

  const updateIv = async () => {
    if (!wallet || !signer) {
      return;
    }
    console.log('updateIV start')
    const iv = await getIv(wallet, signer);
    console.log('updateIV end')
    setIv(iv);
  };

  const buy = async (
    amountIn: BigNumber,
    minAmountOutTemple: BigNumber,
    token: TICKER_SYMBOL.FRAX | TICKER_SYMBOL.FEI = TICKER_SYMBOL.FRAX,
    deadlineInMinutes = 20
  ) => {
    if (!wallet || !signer) {
      console.error("Couldn't find wallet or signer");
      return;
    }

    const tokenAddress = token === TICKER_SYMBOL.FEI ? FEI_ADDRESS : FRAX_ADDRESS;
    const ammRouter = new TempleStableAMMRouter__factory(signer).attach(TEMPLE_V2_ROUTER_ADDRESS);
    const tokenContract = new ERC20__factory(signer).attach(tokenAddress);

    const balance = await tokenContract.balanceOf(wallet);
    const verifiedAmountIn = amountIn.lt(balance) ? amountIn : balance;

    const deadlineInSeconds = deadlineInMinutes * 60;
    const deadline = formatNumberFixedDecimals(Date.now() / 1000 + deadlineInSeconds, 0);

    await ensureAllowance(token, tokenContract, TEMPLE_V2_ROUTER_ADDRESS, amountIn);

    const buyTXN = await ammRouter.swapExactStableForTemple(
      verifiedAmountIn,
      minAmountOutTemple,
      tokenAddress,
      wallet,
      deadline,
      {
        gasLimit: VITE_PUBLIC_AMM_FRAX_FOR_TEMPLE_GAS_LIMIT || 300000,
      }
    );

    if (!buyTXN) {
      console.error('Error processing transaction');
      return;
    }

    const txReceipt = await buyTXN.wait();

    if (!txReceipt) {
      console.error('Error processing transaction');
      return;
    }

    // Show feedback to user
    openNotification({
      title: `Sacrificed ${token}`,
      hash: buyTXN.hash,
    });

    return txReceipt;
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
    token: TICKER_SYMBOL.FRAX | TICKER_SYMBOL.FEI = TICKER_SYMBOL.FRAX,
    isIvSwap = false,
    deadlineInMinutes = 20
  ) => {
    if (!wallet || !signer) {
      console.error("Couldn't find wallet or signer");
      return;
    }

    let tokenAddress = token === TICKER_SYMBOL.FEI ? FEI_ADDRESS : FRAX_ADDRESS;
    const ammRouter = new TempleStableAMMRouter__factory(signer).attach(TEMPLE_V2_ROUTER_ADDRESS);
    const templeContract = new TempleERC20Token__factory(signer).attach(TEMPLE_ADDRESS);

    if (isIvSwap) {
      tokenAddress = FEI_ADDRESS;
    }

    const deadlineInSeconds = deadlineInMinutes * 60;

    await ensureAllowance(TICKER_SYMBOL.TEMPLE_TOKEN, templeContract, TEMPLE_V2_ROUTER_ADDRESS, amountInTemple);

    const balance = await templeContract.balanceOf(wallet);
    const verifiedAmountInTemple = amountInTemple.lt(balance) ? amountInTemple : balance;

    const deadline = formatNumberFixedDecimals(Date.now() / 1000 + deadlineInSeconds, 0);

    const sellTx = await ammRouter.swapExactTempleForStable(
      verifiedAmountInTemple,
      minAmountOut,
      tokenAddress,
      wallet,
      deadline,
      {
        gasLimit: VITE_PUBLIC_AMM_TEMPLE_FOR_FRAX_GAS_LIMIT || 195000,
      }
    );

    if (!sellTx) {
      console.error('Error processing transaction');
      return;
    }

    const txReceipt = await sellTx.wait();

    if (!txReceipt) {
      console.error('Error processing transaction');
      return;
    }

    // Show feedback to user
    openNotification({
      title: `${TICKER_SYMBOL.TEMPLE_TOKEN} renounced`,
      hash: sellTx.hash,
    });

    return txReceipt;
  };

  const getBuyQuote = async (
    amountIn: BigNumber,
    token: TICKER_SYMBOL.FRAX | TICKER_SYMBOL.FEI = TICKER_SYMBOL.FRAX
  ): Promise<BigNumber> => {
    if (!wallet || !signer) {
      console.error("Couldn't find wallet or signer");
      return BigNumber.from(0);
    }

    const AMM_ROUTER = new TempleStableAMMRouter__factory(signer).attach(TEMPLE_V2_ROUTER_ADDRESS);

    const pair = token === TICKER_SYMBOL.FEI ? TEMPLE_V2_FEI_PAIR_ADDRESS : TEMPLE_V2_FRAX_PAIR_ADDRESS;

    const amountOut = await AMM_ROUTER.swapExactStableForTempleQuote(pair, amountIn);

    return amountOut;
  };

  const getSellQuote = async (
    amountToSell: BigNumber,
    token: TICKER_SYMBOL.FRAX | TICKER_SYMBOL.FEI = TICKER_SYMBOL.FRAX
  ) => {
    if (!wallet || !signer) {
      console.error("Couldn't find wallet or signer");

      return {
        amountOut: BigNumber.from(0),
        priceBelowIV: false,
      };
    }

    const AMM_ROUTER = new TempleStableAMMRouter__factory(signer).attach(TEMPLE_V2_ROUTER_ADDRESS);

    const pair = token === TICKER_SYMBOL.FEI ? TEMPLE_V2_FEI_PAIR_ADDRESS : TEMPLE_V2_FRAX_PAIR_ADDRESS;

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
      }}
    >
      {props.children}
    </SwapContext.Provider>
  );
};

export const useSwap = () => useContext(SwapContext);
