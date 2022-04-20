import {
  useState,
  useContext,
  createContext,
  PropsWithChildren,
} from 'react';
import { BigNumber, ethers } from 'ethers';
import { TransactionReceipt } from '@ethersproject/abstract-provider';

import { useNotification } from 'providers/NotificationProvider';
import { useWallet } from 'providers/WalletProvider';
import { FaithService } from 'providers/types';
import { NoWalletAddressError } from 'providers/errors';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { asyncNoop } from 'utils/helpers';
import { fromAtto } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';
import {
  Faith__factory,
  Devotion__factory,
  TempleStaking__factory,
  OGTemple__factory,
  FaithMerkleAirdrop__factory,
} from 'types/typechain';
import {
  TEMPLE_FAITH_ADDRESS,
  TEMPLE_DEVOTION_ADDRESS,
  TEMPLE_STAKING_ADDRESS,
  LOCKED_OG_TEMPLE_DEVOTION_ADDRESS,
  VITE_PUBLIC_DEVOTION_LOCK_AND_VERIFY_GAS_LIMIT,
  FAITH_AIRDROP_ADDRESS,
  VITE_PUBLIC_CLAIM_FAITH_GAS_LIMIT,
} from 'providers/env';

const INITIAL_STATE: FaithService = {
  faith: {
    usableFaith: 0,
    lifeTimeFaith: 0,
    totalSupply: 0,
    share: 0,
  },
  verifyFaith: asyncNoop,
  redeemFaith: asyncNoop,
  updateFaith: asyncNoop,
  getFaithQuote: asyncNoop,
  getTempleFaithReward: asyncNoop,
  claimFaithAirdrop: asyncNoop,
};

const FaithContext = createContext(INITIAL_STATE);

export const FaithProvider = (props: PropsWithChildren<{}>) => {
  const [faith, setFaith] = useState(INITIAL_STATE.faith);

  const { wallet, signer, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();

  const getFaith = async (
    walletAddress: string,
    signerState: ethers.providers.JsonRpcSigner
  ) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const FAITH = new Faith__factory(signerState).attach(TEMPLE_FAITH_ADDRESS);

    const faithBalances = await FAITH.balances(walletAddress);
    const totalSupply = await FAITH.totalSupply();
    const totalFaithSupply = fromAtto(totalSupply);
    const lifeTimeFaith = fromAtto(faithBalances.lifeTimeFaith);
    const usableFaith = fromAtto(faithBalances.usableFaith);

    return {
      lifeTimeFaith: lifeTimeFaith,
      usableFaith: usableFaith,
      totalSupply: totalFaithSupply,
      share: formatNumber((usableFaith * 100) / totalFaithSupply),
    };
  };

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

  const getTempleFaithReward = async (faithAmount: BigNumber) => {
    if (wallet && signer) {
      const DEVOTION = new Devotion__factory(signer).attach(
        TEMPLE_DEVOTION_ADDRESS
      );

      return await DEVOTION.claimableTempleRewardQuote(faithAmount);
    } else {
      console.error('Missing wallet address');
    }
  };

  const claimFaithAirdrop = async (
    index: number,
    address: string,
    amount: BigNumber,
    proof: string[]
  ): Promise<TransactionReceipt | void> => {
    if (signer) {
      const faithAirdrop = new FaithMerkleAirdrop__factory(signer).attach(
        FAITH_AIRDROP_ADDRESS
      );

      const tx = await faithAirdrop.claim(index, address, amount, proof, {
        gasLimit: VITE_PUBLIC_CLAIM_FAITH_GAS_LIMIT || 100000,
      });

      return tx.wait();
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
        getTempleFaithReward,
        claimFaithAirdrop,
      }}
    >
      {props.children}
    </FaithContext.Provider>
  );
};

export const useFaith = () => useContext(FaithContext);
