import {
  useState,
  createContext,
  useContext,
  PropsWithChildren,
} from 'react';
import { BigNumber, ethers, Signer } from 'ethers';
import { useWallet } from 'providers/WalletProvider';
import { useNotification } from 'providers/NotificationProvider';
import { getEpochsToDays } from 'providers/util';
import { NoWalletAddressError } from 'providers/errors';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { asyncNoop } from 'utils/helpers';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import {
  LOCKED_OG_TEMPLE_ADDRESS,
  LOCKED_OG_TEMPLE_DEVOTION_ADDRESS,
  TEMPLE_ADDRESS,
  EXIT_QUEUE_ADDRESS,
  ACCELERATED_EXIT_QUEUE_ADDRESS,
  TEMPLE_STAKING_ADDRESS,
  VITE_PUBLIC_WITHDRAW_EPOCHS_BASE_GAS_LIMIT,
  VITE_PUBLIC_WITHDRAW_EPOCHS_PER_EPOCH_GAS_LIMIT,
  VITE_PUBLIC_TEMPLE_STAKING_UNSTAKE_BASE_GAS_LIMIT,
  VITE_PUBLIC_TEMPLE_STAKING_UNSTAKE_PER_EPOCH_GAS_LIMIT,
  VITE_PUBLIC_RESTAKE_EPOCHS_BASE_GAS_LIMIT,
  VITE_PUBLIC_RESTAKE_EPOCHS_PER_EPOCH_GAS_LIMIT,
  VITE_PUBLIC_STAKE_GAS_LIMIT,
  VITE_PUBLIC_CLAIM_OGTEMPLE_GAS_LIMIT,
} from 'providers/env';
import {
  StakingService,
  JoinQueueData,
  ExitQueueData,
  LockedEntry,
} from 'providers/types';
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
      TEMPLE_STAKING_ADDRESS
    );

    const SCALE_FACTOR = 10000;
    const epy = (await TEMPLE_STAKING.getEpy(SCALE_FACTOR)).toNumber();
    return Math.trunc((Math.pow(epy / SCALE_FACTOR + 1, 365.25) - 1) * 100);
  };

  const getRewardsForOGTemple = async (
    walletAddress: string,
    signerState: Signer,
    ogtAmount: number
  ) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const STAKING = new TempleStaking__factory(signerState).attach(
      TEMPLE_STAKING_ADDRESS
    );

    return fromAtto(await STAKING.balance(toAtto(ogtAmount)));
  };

  const getLockedEntries = async (
    walletAddress: string,
    signerState: Signer
  ) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const ogLockedTemple = new LockedOGTempleDeprecated__factory(
      signerState
    ).attach(LOCKED_OG_TEMPLE_ADDRESS);

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
          balanceOGTemple: fromAtto(entry.BalanceOGTemple),
          index,
        };
      }
    );

    // get ogTempleLocked from new Contract
    const ogLockedTempleNew = new LockedOGTemple__factory(signerState).attach(
      LOCKED_OG_TEMPLE_DEVOTION_ADDRESS
    );

    const newEntry = await ogLockedTempleNew.ogTempleLocked(walletAddress);
    lockedEntriesVals.push({
      balanceOGTemple: fromAtto(newEntry.amount),
      lockedUntilTimestamp: newEntry.lockedUntilTimestamp.toNumber() * 1000,
      index: lockedEntriesVals.length,
    });

    return lockedEntriesVals;
  };

  const getExitQueueData = async (
    walletAddress: string,
    signerState: Signer
  ) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const EXIT_QUEUE = new ExitQueue__factory(signerState).attach(
      EXIT_QUEUE_ADDRESS
    );

    const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(
      signerState
    ).attach(ACCELERATED_EXIT_QUEUE_ADDRESS);

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

    const currentEpoch = (
      await ACCELERATED_EXIT_QUEUE.currentEpoch()
    ).toNumber();
    const firstEpoch = userData.FirstExitEpoch.toNumber();
    const lastEpoch = userData.LastExitEpoch.toNumber();
    const todayInMs = new Date().getTime();
    const dayInMs = 8.64e7;
    const daysUntilLastClaimableEpoch = await getEpochsToDays(
      lastEpoch - currentEpoch + 1,
      signerState
    );
    const lastClaimableEpochAt =
      todayInMs + daysUntilLastClaimableEpoch * dayInMs;

    const exitEntryPromises = [];

    // stores all epochs address has in the ExitQueue.sol, some might have Allocation 0
    const maybeClaimableEpochs: Array<number> = [];
    // stores all epochs with allocations for address
    const claimableEpochs: Array<number> = [];
    for (let i = firstEpoch; i < currentEpoch; i++) {
      maybeClaimableEpochs.push(i);
      exitEntryPromises.push(
        EXIT_QUEUE.currentEpochAllocation(walletAddress, i)
      );
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

  const updateExitQueueData = async () => {
    if (!wallet || !signer) {
      return;
    }
    console.log('updateExitQueueData start');
    const exitQueueData = await getExitQueueData(wallet, signer);
    console.log('updateExitQueueData end')
    setExitQueueData(exitQueueData);
  };

  const updateApy = async () => {
    if (!wallet || !signer) {
      return;
    }
    console.log('updateApy start')
    const apy = await getApy(wallet, signer);
    console.log('updateApy end')
    setApy(apy);
  };

  const updateLockedEntries = async () => {
    if (!wallet || !signer) {
      return;
    }
    console.log('updateLockedEntries start')
    const lockedEntries = await getLockedEntries(wallet, signer);
    console.log('updateLockedEntries end')
    setLockedEntries(lockedEntries);
  };

  const restakeAvailableTemple = async (): Promise<void> => {
    if (wallet && signer) {
      const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(
        signer
      ).attach(ACCELERATED_EXIT_QUEUE_ADDRESS);

      const EXIT_QUEUE = new ExitQueue__factory(signer).attach(
        EXIT_QUEUE_ADDRESS
      );

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
        const baseCase = VITE_PUBLIC_RESTAKE_EPOCHS_BASE_GAS_LIMIT || 175000;
        const perEpoch =
          VITE_PUBLIC_RESTAKE_EPOCHS_PER_EPOCH_GAS_LIMIT || 20000;
        const recommendedGas =
          Number(baseCase) + Number(perEpoch) * claimableEpochs.length;

        const restakeTXN = await ACCELERATED_EXIT_QUEUE.restake(
          claimableEpochs,
          claimableEpochs.length,
          {
            gasLimit: recommendedGas || 500000,
          }
        );

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

  const getJoinQueueData = async (
    ogtAmount: BigNumber
  ): Promise<JoinQueueData | void> => {
    if (wallet && signer) {
      const EXIT_QUEUE = new ExitQueue__factory(signer).attach(
        EXIT_QUEUE_ADDRESS
      );
      const STAKING = new TempleStaking__factory(signer).attach(
        TEMPLE_STAKING_ADDRESS
      );
      const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(
        signer
      ).attach(ACCELERATED_EXIT_QUEUE_ADDRESS);

      const maxPerAddress = await EXIT_QUEUE.maxPerAddress();
      const maxPerEpoch = await EXIT_QUEUE.maxPerEpoch();
      const maxPerAddressPerEpoch = maxPerAddress.lt(maxPerEpoch)
        ? maxPerAddress
        : maxPerEpoch;

      const nextUnallocatedEpoch = await EXIT_QUEUE.nextUnallocatedEpoch();
      const currentEpoch = await ACCELERATED_EXIT_QUEUE.currentEpoch();
      const amountTemple = await STAKING.balance(ogtAmount);

      const queueLengthEpochs = nextUnallocatedEpoch
        .sub(currentEpoch)
        .toNumber();

      // number of blocks to process, always rounding up
      const processTimeEpochs =
        amountTemple.div(maxPerAddressPerEpoch).toNumber() +
        (amountTemple.mod(maxPerAddressPerEpoch).eq(0) ? 0 : 1);

      return {
        queueLength: await getEpochsToDays(
          queueLengthEpochs >= 0 ? queueLengthEpochs : 0,
          signer
        ),
        processTime: await getEpochsToDays(processTimeEpochs, signer),
      };
    }
  };

  const stake = async (amountToStake: BigNumber) => {
    if (wallet && signer) {
      console.info(`staking START`);
      const TEMPLE_STAKING = new TempleStaking__factory(signer).attach(
        TEMPLE_STAKING_ADDRESS
      );

      const TEMPLE = new TempleERC20Token__factory(signer).attach(
        TEMPLE_ADDRESS
      );

      await ensureAllowance(
        TICKER_SYMBOL.TEMPLE_TOKEN,
        TEMPLE,
        TEMPLE_STAKING_ADDRESS,
        amountToStake
      );

      const balance = await TEMPLE.balanceOf(wallet);
      const verifiedAmountToStake = amountToStake.lt(balance)
        ? amountToStake
        : balance;

      const stakeTXN = await TEMPLE_STAKING.stake(verifiedAmountToStake, {
        gasLimit: VITE_PUBLIC_STAKE_GAS_LIMIT || 150000,
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
        TEMPLE_STAKING_ADDRESS
      );

      const OGTContract = new OGTemple__factory(signer).attach(
        await TEMPLE_STAKING.OG_TEMPLE()
      );

      const EXIT_QUEUE = new ExitQueue__factory(signer).attach(
        EXIT_QUEUE_ADDRESS
      );

      try {
        const ogTempleBalance: BigNumber = await OGTContract.balanceOf(wallet);
        // ensure user input is not greater than user balance. if greater use all user balance.
        const offering = amount.lte(ogTempleBalance) ? amount : ogTempleBalance;
        const baseGas = Number(
          VITE_PUBLIC_TEMPLE_STAKING_UNSTAKE_BASE_GAS_LIMIT || 300000
        );
        const gasPerEpoch = Number(
          VITE_PUBLIC_TEMPLE_STAKING_UNSTAKE_PER_EPOCH_GAS_LIMIT || 20000
        );
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
      const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(
        signer
      ).attach(ACCELERATED_EXIT_QUEUE_ADDRESS);

      if (exitQueueData.claimableEpochs.length) {
        const baseCase = VITE_PUBLIC_WITHDRAW_EPOCHS_BASE_GAS_LIMIT || 60000;
        const perEpoch =
          VITE_PUBLIC_WITHDRAW_EPOCHS_PER_EPOCH_GAS_LIMIT || 15000;
        const recommendedGas =
          Number(baseCase) +
          Number(perEpoch) * exitQueueData.claimableEpochs.length;

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

  const getRewardsForOGT = async (
    ogtAmount: number
  ): Promise<number | void> => {
    if (!wallet || !signer) {
      return;
    }

    const rewards = await getRewardsForOGTemple(wallet, signer, ogtAmount);
    return rewards;
  };

  const claimOgTemple = async (lockedEntryIndex: number) => {
    if (wallet && signer) {
      const lockedOGTempleContract = new LockedOGTempleDeprecated__factory(
        signer
      ).attach(LOCKED_OG_TEMPLE_ADDRESS);

      const withdrawTXN = await lockedOGTempleContract.withdraw(
        lockedEntryIndex,
        {
          gasLimit: VITE_PUBLIC_CLAIM_OGTEMPLE_GAS_LIMIT || 100000,
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
