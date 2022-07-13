import { useState, createContext, useContext, PropsWithChildren } from 'react';
import { BigNumber, Signer } from 'ethers';
import { useWallet } from 'providers/WalletProvider';
import { useNotification } from 'providers/NotificationProvider';
import { getEpochsToDays } from 'providers/util';
import { NoWalletAddressError } from 'providers/errors';
import { fromAtto } from 'utils/bigNumber';
import { asyncNoop } from 'utils/helpers';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import env from 'constants/env';
import { StakingService, JoinQueueData, ExitQueueData, LockedEntry } from 'providers/types';
import {
  AcceleratedExitQueue__factory,
  ExitQueue__factory,
  OGTemple__factory,
  TempleERC20Token__factory,
  TempleStaking__factory,
  LockedOGTemple__factory,
  LockedOGTempleDeprecated__factory,
} from 'types/typechain';

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
  claimAvailableTemple: asyncNoop,
  restakeAvailableTemple: asyncNoop,
  getJoinQueueData: asyncNoop,
  getExitQueueData: asyncNoop,
  updateLockedEntries: asyncNoop,
  claimOgTemple: asyncNoop,
  getRewardsForOGT: asyncNoop,
  updateApy: asyncNoop,
};

const StakingContext = createContext<StakingService>(INITIAL_STATE);

