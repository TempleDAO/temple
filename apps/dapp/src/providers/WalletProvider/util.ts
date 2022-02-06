import {
  JsonRpcProvider,
  JsonRpcSigner,
  Network,
} from '@ethersproject/providers';

import {
  AcceleratedExitQueue__factory,
  AMMWhitelist__factory,
  Devotion__factory,
  ERC20,
  ERC20__factory,
  ExitQueue__factory,
  FaithMerkleAirdrop__factory,
  Faith__factory,
  LockedOGTemple__factory,
  LockedOGTempleDeprecated__factory,
  OGTemple__factory,
  OpeningCeremony__factory,
  TempleCashback__factory,
  TempleERC20Token__factory,
  TempleFraxAMMRouter__factory,
  TempleStaking__factory,
  TempleTeamPayments__factory,
  TempleTreasury__factory,
  TempleUniswapV2Pair__factory,
} from 'types/typechain';

import { BigNumber, ContractTransaction, ethers } from 'ethers';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { formatNumber, formatNumberNoDecimals } from 'utils/formatter';

import {
  TEMPLE_V2_PAIR_ADDRESS,
  // TEMPLE_FAITH_ADDRESS,
  // OPENING_CEREMONY_ADDRESS,
  TREASURY_ADDRESS,
  TEMPLE_STAKING_ADDRESS,
  STABLE_COIN_ADDRESS,
  LOCKED_OG_TEMPLE_ADDRESS,
  LOCKED_OG_TEMPLE_DEVOTION_ADDRESS,
  TEMPLE_ADDRESS,
  // EXIT_QUEUE_ADDRESS,
  // ACCELERATED_EXIT_QUEUE_ADDRESS,
} from './env';

import { OpeningCeremonyUser, Balance, LockedEntry } from './types';

import { NoWalletAddressError } from './errors';
import { Nullable } from 'types/util';

export const getTemplePrice = async (
  walletAddress: string,
  signerState: JsonRpcSigner
) => {
  if (!walletAddress) {
    throw new NoWalletAddressError();
  }

  const TEMPLE_UNISWAP_V2_PAIR = new TempleUniswapV2Pair__factory()
    .attach(TEMPLE_V2_PAIR_ADDRESS)
    .connect(signerState);

  const { _reserve0, _reserve1 } = await TEMPLE_UNISWAP_V2_PAIR.getReserves();

  return fromAtto(_reserve1) / fromAtto(_reserve0);
};

export const getCurrentEpoch = async (provider: JsonRpcProvider) => {
  const blockNumber = await provider.getBlockNumber();
  const currentBlockTimestamp = (await provider.getBlock(blockNumber)).timestamp;
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

  const treasury = new TempleTreasury__factory()
    .attach(TREASURY_ADDRESS)
    .connect(signerState);

  const iv = await treasury.intrinsicValueRatio();
  const { temple, stablec } = iv;
  const mintMultiple = 6.0;
  const rate = fromAtto(temple) / fromAtto(stablec) / mintMultiple;
  return rate;
};

export const getBalance = async (walletAddress: string, signerState: JsonRpcSigner) => {
  if (!walletAddress) {
    throw new NoWalletAddressError();
  }

  const stableCoinContract = new ERC20__factory()
    .attach(STABLE_COIN_ADDRESS)
    .connect(signerState);

  const ogLockedTemple = new LockedOGTempleDeprecated__factory()
    .attach(LOCKED_OG_TEMPLE_ADDRESS)
    .connect(signerState);

  const OGTEMPLE_LOCKED_DEVOTION = new LockedOGTemple__factory()
    .attach(LOCKED_OG_TEMPLE_DEVOTION_ADDRESS)
    .connect(signerState);

  const templeStakingContract = new TempleStaking__factory()
    .attach(TEMPLE_STAKING_ADDRESS)
    .connect(signerState);

  const OG_TEMPLE_CONTRACT = new OGTemple__factory()
    .attach(await templeStakingContract.OG_TEMPLE())
    .connect(signerState);

  const templeContract = new TempleERC20Token__factory()
    .attach(TEMPLE_ADDRESS)
    .connect(signerState);

  const stableCoinBalance: BigNumber = await stableCoinContract.balanceOf(
    walletAddress
  );

  // get the locked OG temple
  const lockedNum = (
    await ogLockedTemple.numLocks(walletAddress)
  ).toNumber();
  let ogTempleLocked = 0;
  let ogTempleLockedClaimable = 0;
  const templeLockedPromises = [];
  for (let i = 0; i < lockedNum; i++) {
    templeLockedPromises.push(ogLockedTemple.locked(walletAddress, i));
  }

  const now = formatNumberNoDecimals(Date.now() / 1000);
  const templeLocked = await Promise.all(templeLockedPromises);
  templeLocked.map((x) => {
    ogTempleLocked += fromAtto(x.BalanceOGTemple);
    if (x.LockedUntilTimestamp.lte(BigNumber.from(now))) {
      ogTempleLockedClaimable += fromAtto(x.BalanceOGTemple);
    }
  });

  const ogTemple = fromAtto(
    await OG_TEMPLE_CONTRACT.balanceOf(walletAddress)
  );
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
}