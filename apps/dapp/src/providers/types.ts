import { Network } from '@ethersproject/providers';
import {
  BigNumber,
  ContractReceipt,
  Signer,
  ContractTransaction,
} from 'ethers';
import { Nullable } from 'types/util';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { Sor, SwapInfo } from '@balancer-labs/sdk';

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

export type Balance = Record<TICKER_SYMBOL, BigNumber>;

export type FaithBalance = {
  lifeTimeFaith: number;
  usableFaith: BigNumber;
  totalSupply: number;
  share: number;
};

export interface LockedEntry {
  // OG_Temple balance
  balanceOGTemple: BigNumber;
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

  updateLockedEntries(): Promise<void>;

  claimOgTemple(lockedEntryIndex: number): Promise<void>;

  getRewardsForOGT(ogtAmount: BigNumber): Promise<BigNumber | void>;

  updateApy(): Promise<void>;
}

export interface FaithService {
  faith: FaithBalance;

  updateFaith(): Promise<void>;
}

export interface SwapService {
  buy(
    quote: SwapInfo,
    tokenIn: TICKER_SYMBOL,
    deadline: number,
    slippage: number
  ): Promise<ContractReceipt | void>;

  sell(
    quote: SwapInfo,
    tokenOut: TICKER_SYMBOL,
    deadline: number,
    slippage: number
  ): Promise<ContractReceipt | void>;

  getSellQuote(
    amountToSell: BigNumber,
    token?: TICKER_SYMBOL
  ): Promise<SwapInfo | void>;

  getBuyQuote(
    amountIn: BigNumber,
    token?: TICKER_SYMBOL
  ): Promise<SwapInfo | void>;

  error: Error | null;

  sor: Sor;
}

export interface WalletState {
  // has the user connected a wallet to the dapp
  wallet: string | undefined;
  walletAddress: string | undefined;
  // current
  balance: Balance;
  signer: Nullable<Signer>;

  isConnecting: boolean;
  isConnected: boolean;

  getBalance(): Promise<Balance | void>;
  updateBalance(): Promise<void>;
  collectTempleTeamPayment(epoch: number): Promise<void | TransactionReceipt>;

  ensureAllowance(
    tokenName: string,
    // Should be ERC20, need to update Typechain (fix is in 8.0.x)
    erc20Token: any,
    spender: string,
    minAllowance: BigNumber
  ): Promise<void>;
}
