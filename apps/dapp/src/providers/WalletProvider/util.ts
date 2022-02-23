import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';

import {
  AcceleratedExitQueue__factory,
  ERC20__factory,
  ExitQueue__factory,
  Faith__factory,
  LockedOGTemple__factory,
  LockedOGTempleDeprecated__factory,
  OGTemple__factory,
  OpeningCeremony__factory,
  TempleERC20Token__factory,
  TempleStaking__factory,
  TempleTreasury__factory,
  TempleUniswapV2Pair__factory,
} from 'types/typechain';

import { BigNumber } from 'ethers';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { formatNumber, formatNumberFixedDecimals } from 'utils/formatter';

import {
  TEMPLE_V2_PAIR_ADDRESS,
  TEMPLE_FAITH_ADDRESS,
  OPENING_CEREMONY_ADDRESS,
  TREASURY_ADDRESS,
  TEMPLE_STAKING_ADDRESS,
  STABLE_COIN_ADDRESS,
  LOCKED_OG_TEMPLE_ADDRESS,
  LOCKED_OG_TEMPLE_DEVOTION_ADDRESS,
  TEMPLE_ADDRESS,
  EXIT_QUEUE_ADDRESS,
  ACCELERATED_EXIT_QUEUE_ADDRESS,
} from './env';

import { OpeningCeremonyUser, LockedEntry } from './types';

import { NoWalletAddressError } from './errors';
import { Nullable } from 'types/util';

