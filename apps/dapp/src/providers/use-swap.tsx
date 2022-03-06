import React, { useContext, createContext, PropsWithChildren } from 'react';
import { BigNumber } from 'ethers';
import { useWallet } from 'providers/WalletProvider';
import { useNotification } from 'providers/NotificationProvider';
import { SwapService } from 'providers/WalletProvider/types';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { asyncNoop } from 'utils/helpers';
import {
  ERC20__factory,
  TempleERC20Token__factory,
  TempleFraxAMMRouter__factory,
} from 'types/typechain';
import {
  TEMPLE_ADDRESS,
  STABLE_COIN_ADDRESS,
  TEMPLE_V2_ROUTER_ADDRESS,
  VITE_PUBLIC_AMM_FRAX_FOR_TEMPLE_GAS_LIMIT,
  VITE_PUBLIC_AMM_TEMPLE_FOR_FRAX_GAS_LIMIT,
} from 'providers/WalletProvider/env';

// our default deadline is 20 minutes
const DEADLINE = 20 * 60;

const INITIAL_STATE: SwapService = {
  buy: asyncNoop,
  sell: asyncNoop,
  getSellQuote: asyncNoop,
  getBuyQuote: asyncNoop,
};

const SwapContext = createContext(INITIAL_STATE);

export const SwapProvider = (props: PropsWithChildren<any>) => {
  const { wallet, signer, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();

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
   */
  const sell = async (
    amountInTemple: BigNumber,
    minAmountOutFrax: BigNumber
  ) => {
    if (wallet && signer) {
      const AMM_ROUTER = new TempleFraxAMMRouter__factory(signer).attach(
        TEMPLE_V2_ROUTER_ADDRESS
      );
      const TEMPLE = new TempleERC20Token__factory(signer).attach(
        TEMPLE_ADDRESS
      );

      await ensureAllowance(
        TICKER_SYMBOL.TEMPLE_TOKEN,
        TEMPLE,
        TEMPLE_V2_ROUTER_ADDRESS,
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

      const sellTXN = await AMM_ROUTER.swapExactTempleForFrax(
        verifiedAmountInTemple,
        minAmountOutFrax,
        wallet,
        deadline,
        {
          gasLimit: VITE_PUBLIC_AMM_TEMPLE_FOR_FRAX_GAS_LIMIT || 195000,
        }
      );
      await sellTXN.wait();

      // Show feedback to user
      openNotification({
        title: `${TICKER_SYMBOL.TEMPLE_TOKEN} renounced`,
        hash: sellTXN.hash,
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
        buy,
        sell,
        getBuyQuote,
        getSellQuote,
      }}
    >
      {props.children}
    </SwapContext.Provider>
  );
};

const useSwap = useContext(SwapContext);
