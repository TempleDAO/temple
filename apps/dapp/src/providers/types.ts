import { JsonRpcSigner, Network } from '@ethersproject/providers';
import { BigNumber } from 'ethers';
import { ERC20 } from 'types/typechain';
import { ClaimType } from 'enums/claim-type';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { TEAM_PAYMENTS_EPOCHS } from 'enums/team-payment';

export enum RitualKind {
  OFFERING_STAKING = 'OFFERING_STAKING',
  OGT_UNLOCK = 'OGT_UNLOCK',
  // SELL
  SURRENDER = 'SURRENDER',
  VERIFYING = 'VERIFYING',
  INVITE_FRIEND = 'INVITE_FRIEND',
}

export enum ETH_ACTIONS {
  REQUEST_ACCOUNTS = 'eth_requestAccounts',
  REQUEST_PERMISSIONS = 'wallet_requestPermissions',
}

export type Balance = {
  stableCoin: number;
  temple: number;
  fei: number;
  ogTempleLocked: number;
  ogTempleLockedClaimable: number;
  ogTemple: number;
};

export type FaithBalance = {
  lifeTimeFaith: number;
  usableFaith: number;
  totalSupply: number;
  share: number;
};

export interface LockedEntry {
  // OG_Temple balance
  balanceOGTemple: number;
  // timestamp in milliseconds when balance can be unlocked
  lockedUntilTimestamp: number;
  // index in the contract mapping
  index: number;
}

export interface ExitQueueData {
  // amount owned in exit queue
  totalTempleOwned: number;
  // amount that can be claimed now
  claimableTemple: number;
  // timestamp in milliseconds of the last exit
  lastClaimableEpochAt: number;
  // list of epochs with a claimable amount
  claimableEpochs: Array<number>;
}

export interface JoinQueueData {
  // current queue length
  queueLength: number;
  // how is going to take to process OG TEMPLE
  processTime: number;
}

export interface FaithQuote {
  canClaim: boolean;
  claimableFaith: number;
}

export interface StakingService {
  apy: number;
  exitQueueData: ExitQueueData;
  lockedEntries: Array<LockedEntry>;

  stake(amountToStake: BigNumber): Promise<void>;
  unstake(amountToStake: BigNumber): Promise<void>;

  claimAvailableTemple(): Promise<void>;

  restakeAvailableTemple(): Promise<void>;

  getJoinQueueData(ogtAmount: BigNumber): Promise<JoinQueueData | void>;

  getExitQueueData(): Promise<void>;

  updateLockedEntries(): Promise<void>;

  claimOgTemple(lockedEntryIndex: number): Promise<void>;

  getRewardsForOGT(ogtAmount: number): Promise<number | void>;

  updateApy(): Promise<void>;
}

export interface FaithService {
  faith: FaithBalance;

  updateFaith(): Promise<void>;

  verifyFaith(lockingPeriod?: number): Promise<void>;

  redeemFaith(faithAmount: BigNumber): Promise<BigNumber | void>;

  getFaithQuote(): Promise<FaithQuote | void>;

  getTempleFaithReward(faithAmount: BigNumber): Promise<BigNumber | void>;

  claimFaithAirdrop(
    index: number,
    address: string,
    amount: BigNumber,
    proof: string[]
  ): Promise<TransactionReceipt | void>;
}

export interface SwapService {
  templePrice: number;
  iv: number;

  buy(
    amountInFrax: BigNumber,
    minAmountOutTemple: BigNumber,
    stablecoinAddress?: string
  ): void;

  sell(
    amountInTemple: BigNumber,
    minAmountOutFrax: BigNumber,
    isIvSwap: boolean
  ): void;

  getSellQuote(amountToSell: BigNumber): Promise<BigNumber | void>;

  getBuyQuote(amountToBuy: BigNumber): Promise<BigNumber | void>;

  updateTemplePrice(): Promise<void>;

  updateIv(): Promise<void>;
}

export interface WalletState {
  // has the user connected a wallet to the dapp
  wallet: string | null;
  // current
  balance: Balance;
  signer: JsonRpcSigner | null;
  network: Network | null;

  isConnected(): boolean;

  connectWallet(): void;

  changeWalletAddress(): void;

  claim(claimType: ClaimType): Promise<TransactionReceipt | void>;

  getBalance(): Promise<Balance | void>;

  updateBalance(): Promise<void>;

  getCurrentEpoch(): Promise<void | number>;

  collectTempleTeamPayment(
    epoch: TEAM_PAYMENTS_EPOCHS
  ): Promise<void | TransactionReceipt>;

  ensureAllowance(
    tokenName: string,
    token: ERC20,
    spender: string,
    minAllowance: BigNumber
  ): Promise<void>;
}