export const getTemplePrice = async (
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

export const getCurrentEpoch = async (provider: JsonRpcProvider) => {
  const blockNumber = await provider.getBlockNumber();
  const currentBlockTimestamp = (await provider.getBlock(blockNumber))
    .timestamp;
  // block timestamps are in seconds no ms
  return currentBlockTimestamp * 1000;
};

export const getExchangeRate = async (
  walletAddress: string,
  signerState: JsonRpcSigner
) => {
  if (!walletAddress) {
    throw new NoWalletAddressError();
  }

  const treasury = new TempleTreasury__factory(signerState).attach(
    TREASURY_ADDRESS
  );

  const iv = await treasury.intrinsicValueRatio();
  const { temple, stablec } = iv;
  const mintMultiple = 6.0;
  const rate = fromAtto(temple) / fromAtto(stablec) / mintMultiple;
  return rate;
};

export const getBalance = async (
  walletAddress: string,
  signerState: JsonRpcSigner
) => {
  if (!walletAddress) {
    throw new NoWalletAddressError();
  }

  const stableCoinContract = new ERC20__factory(signerState).attach(
    STABLE_COIN_ADDRESS
  );

  const ogLockedTemple = new LockedOGTempleDeprecated__factory(
    signerState
  ).attach(LOCKED_OG_TEMPLE_ADDRESS);

  const OGTEMPLE_LOCKED_DEVOTION = new LockedOGTemple__factory(
    signerState
  ).attach(LOCKED_OG_TEMPLE_DEVOTION_ADDRESS);

  const templeStakingContract = new TempleStaking__factory(signerState).attach(
    TEMPLE_STAKING_ADDRESS
  );

  const OG_TEMPLE_CONTRACT = new OGTemple__factory(signerState).attach(
    await templeStakingContract.OG_TEMPLE()
  );

  const templeContract = new TempleERC20Token__factory(signerState).attach(
    TEMPLE_ADDRESS
  );

  const stableCoinBalance: BigNumber = await stableCoinContract.balanceOf(
    walletAddress
  );

  // get the locked OG temple
  const lockedNum = (await ogLockedTemple.numLocks(walletAddress)).toNumber();
  let ogTempleLocked = 0;
  let ogTempleLockedClaimable = 0;
  const templeLockedPromises = [];
  for (let i = 0; i < lockedNum; i++) {
    templeLockedPromises.push(ogLockedTemple.locked(walletAddress, i));
  }

  const now = formatNumberFixedDecimals(Date.now() / 1000, 0);
  const templeLocked = await Promise.all(templeLockedPromises);
  templeLocked.map((x) => {
    ogTempleLocked += fromAtto(x.BalanceOGTemple);
    if (x.LockedUntilTimestamp.lte(BigNumber.from(now))) {
      ogTempleLockedClaimable += fromAtto(x.BalanceOGTemple);
    }
  });

  const ogTemple = fromAtto(await OG_TEMPLE_CONTRACT.balanceOf(walletAddress));
  const temple = fromAtto(await templeContract.balanceOf(walletAddress));

  const lockedOGTempleEntry = await OGTEMPLE_LOCKED_DEVOTION.ogTempleLocked(
    walletAddress
  );

  return {
    stableCoin: fromAtto(stableCoinBalance),
    temple: temple,
    ogTempleLocked: ogTempleLocked + fromAtto(lockedOGTempleEntry.amount),
    ogTemple: ogTemple >= 1 ? ogTemple : 0,
    ogTempleLockedClaimable: ogTempleLockedClaimable,
  };
};

export const getFaith = async (
  walletAddress: string,
  signerState: JsonRpcSigner
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

export const getAllocation = async (
  walletAddress: string,
  signerState: JsonRpcSigner,
  ocTemplar: OpeningCeremonyUser
) => {
  if (!walletAddress) {
    throw new NoWalletAddressError();
  }

  const openingCeremony = new OpeningCeremony__factory(signerState).attach(
    OPENING_CEREMONY_ADDRESS
  );

  const allocation: number = ocTemplar.isVerified
    ? fromAtto(
        await openingCeremony.maxSacrificableStablec(
          ocTemplar.doublingIndexAtVerification
        )
      )
    : ocTemplar.isGuest
    ? 10000
    : 0;

  return {
    amount: allocation - ocTemplar.totalSacrificedStablec,
    //they can start right away once verified
    startEpoch: 1,
  };
};

export const getLockedEntries = async (
  walletAddress: string,
  signerState: JsonRpcSigner
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

export const getExitQueueData = async (
  walletAddress: string,
  signerState: JsonRpcSigner
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

  const currentEpoch = (await ACCELERATED_EXIT_QUEUE.currentEpoch()).toNumber();
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

export const getEpochsToDays = async (
  epochs: number,
  signerState: Nullable<JsonRpcSigner>
) => {
  if (!signerState) {
    return 0;
  }

  const EXIT_QUEUE = new ExitQueue__factory(signerState).attach(
    EXIT_QUEUE_ADDRESS
  );

  const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(
    signerState
  ).attach(ACCELERATED_EXIT_QUEUE_ADDRESS);

  const MAINNET_APROX_BLOCKS_PER_DAY = 6400;
  const epochSizeInBlocks = (await EXIT_QUEUE.epochSize()).toNumber();
  const epochsPerDay = MAINNET_APROX_BLOCKS_PER_DAY / epochSizeInBlocks;

  const accelerationStartEpoch =
    await ACCELERATED_EXIT_QUEUE.accelerationStartAtEpoch();
  const currentEpoch = await ACCELERATED_EXIT_QUEUE.currentEpoch();

  const epochsToDays = epochs / epochsPerDay;
  // Calculate accelerated days
  if (accelerationStartEpoch.lte(currentEpoch)) {
    const num = await ACCELERATED_EXIT_QUEUE.epochAccelerationFactorNumerator();
    const den =
      await ACCELERATED_EXIT_QUEUE.epochAccelerationFactorDenominator();
    const acceleratedDays = epochsToDays / (1 + num.div(den).toNumber());
    return formatNumber(acceleratedDays);
  }

  return formatNumber(epochsToDays);
};

export const getApy = async (
  walletAddress: string,
  signerState: JsonRpcSigner
) => {
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

export const getRewardsForOGTemple = async (
  walletAddress: string,
  signerState: JsonRpcSigner,
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
