import { useState, createContext, useContext, PropsWithChildren } from 'react';
import { BigNumber, Signer } from 'ethers';
import { useWallet } from 'providers/WalletProvider';
import { useNotification } from 'providers/NotificationProvider';
import { NoWalletAddressError } from 'providers/errors';
import { asyncNoop } from 'utils/helpers';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import env from 'constants/env';
import { StakingService, ExitQueueData, LockedEntry } from 'providers/types';
import {
  OGTemple__factory,
  TempleERC20Token__factory,
  TempleStaking__factory,
  LockedOGTemple__factory,
} from 'types/typechain';
import { ZERO } from 'utils/bigNumber';

const INITIAL_STATE: StakingService = {
  apy: 0,
  exitQueueData: {
    lastClaimableEpochAt: 0,
    claimableTemple: 0,
    totalTempleOwned: 0,
    claimableEpochs: [],
  },
  lockedEntries: [],
  stake: asyncNoop,
  unstake: asyncNoop,
  updateLockedEntries: asyncNoop,
  claimOgTemple: asyncNoop,
  getRewardsForOGT: asyncNoop,
  updateApy: asyncNoop,
};

const StakingContext = createContext<StakingService>(INITIAL_STATE);

// eslint-disable-next-line @typescript-eslint/ban-types
export const StakingProvider = (props: PropsWithChildren<{}>) => {
  const [apy, setApy] = useState(0);
  const [exitQueueData, setExitQueueData] = useState<ExitQueueData>(
    INITIAL_STATE.exitQueueData
  );
  const [lockedEntries, setLockedEntries] = useState<Array<LockedEntry>>(
    INITIAL_STATE.lockedEntries
  );

  const { wallet, signer, getBalance, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();

  const getApy = async (walletAddress: string, signerState: Signer) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }
    const TEMPLE_STAKING = new TempleStaking__factory(signerState).attach(
      env.contracts.templeStaking
    );
    const SCALE_FACTOR = 10000;
    const epy = (await TEMPLE_STAKING.getEpy(SCALE_FACTOR)).toNumber();
    return Math.trunc((Math.pow(epy / SCALE_FACTOR + 1, 365.25) - 1) * 100);
  };

  const getRewardsForOGTemple = async (
    walletAddress: string,
    signerState: Signer,
    ogtAmount: BigNumber
  ) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }
    if (!env.contracts.templeStaking) return ZERO;
    const STAKING = new TempleStaking__factory(signerState).attach(
      env.contracts.templeStaking
    );
    return await STAKING.balance(ogtAmount);
  };

  const getLockedEntries = async (
    walletAddress: string,
    signerState: Signer
  ) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }
    if (!env.contracts.lockedOgTemple) return [];

    const ogLockedTemple = new LockedOGTemple__factory(signerState).attach(
      env.contracts.lockedOgTemple
    );

    const lockedNum = (await ogLockedTemple.numLocks(walletAddress)).toNumber();
    const lockedEntriesPromises = [];
    for (let i = 0; i < lockedNum; i++) {
      lockedEntriesPromises.push(ogLockedTemple.locked(walletAddress, i));
    }

    const lockedEntries = await Promise.all(lockedEntriesPromises);
    const lockedEntriesVals: Array<LockedEntry> = lockedEntries.map(
      (entry, index) => {
        return {
          // chain timestamp is in second => we need milli
          lockedUntilTimestamp: entry.LockedUntilTimestamp.toNumber() * 1000,
          balanceOGTemple: entry.BalanceOGTemple,
          index,
        };
      }
    );

    return lockedEntriesVals;
  };

  const updateApy = async () => {
    if (!wallet || !signer) {
      return;
    }
    const apy = await getApy(wallet, signer);
    setApy(apy);
  };

  const updateLockedEntries = async () => {
    if (!wallet || !signer) {
      return;
    }
    const lockedEntries = await getLockedEntries(wallet, signer);
    setLockedEntries(lockedEntries);
  };

  const stake = async (amountToStake: BigNumber) => {
    if (wallet && signer) {
      const TEMPLE_STAKING = new TempleStaking__factory(signer).attach(
        env.contracts.templeStaking
      );
      const TEMPLE = new TempleERC20Token__factory(signer).attach(
        env.contracts.temple
      );

      await ensureAllowance(
        TICKER_SYMBOL.TEMPLE_TOKEN,
        TEMPLE,
        env.contracts.templeStaking,
        amountToStake
      );

      const balance = await TEMPLE.balanceOf(wallet);
      const verifiedAmountToStake = amountToStake.lt(balance)
        ? amountToStake
        : balance;

      const stakeTXN = await TEMPLE_STAKING.stake(verifiedAmountToStake, {
        gasLimit: env.gas?.stake || 150000,
      });
      await stakeTXN.wait();

      // Show feedback to user
      openNotification({
        title: `${TICKER_SYMBOL.TEMPLE_TOKEN} staked`,
        hash: stakeTXN.hash,
      });
    }
  };

  const unstake = async (amount: BigNumber) => {
    if (wallet && signer) {
      const TEMPLE_STAKING = new TempleStaking__factory(signer).attach(
        env.contracts.templeStaking
      );

      const OGTContract = new OGTemple__factory(signer).attach(
        env.contracts.ogTemple
      );

      try {
        const ogTempleBalance: BigNumber = await OGTContract.balanceOf(wallet);
        // ensure user input is not greater than user balance. if greater use all user balance.
        const offering = amount.lte(ogTempleBalance) ? amount : ogTempleBalance;

        const unstakeTXN = await TEMPLE_STAKING.unstake(offering, {
          gasLimit: Number(env.gas?.unstakeBase || 300000),
        });

        await unstakeTXN.wait();
        // Show feedback to user
        openNotification({
          title: 'Unstake successful',
          hash: unstakeTXN.hash,
        });
      } catch (e) {
        /* TODO: Set a notification transaction has failed */
        console.info(`error: ${JSON.stringify(e, null, 2)}`);
      }
    }
  };

  const getRewardsForOGT = async (ogtAmount: BigNumber) => {
    if (!wallet || !signer) {
      return;
    }
    const rewards = await getRewardsForOGTemple(wallet, signer, ogtAmount);
    return rewards;
  };

  const claimOgTemple = async (lockedEntryIndex: number) => {
    if (wallet && signer) {
      const lockedOGTempleContract = new LockedOGTemple__factory(signer).attach(
        env.contracts.lockedOgTemple
      );

      const withdrawTXN = await lockedOGTempleContract.withdraw(
        lockedEntryIndex,
        {
          gasLimit: env.gas?.claimOgTemple || 100000,
        }
      );

      await withdrawTXN.wait();

      openNotification({
        title: `${TICKER_SYMBOL.OG_TEMPLE_TOKEN} claimed`,
        hash: withdrawTXN.hash,
      });
    }
  };

  return (
    <StakingContext.Provider
      value={{
        apy,
        exitQueueData,
        lockedEntries,
        stake,
        unstake,
        updateLockedEntries,
        claimOgTemple,
        getRewardsForOGT,
        updateApy,
      }}
    >
      {props.children}
    </StakingContext.Provider>
  );
};

export const useStaking = () => useContext(StakingContext);
