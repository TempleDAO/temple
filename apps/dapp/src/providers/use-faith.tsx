import React, { useState, useContext, createContext } from 'react';
import { BigNumber } from 'ethers';
import { useNotification } from 'providers/NotificationProvider';
import { useWallet } from 'providers/WalletProvider';
import { FaithService } from 'providers/WalletProvider/types';
import { getFaith } from 'providers/WalletProvider/util';
import { asyncNoop } from 'utils/helpers';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import {
  TEMPLE_DEVOTION_ADDRESS,
  TEMPLE_STAKING_ADDRESS,
  LOCKED_OG_TEMPLE_DEVOTION_ADDRESS,
  VITE_PUBLIC_DEVOTION_LOCK_AND_VERIFY_GAS_LIMIT,
} from 'providers/WalletProvider/env';
import {
  Devotion__factory,
  TempleStaking__factory,
  OGTemple__factory,
} from 'types/typechain';

const INITIAL_STATE: FaithService = {
  verifyFaith: asyncNoop,
  redeemFaith: asyncNoop,
  updateFaith: asyncNoop,
  getFaithQuote: asyncNoop,
  faith: {
    usableFaith: 0,
    lifeTimeFaith: 0,
    totalSupply: 0,
    share: 0,
  },
};

const FaithContext = createContext(INITIAL_STATE);

export const FaithProvider = () => {
  const [faith, setFaith] = useState(INITIAL_STATE.faith);

  const { wallet, signer, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();

  const updateFaith = async () => {
    if (!wallet || !signer) {
      return;
    }

    const faith = await getFaith(wallet, signer);
    setFaith(faith);
  };

  const redeemFaith = async (faithAmount: BigNumber) => {
    if (wallet && signer) {
      const DEVOTION = new Devotion__factory(signer).attach(
        TEMPLE_DEVOTION_ADDRESS
      );

      const faithClaimTXN = await DEVOTION.claimTempleReward(faithAmount);
      await faithClaimTXN.wait();

      openNotification({
        title: `${TICKER_SYMBOL.FAITH} redeemed`,
        hash: faithClaimTXN.hash,
      });
    } else {
      console.error('Missing wallet address');
    }
  };

  const verifyFaith = async () => {
    if (wallet && signer) {
      const DEVOTION = new Devotion__factory(signer).attach(
        TEMPLE_DEVOTION_ADDRESS
      );

      const TEMPLE_STAKING = new TempleStaking__factory(signer).attach(
        TEMPLE_STAKING_ADDRESS
      );

      const OG_TEMPLE = new OGTemple__factory(signer).attach(
        await TEMPLE_STAKING.OG_TEMPLE()
      );

      const walletOGTEMPLE = await OG_TEMPLE.balanceOf(wallet);
      await ensureAllowance(
        TICKER_SYMBOL.OG_TEMPLE_TOKEN,
        OG_TEMPLE,
        LOCKED_OG_TEMPLE_DEVOTION_ADDRESS,
        walletOGTEMPLE
      );

      const faithVerificationTXN = await DEVOTION.lockAndVerify(
        walletOGTEMPLE,
        {
          gasLimit: VITE_PUBLIC_DEVOTION_LOCK_AND_VERIFY_GAS_LIMIT || 250000,
        }
      );
      await faithVerificationTXN.wait();

      openNotification({
        title: `${TICKER_SYMBOL.FAITH} verified`,
        hash: faithVerificationTXN.hash,
      });
    } else {
      console.error('Missing wallet address');
    }
  };

  const getFaithQuote = async () => {
    if (wallet && signer) {
      const DEVOTION = new Devotion__factory(signer).attach(
        TEMPLE_DEVOTION_ADDRESS
      );

      const faithQuote = await DEVOTION.verifyFaithQuote(wallet);
      return {
        canClaim: faithQuote.canClaim,
        claimableFaith: faithQuote.claimableFaith.toNumber(),
      };
    } else {
      console.error('Missing wallet address');
    }
  };

  return (
    <FaithContext.Provider
      value={{
        faith,
        updateFaith,
        redeemFaith,
        verifyFaith,
        getFaithQuote,
      }}
    />
  );
};

export const useFaith = useContext(FaithContext);
