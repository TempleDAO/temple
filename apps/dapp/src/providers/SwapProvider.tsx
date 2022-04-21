import React, {
  useState,
  useContext,
  createContext,
  PropsWithChildren,
} from 'react';
import { BigNumber } from 'ethers';
import { JsonRpcSigner } from '@ethersproject/providers';
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
  TempleUniswapV2Pair__factory,
  TempleIVSwap__factory,
  TempleStableAMMRouter__factory,
} from 'types/typechain';
import {
  TEMPLE_ADDRESS,
  STABLE_COIN_ADDRESS,
  TEMPLE_V2_ROUTER_ADDRESS,
  TEMPLE_V2_PAIR_ADDRESS,
  TEMPLE_IV_SWAP_ADDRESS,
  VITE_PUBLIC_AMM_FRAX_FOR_TEMPLE_GAS_LIMIT,
  VITE_PUBLIC_AMM_TEMPLE_FOR_FRAX_GAS_LIMIT,
  FEI_PAIR_ADDRESS,
  FEI_ADDRESS,
} from 'providers/env';

// our default deadline is 20 minutes
const DEADLINE = 20 * 60;

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

  const getTemplePrice = async (
    walletAddress: string,
    signerState: JsonRpcSigner
  ) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const TEMPLE_UNISWAP_V2_PAIR = new TempleUniswapV2Pair__factory(
      signerState
    ).attach(TEMPLE_V2_PAIR_ADDRESS);

    const { _reserve0, _reserve1 } = await TEMPLE_UNISWAP_V2_PAIR.getReserves();

    return fromAtto(_reserve1) / fromAtto(_reserve0);
  };

  const updateTemplePrice = async () => {
    if (!wallet || !signer) {
      return;
    }

    const price = await getTemplePrice(wallet, signer);
    setTemplePrice(price);
  };

  const getIv = async (walletAddress: string, signerState: JsonRpcSigner) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const TEMPLE_IV_SWAP = new TempleIVSwap__factory(signerState).attach(
      TEMPLE_IV_SWAP_ADDRESS
    );

    const { frax, temple } = await TEMPLE_IV_SWAP.iv();
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
    stablecoinAddress = STABLE_COIN_ADDRESS
  ) => {
    if (wallet && signer) {
      const AMM_ROUTER = new TempleStableAMMRouter__factory(signer).attach(
        TEMPLE_V2_ROUTER_ADDRESS
      );
      const STABLE_TOKEN = new ERC20__factory(signer).attach(stablecoinAddress);

      const symbol =
        stablecoinAddress === STABLE_COIN_ADDRESS
          ? TICKER_SYMBOL.STABLE_TOKEN
          : TICKER_SYMBOL.FEI;

      await ensureAllowance(
        symbol,
        STABLE_TOKEN,
        TEMPLE_V2_ROUTER_ADDRESS,
        amountIn
      );

      const balance = await STABLE_TOKEN.balanceOf(wallet);
      const verifiedAmountIn = amountIn.lt(balance) ? amountIn : balance;

      const deadline = formatNumberFixedDecimals(
        Date.now() / 1000 + DEADLINE,
        0
      );

      const buyTXN = await AMM_ROUTER.swapExactStablecForTemple(
        verifiedAmountIn,
        minAmountOutTemple,
        stablecoinAddress,
        wallet,
        deadline,
        {
          gasLimit: VITE_PUBLIC_AMM_FRAX_FOR_TEMPLE_GAS_LIMIT || 300000,
        }
      );
      await buyTXN.wait();
      // Show feedback to user
      openNotification({
        title: `Sacrificed ${symbol}`,
        hash: buyTXN.hash,
      });
    }
  };

  /**
   * AMM Sell
   * @param amountInTemple: Amount of $TEMPLE user wants to sell
   * @param minAmountOutFrax: % user is giving as slippage
   * @param isIvSwap: should sale be directed to TempleIvSwap contract
   */
  const sell = async (
    amountInTemple: BigNumber,
    minAmountOutFrax: BigNumber,
    isIvSwap = false,
    stablecoinAddress = STABLE_COIN_ADDRESS
  ) => {
    if (wallet && signer) {
      const AMM_ROUTER = new TempleStableAMMRouter__factory(signer).attach(
        TEMPLE_V2_ROUTER_ADDRESS
      );
      const TEMPLE = new TempleERC20Token__factory(signer).attach(
        TEMPLE_ADDRESS
      );

      const TEMPLE_IV_SWAP = new TempleIVSwap__factory(signer).attach(
        TEMPLE_IV_SWAP_ADDRESS
      );

      await ensureAllowance(
        TICKER_SYMBOL.TEMPLE_TOKEN,
        TEMPLE,
        isIvSwap ? TEMPLE_IV_SWAP_ADDRESS : TEMPLE_V2_ROUTER_ADDRESS,
        amountInTemple
      );

      const balance = await TEMPLE.balanceOf(wallet);
      const verifiedAmountInTemple = amountInTemple.lt(balance)
        ? amountInTemple
        : balance;

      const deadline = formatNumberFixedDecimals(
        Date.now() / 1000 + DEADLINE,
        0
      );

      let sellTx;

      if (isIvSwap) {
        sellTx = await TEMPLE_IV_SWAP.swapTempleForIV(
          verifiedAmountInTemple,
          wallet,
          deadline
        );
      } else {
        sellTx = await AMM_ROUTER.swapExactTempleForStablec(
          verifiedAmountInTemple,
          minAmountOutFrax,
          stablecoinAddress,
          wallet,
          deadline,
          {
            gasLimit: VITE_PUBLIC_AMM_TEMPLE_FOR_FRAX_GAS_LIMIT || 195000,
          }
        );
      }

      await sellTx.wait();

      // Show feedback to user
      openNotification({
        title: `${TICKER_SYMBOL.TEMPLE_TOKEN} renounced`,
        hash: sellTx.hash,
      });
    }
  };

  const getBuyQuote = async (
    amountIn: BigNumber,
    sellTokenAddress = TEMPLE_V2_PAIR_ADDRESS
  ): Promise<BigNumber> => {
    if (wallet && signer) {
      const AMM_ROUTER = new TempleStableAMMRouter__factory(signer).attach(
        TEMPLE_V2_ROUTER_ADDRESS
      );

      const pair =
        sellTokenAddress === FEI_ADDRESS
          ? FEI_PAIR_ADDRESS
          : TEMPLE_V2_PAIR_ADDRESS;

      const amountOut = await AMM_ROUTER.swapExactStableForTempleQuote(
        pair,
        amountIn
      );

      return amountOut;
    }
    return BigNumber.from(0);
  };

  const getSellQuote = async (
    amountToSell: BigNumber,
    buyTokenAddress = STABLE_COIN_ADDRESS
  ) => {
    if (wallet && signer) {
      const AMM_ROUTER = new TempleStableAMMRouter__factory(signer).attach(
        TEMPLE_V2_ROUTER_ADDRESS
      );

      const pair =
        buyTokenAddress === FEI_ADDRESS
          ? FEI_PAIR_ADDRESS
          : TEMPLE_V2_PAIR_ADDRESS;

      const { amountOut } = await AMM_ROUTER.swapExactTempleForStableQuote(
        pair,
        amountToSell
      );

      return amountOut;
    }
    return BigNumber.from(0);
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