export const StakingProvider = (props: PropsWithChildren<{}>) => {
  const [apy, setApy] = useState(0);
  const [exitQueueData, setExitQueueData] = useState<ExitQueueData>(INITIAL_STATE.exitQueueData);
  const [lockedEntries, setLockedEntries] = useState<Array<LockedEntry>>(INITIAL_STATE.lockedEntries);

  const { wallet, signer, getBalance, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();

  const getApy = async (walletAddress: string, signerState: Signer) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const TEMPLE_STAKING = new TempleStaking__factory(signerState).attach(env.contracts.templeStaking);

    const SCALE_FACTOR = 10000;
    const epy = (await TEMPLE_STAKING.getEpy(SCALE_FACTOR)).toNumber();
    return Math.trunc((Math.pow(epy / SCALE_FACTOR + 1, 365.25) - 1) * 100);
  };

  const getRewardsForOGTemple = async (walletAddress: string, signerState: Signer, ogtAmount: BigNumber) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const STAKING = new TempleStaking__factory(signerState).attach(env.contracts.templeStaking);

    return await STAKING.balance(ogtAmount);
  };

  const getLockedEntries = async (walletAddress: string, signerState: Signer) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const ogLockedTemple = new LockedOGTempleDeprecated__factory(signerState).attach(env.contracts.ogTemple);

    const lockedNum = (await ogLockedTemple.numLocks(walletAddress)).toNumber();
    const lockedEntriesPromises = [];
    for (let i = 0; i < lockedNum; i++) {
      lockedEntriesPromises.push(ogLockedTemple.locked(walletAddress, i));
    }

    const lockedEntries = await Promise.all(lockedEntriesPromises);
    const lockedEntriesVals: Array<LockedEntry> = lockedEntries.map((entry, index) => {
      return {
        // chain timestamp is in second => we need milli
        lockedUntilTimestamp: entry.LockedUntilTimestamp.toNumber() * 1000,
        balanceOGTemple: entry.BalanceOGTemple,
        index,
      };
    });

    // get ogTempleLocked from new Contract
    const ogLockedTempleNew = new LockedOGTemple__factory(signerState).attach(env.contracts.ogTemple);

    const newEntry = await ogLockedTempleNew.ogTempleLocked(walletAddress);
    lockedEntriesVals.push({
      balanceOGTemple: newEntry.amount,
      lockedUntilTimestamp: newEntry.lockedUntilTimestamp.toNumber() * 1000,
      index: lockedEntriesVals.length,
    });

    return lockedEntriesVals;
  };

  const getExitQueueData = async (walletAddress: string, signerState: Signer) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const EXIT_QUEUE = new ExitQueue__factory(signerState).attach(env.contracts.exitQueue);

    const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(signerState).attach(env.contracts.exitQueue);

    const userData = await EXIT_QUEUE.userData(walletAddress);
    const totalTempleOwned = fromAtto(userData.Amount);

    if (totalTempleOwned === 0) {
      return {
        lastClaimableEpochAt: 0,
        claimableTemple: 0,
        totalTempleOwned: 0,
        claimableEpochs: [],
      };
    }

    const currentEpoch = (await ACCELERATED_EXIT_QUEUE.currentEpoch()).toNumber();
    const firstEpoch = userData.FirstExitEpoch.toNumber();
    const lastEpoch = userData.LastExitEpoch.toNumber();
    const todayInMs = new Date().getTime();
    const dayInMs = 8.64e7;
    const daysUntilLastClaimableEpoch = await getEpochsToDays(lastEpoch - currentEpoch + 1, signerState);
    const lastClaimableEpochAt = todayInMs + daysUntilLastClaimableEpoch * dayInMs;

    const exitEntryPromises = [];

    // stores all epochs address has in the ExitQueue.sol, some might have Allocation 0
    const maybeClaimableEpochs: Array<number> = [];
    // stores all epochs with allocations for address
    const claimableEpochs: Array<number> = [];
    for (let i = firstEpoch; i < currentEpoch; i++) {
      maybeClaimableEpochs.push(i);
      exitEntryPromises.push(EXIT_QUEUE.currentEpochAllocation(walletAddress, i));
    }

    const exitEntries = await Promise.all(exitEntryPromises);
    const claimableTemple: number = fromAtto(
      exitEntries.reduce((prev, curr, index) => {
        // the contract is not removing the user.Exits[epoch], so we only get the ones with a claimable amount(anything above 0)
        if (fromAtto(curr) > 0) {
          claimableEpochs.push(maybeClaimableEpochs[index]);
        }
        return prev.add(curr);
      }, BigNumber.from(0))
    );

    return {
      lastClaimableEpochAt,
      claimableTemple,
      totalTempleOwned,
      claimableEpochs,
    };
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

  const restakeAvailableTemple = async (): Promise<void> => {
    if (wallet && signer) {
      const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(signer).attach(env.contracts.exitQueue);

      const EXIT_QUEUE = new ExitQueue__factory(signer).attach(env.contracts.exitQueue);

      const userData = await EXIT_QUEUE.userData(wallet);

      const firstEpoch = userData.FirstExitEpoch.toNumber();
      const lastEpoch = userData.LastExitEpoch.toNumber();
      const exitEntryPromises = [];

      // stores all epochs address has in the ExitQueue.sol, some might have Allocation 0
      const maybeClaimableEpochs: Array<number> = [];
      // stores all epochs with allocations for address
      const claimableEpochs: Array<number> = [];

      for (let i = firstEpoch; i <= lastEpoch; i++) {
        maybeClaimableEpochs.push(i);
        exitEntryPromises.push(EXIT_QUEUE.currentEpochAllocation(wallet, i));
      }

      const exitEntries = await Promise.all(exitEntryPromises);
      exitEntries.reduce((prev, curr, index) => {
        // the contract is not removing the user.Exits[epoch], so we only get the ones with a claimable amount(anything above 0)
        if (fromAtto(curr) > 0) {
          claimableEpochs.push(maybeClaimableEpochs[index]);
        }
        return prev.add(curr);
      }, BigNumber.from(0));

      if (claimableEpochs.length) {
        const baseCase = env.gas?.restakeBase || 175000;
        const perEpoch = env.gas?.restakePerEpoch || 20000;
        const recommendedGas = Number(baseCase) + Number(perEpoch) * claimableEpochs.length;

        const restakeTXN = await ACCELERATED_EXIT_QUEUE.restake(claimableEpochs, claimableEpochs.length, {
          gasLimit: recommendedGas || 500000,
        });

        await restakeTXN.wait();
        // Show feedback to user
        openNotification({
          title: `${TICKER_SYMBOL.TEMPLE_TOKEN} restaked`,
          hash: restakeTXN.hash,
        });
      }
      getBalance();
    }
  };

  const getJoinQueueData = async (ogtAmount: BigNumber): Promise<JoinQueueData | void> => {
    if (wallet && signer) {
      const EXIT_QUEUE = new ExitQueue__factory(signer).attach(env.contracts.exitQueue);
      const STAKING = new TempleStaking__factory(signer).attach(env.contracts.templeStaking);
      const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(signer).attach(env.contracts.exitQueue);

      const maxPerAddress = await EXIT_QUEUE.maxPerAddress();
      const maxPerEpoch = await EXIT_QUEUE.maxPerEpoch();
      const maxPerAddressPerEpoch = maxPerAddress.lt(maxPerEpoch) ? maxPerAddress : maxPerEpoch;

      const nextUnallocatedEpoch = await EXIT_QUEUE.nextUnallocatedEpoch();
      const currentEpoch = await ACCELERATED_EXIT_QUEUE.currentEpoch();
      const amountTemple = await STAKING.balance(ogtAmount);

      const queueLengthEpochs = nextUnallocatedEpoch.sub(currentEpoch).toNumber();

      // number of blocks to process, always rounding up
      const processTimeEpochs =
        amountTemple.div(maxPerAddressPerEpoch).toNumber() + (amountTemple.mod(maxPerAddressPerEpoch).eq(0) ? 0 : 1);

      return {
        queueLength: await getEpochsToDays(queueLengthEpochs >= 0 ? queueLengthEpochs : 0, signer),
        processTime: await getEpochsToDays(processTimeEpochs, signer),
      };
    }
  };

  const stake = async (amountToStake: BigNumber) => {
    if (wallet && signer) {
      const TEMPLE_STAKING = new TempleStaking__factory(signer).attach(env.contracts.templeStaking);

      const TEMPLE = new TempleERC20Token__factory(signer).attach(env.contracts.temple);

      await ensureAllowance(TICKER_SYMBOL.TEMPLE_TOKEN, TEMPLE, env.contracts.templeStaking, amountToStake);

      const balance = await TEMPLE.balanceOf(wallet);
      const verifiedAmountToStake = amountToStake.lt(balance) ? amountToStake : balance;

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
      const TEMPLE_STAKING = new TempleStaking__factory(signer).attach(env.contracts.templeStaking);

      const OGTContract = new OGTemple__factory(signer).attach(await TEMPLE_STAKING.OG_TEMPLE());

      const EXIT_QUEUE = new ExitQueue__factory(signer).attach(env.contracts.exitQueue);

      try {
        const ogTempleBalance: BigNumber = await OGTContract.balanceOf(wallet);
        // ensure user input is not greater than user balance. if greater use all user balance.
        const offering = amount.lte(ogTempleBalance) ? amount : ogTempleBalance;
        const baseGas = Number(env.gas?.unstakeBase || 300000);
        const gasPerEpoch = Number(env.gas?.unstakePerEpoch || 20000);
        const accFactor = await TEMPLE_STAKING.accumulationFactor();
        const maxPerEpoch = await EXIT_QUEUE.maxPerEpoch();
        const epochs = fromAtto(offering.mul(accFactor).div(maxPerEpoch));
        const recommendedGas = Math.ceil(baseGas + gasPerEpoch * epochs);

        const unstakeTXN = await TEMPLE_STAKING.unstake(offering, {
          gasLimit: recommendedGas < 30000000 ? recommendedGas : 30000000,
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

  const claimAvailableTemple = async (): Promise<void> => {
    if (wallet && signer) {
      const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(signer).attach(env.contracts.exitQueue);

      if (exitQueueData.claimableEpochs.length) {
        const baseCase = env.gas?.widthrawBase || 60000;
        const perEpoch = env.gas?.widthrawPerEpoch || 15000;
        const recommendedGas = Number(baseCase) + Number(perEpoch) * exitQueueData.claimableEpochs.length;

        const withdrawTXN = await ACCELERATED_EXIT_QUEUE.withdrawEpochs(
          exitQueueData.claimableEpochs,
          exitQueueData.claimableEpochs.length,
          {
            gasLimit: recommendedGas || 150000,
          }
        );

        await withdrawTXN.wait();
        // Show feedback to user
        openNotification({
          title: `${TICKER_SYMBOL.TEMPLE_TOKEN} claimed`,
          hash: withdrawTXN.hash,
        });
      }
      getBalance();
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
      const lockedOGTempleContract = new LockedOGTempleDeprecated__factory(signer).attach(env.contracts.ogTemple);

      const withdrawTXN = await lockedOGTempleContract.withdraw(lockedEntryIndex, {
        gasLimit: env.gas?.claimOgTemple || 100000,
      });

      await withdrawTXN.wait();

      openNotification({
        title: `${TICKER_SYMBOL.OG_TEMPLE_TOKEN} claimed`,
        hash: withdrawTXN.hash,
      });
    }
  };

  const updateExitQueueData = async () => {
    if (!wallet || !signer) {
      return;
    }

    // const exitQueueData = await getExitQueueData(wallet, signer);
    // setExitQueueData(exitQueueData);
  };

  return (
    <StakingContext.Provider
      value={{
        apy,
        exitQueueData,
        lockedEntries,
        stake,
        unstake,
        claimAvailableTemple,
        restakeAvailableTemple,
        getJoinQueueData,
        getExitQueueData: updateExitQueueData,
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
