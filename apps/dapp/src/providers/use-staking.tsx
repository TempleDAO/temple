import React, { useState, createContext, useContext } from 'react';
import { BigNumber } from 'ethers';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { fromAtto } from 'utils/bigNumber';
import { asyncNoop } from 'utils/helpers';
import { useWallet } from 'providers/WalletProvider';
import {
  getEpochsToDays,
  getExitQueueData,
} from 'providers/WalletProvider/util';
import { useNotification } from 'providers/NotificationProvider';
import {
  EXIT_QUEUE_ADDRESS,
  ACCELERATED_EXIT_QUEUE_ADDRESS,
  TEMPLE_STAKING_ADDRESS,
  TEMPLE_ADDRESS,
  VITE_PUBLIC_WITHDRAW_EPOCHS_BASE_GAS_LIMIT,
  VITE_PUBLIC_WITHDRAW_EPOCHS_PER_EPOCH_GAS_LIMIT,
  VITE_PUBLIC_RESTAKE_EPOCHS_BASE_GAS_LIMIT,
  VITE_PUBLIC_RESTAKE_EPOCHS_PER_EPOCH_GAS_LIMIT,
  VITE_PUBLIC_STAKE_GAS_LIMIT,
} from 'providers/WalletProvider/env';
import {
  StakingService,
  JoinQueueData,
  ExitQueueData,
} from 'providers/WalletProvider/types';
import {
  AcceleratedExitQueue__factory,
  ExitQueue__factory,
  TempleERC20Token__factory,
  TempleStaking__factory,
} from 'types/typechain';

const INITIAL_STATE: StakingService = {
  exitQueueData: {
    lastClaimableEpochAt: 0,
    claimableTemple: 0,
    totalTempleOwned: 0,
    claimableEpochs: [],
  },
  stake: asyncNoop,
  claimAvailableTemple: asyncNoop,
  restakeAvailableTemple: asyncNoop,
  getJoinQueueData: asyncNoop,
  getExitQueueData: asyncNoop,
};

const StakingContext = createContext<StakingService>(INITIAL_STATE);

export const StakingProvider = () => {
  const [exitQueueData, setExitQueueData] = useState<ExitQueueData>(
    INITIAL_STATE.exitQueueData
  );

  const { wallet, signer, getBalance, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();

  const updateExitQueueData = async () => {
    if (!wallet || !signer) {
      return;
    }

    const exitQueueData = await getExitQueueData(wallet, signer);
    setExitQueueData(exitQueueData);
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

  return (
    <StakingContext.Provider
      value={{
        stake,
        exitQueueData,
        claimAvailableTemple,
        restakeAvailableTemple,
        getJoinQueueData,
        getExitQueueData: updateExitQueueData,
      }}
    />
  );
};

export const useStaking = () => useContext(StakingContext);
