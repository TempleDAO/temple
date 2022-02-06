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
  // TEMPLE_STAKING_ADDRESS,
  // STABLE_COIN_ADDRESS,
  // LOCKED_OG_TEMPLE_ADDRESS,
  // LOCKED_OG_TEMPLE_DEVOTION_ADDRESS,
  // TEMPLE_ADDRESS,
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