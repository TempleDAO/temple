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
  TempleFraxAMMRouter__factory,
  TempleUniswapV2Pair__factory,
  TempleIVSwap__factory,
} from 'types/typechain';
import {
  TEMPLE_ADDRESS,
  STABLE_COIN_ADDRESS,
  TEMPLE_V2_ROUTER_ADDRESS,
  TEMPLE_V2_PAIR_ADDRESS,
  TEMPLE_IV_SWAP_ADDRESS,
  VITE_PUBLIC_AMM_FRAX_FOR_TEMPLE_GAS_LIMIT,
  VITE_PUBLIC_AMM_TEMPLE_FOR_FRAX_GAS_LIMIT,
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
    amountInFrax: BigNumber,
    minAmountOutTemple: BigNumber
  ) => {
    if (wallet && signer) {
      const AMM_ROUTER = new TempleFraxAMMRouter__factory(signer).attach(
        TEMPLE_V2_ROUTER_ADDRESS
      );
      const STABLE_TOKEN = new ERC20__factory(signer).attach(
        STABLE_COIN_ADDRESS
      );

      await ensureAllowance(
        TICKER_SYMBOL.STABLE_TOKEN,
        STABLE_TOKEN,
        TEMPLE_V2_ROUTER_ADDRESS,
        amountInFrax
      );

      const balance = await STABLE_TOKEN.balanceOf(wallet);
      const verifiedAmountInFrax = amountInFrax.lt(balance)
        ? amountInFrax
        : balance;

      const deadline = formatNumberFixedDecimals(
        Date.now() / 1000 + DEADLINE,
        0
      );

      const buyTXN = await AMM_ROUTER.swapExactFraxForTemple(
        verifiedAmountInFrax,
        minAmountOutTemple,
        wallet,
        deadline,
        {
          gasLimit: VITE_PUBLIC_AMM_FRAX_FOR_TEMPLE_GAS_LIMIT || 300000,
        }
      );
      await buyTXN.wait();
      // Show feedback to user
      openNotification({
        title: `Sacrificed ${TICKER_SYMBOL.STABLE_TOKEN}`,
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
    isIvSwap = false
  ) => {
    if (wallet && signer) {
      const AMM_ROUTER = new TempleFraxAMMRouter__factory(signer).attach(
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
        sellTx = await AMM_ROUTER.swapExactTempleForFrax(
          verifiedAmountInTemple,
          minAmountOutFrax,
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

  const getBuyQuote = async (fraxIn: BigNumber): Promise<BigNumber> => {
    if (wallet && signer) {
      const AMM_ROUTER = new TempleFraxAMMRouter__factory(signer).attach(
        TEMPLE_V2_ROUTER_ADDRESS
      );

      const { amountOutAMM, amountOutProtocol } =
        await AMM_ROUTER.swapExactFraxForTempleQuote(fraxIn);

      return amountOutAMM.add(amountOutProtocol);
    }
    return BigNumber.from(0);
  };

  const getSellQuote = async (amountToSell: BigNumber) => {
    if (wallet && signer) {
      const AMM_ROUTER = new TempleFraxAMMRouter__factory(signer).attach(
        TEMPLE_V2_ROUTER_ADDRESS
      );

      const { amountOut } = await AMM_ROUTER.swapExactTempleForFraxQuote(
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
