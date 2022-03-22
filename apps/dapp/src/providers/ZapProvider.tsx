import React, {
  useState,
  createContext,
  useContext,
  PropsWithChildren,
} from 'react';
import { ethers, ContractTransaction, BigNumber } from 'ethers';
import axios from 'axios';
import { signERC2612Permit } from 'eth-permit';
import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { useNotification } from 'providers/NotificationProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { toAtto } from 'utils/bigNumber';
import { asyncNoop } from 'utils/helpers';
import { ZapService } from 'providers/types';
import { create0xQuoteUrl, createZapperTokenBalanceUrl } from 'utils/url';
import {
  TempleZaps,
  FakeERC20,
  TempleZaps__factory,
  FakeERC20__factory,
} from 'types/typechain';
import {
  TEMPLE_ZAPS_ADDRESS,
  ZEROEX_EXCHANGE_PROXY,
  STABLE_COIN_ADDRESS,
} from 'providers/env';

const INITIAL_STATE: ZapService = {
  zapIn: asyncNoop,
  getZapQuote: asyncNoop,
};

const ZapContext = createContext(INITIAL_STATE);

export const SwapProvider = (props: PropsWithChildren<{}>) => {
  const { signer, wallet } = useWallet();
  const { getTemplePrice } = useSwap();
  const { openNotification } = useNotification();

  const zapIn = async (
    tokenSymbol: string,
    tokenAddr: string,
    decimals: number,
    tokenAmount: number,
    minTempleReceived: BigNumber
  ) => {
    if (!signer || !wallet) {
      console.error('Missing wallet address and/or signer', wallet, signer);
      return;
    }

    let sellToken: string;
    let tx: ContractTransaction;
    const TEMPLE_ZAPS = new TempleZaps__factory(signer).attach(
      TEMPLE_ZAPS_ADDRESS
    );
    const tokenContract = new FakeERC20__factory(signer).attach(tokenAddr);

    if (tokenAddr === ethers.constants.AddressZero) {
      sellToken = TICKER_SYMBOL.ETH;
    } else {
      sellToken = tokenAddr;
    }

    const sellAmount = ethers.utils
      .parseUnits(tokenAmount.toString(), decimals)
      .toString();

    const swapCallData = await get0xApiSwapQuote(sellToken, sellAmount);

    if (
      tokenSymbol === TICKER_SYMBOL.USDC ||
      tokenSymbol === TICKER_SYMBOL.UNI
    ) {
      tx = await zapWithPermit(
        TEMPLE_ZAPS,
        tokenContract,
        tokenSymbol,
        sellAmount,
        minTempleReceived,
        swapCallData
      );
    } else {
      if (sellToken !== TICKER_SYMBOL.ETH) {
        await tokenContract.approve(
          TEMPLE_ZAPS_ADDRESS,
          ethers.utils.parseUnits('1000111', decimals)
        );
      }

      const overrides: { value?: BigNumber } = {};

      if (sellToken === TICKER_SYMBOL.ETH) {
        overrides.value = toAtto(tokenAmount);
      }

      tx = await TEMPLE_ZAPS.zapIn(
        tokenAddr,
        sellAmount,
        minTempleReceived.toString(),
        Math.floor(Date.now() / 1000) + 1200,
        ZEROEX_EXCHANGE_PROXY,
        swapCallData,
        overrides
      );
    }

    const txReceipt = await tx.wait();

    if (txReceipt) {
      openNotification({
        title: `Zapped ${tokenSymbol} for ${TICKER_SYMBOL.TEMPLE_TOKEN}`,
        hash: tx.hash,
      });
    } else {
      openNotification({
        title: `Failed to zap ${tokenSymbol} for ${TICKER_SYMBOL.TEMPLE_TOKEN}`,
        hash: tx.hash,
      });
      console.error('Error swapping tokens');
    }
  };

  const get0xApiSwapQuote = async (sellToken: string, sellAmount: string) => {
    if (sellToken === STABLE_COIN_ADDRESS) {
      return '0x';
    }

    const url = create0xQuoteUrl(sellToken, sellAmount);
    const response = await axios.get(url);
    return response.data.data;
  };

  const zapWithPermit = async (
    zapsContract: TempleZaps,
    tokenContract: FakeERC20,
    tokenSymbol: string,
    sellAmount: string,
    minTempleReceived: BigNumber,
    swapCallData: string
  ) => {
    if (!signer || !wallet) {
      console.error('Missing wallet address and/or signer', wallet, signer);
      return;
    }

    const permitDomain = {
      name: await tokenContract.name(),
      version: tokenSymbol === TICKER_SYMBOL.USDC ? '2' : '1',
      chainId: 1,
      verifyingContract: tokenContract.address,
    };

    // r + s = two integers that form the ECDSA signature
    // v = recovery identifier for the signature
    const { deadline, v, r, s } = await signERC2612Permit(
      signer.provider,
      permitDomain,
      wallet,
      zapsContract.address,
      sellAmount
    );

    return await zapsContract.zapInWithPermit(
      tokenContract.address,
      sellAmount,
      minTempleReceived.toString(),
      Math.floor(Date.now() / 1000) + 1200,
      ZEROEX_EXCHANGE_PROXY,
      swapCallData,
      deadline,
      v,
      r,
      s
    );
  };

  // Unsure how useful this is
  const getZapQuote = async (
    tokenPrice: number,
    tokenAmount: number
  ): Promise<number | void> => {
    const templePrice = await getTemplePrice();

    if (!templePrice) {
      throw new Error('Unable to get $TEMPLE price for Zap Quote');
    }

    return (tokenPrice * tokenAmount) / templePrice;
  };

  return (
    <ZapContext.Provider
      value={{
        zapIn,
        getZapQuote,
      }}
    >
      {props.children}
    </ZapContext.Provider>
  );
};

export const useZap = () => useContext(ZapContext);
