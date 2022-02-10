import { TransactionReceipt } from '@ethersproject/abstract-provider';
import {
  JsonRpcProvider,
  JsonRpcSigner,
  Network,
} from '@ethersproject/providers';
import { STABLE_COIN_SYMBOL } from 'components/Pages/Rituals';
import { ClaimType } from 'enums/claim-type';
import {
  TEAM_PAYMENTS_CONTINGENT_ADDRESSES_BY_EPOCH,
  TEAM_PAYMENTS_EPOCHS,
  TEAM_PAYMENTS_FIXED_ADDRESSES_BY_EPOCH,
  TEAM_PAYMENTS_TYPES,
} from 'enums/team-payment-type';
import { BigNumber, ContractTransaction, ethers } from 'ethers';
import { useNotification } from 'providers/NotificationProvider';
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
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
import { fromAtto, toAtto } from 'utils/bigNumber';
import { formatNumber, formatNumberNoDecimals } from 'utils/formatter';
import { asyncNoop, noop } from 'utils/helpers';

/**
 * temple Staking . balance => all temple for user
 */

const ENV_VARS = import.meta.env;

/* TODO: Move this to a common place */
export const TEMPLE_TOKEN = '$TEMPLE';
export const OG_TEMPLE_TOKEN = '$OGTEMPLE';
export const FAITH_TOKEN = 'FAITH';

// our default deadline is 20 minutes
const DEADLINE = 20 * 60;

// We want to save gas burn $ for the Templars,
// so we approving 1M up front, so only 1 approve TXN is required for approve
const DEFAULT_ALLOWANCE = toAtto(100000000);

// @Deprecated this was used on FIRE_RITUAL and OC, don't use.
export enum RitualKind {
  OFFERING_STAKING = 'OFFERING_STAKING',
  OGT_UNLOCK = 'OGT_UNLOCK',
  // SELL
  SURRENDER = 'SURRENDER',
  VERIFYING = 'VERIFYING',
  INVITE_FRIEND = 'INVITE_FRIEND',
}

type COIN_TYPE = 'FRAX' | 'OGTEMPLE' | 'TEMPLE';

enum ETH_ACTIONS {
  REQUEST_ACCOUNTS = 'eth_requestAccounts',
  REQUEST_PERMISSIONS = 'wallet_requestPermissions',
}

export type Balance = {
  stableCoin: number;
  temple: number;
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

export type Allocation = {
  amount: number;
  // Contract returns the number of block/days at which the user will be able to start the rituals
  // this value will be set to a timestamp of ms from epoch 0ms to ease use in dapp
  startEpoch: number | undefined;
};

export enum RitualStatus {
  NO_STATUS,
  COMPLETED,
  PROCESSING,
  FAILED,
}

type RitualMapping = Map<
  RitualKind,
  {
    completedBalanceApproval: RitualStatus;
    completedTransaction: RitualStatus;
    verifyingTransaction: RitualStatus;
    inviteFriendTransaction: RitualStatus;
    ritualMessage?: string;
  }
>;

interface OpeningCeremonyUser {
  isVerified: boolean;
  isGuest: boolean;
  numInvited: number;
  doublingIndexAtVerification: number;
  totalSacrificedStablec: number;
  totalSacrificedTemple: number;
}

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

interface WalletState {
  // has the user connected a wallet to the dapp
  isConnected: boolean;

  wallet: string | null;
  // current
  balance: Balance;
  faith: FaithBalance;
  templePrice: number;
  exchangeRate: number;
  allocation: Allocation;
  ritual: RitualMapping;
  lockInPeriod: number;
  currentEpoch: number;
  isLoading: boolean;
  ocTemplar: OpeningCeremonyUser;
  maxInvitesPerVerifiedUser: number;
  signer: JsonRpcSigner | null;
  network: Network | null;
  lockedEntries: Array<LockedEntry>;
  exitQueueData: ExitQueueData;

  connectWallet(): void;

  changeWalletAddress(): void;

  updateWallet(): Promise<void> | void;

  buy(amountInFrax: BigNumber, minAmountOutTemple: BigNumber): void;

  sell(amountInTemple: BigNumber, minAmountOutFrax: BigNumber): void;

  stake(amountToStake: BigNumber): Promise<void>;

  mintAndStake(amountToBuy: BigNumber): void;

  increaseAllowanceForRitual(
    amountToBuy: BigNumber,
    ritualKind: RitualKind,
    allowanceKind?: COIN_TYPE
  ): void;

  clearRitual(ritualKind: RitualKind): void;

  //verifyQuest(sandalWoodToken: string, ritualKind: RitualKind): void;

  inviteFriend(sandalWoodToken: string, ritualKind: RitualKind): void;

  claim(claimType: ClaimType): Promise<TransactionReceipt | void>;

  claimFaithAirdrop(
    index: number,
    address: string,
    amount: BigNumber,
    proof: string[]
  ): Promise<TransactionReceipt | void>;

  verifyAMMWhitelist(signature: string): Promise<ContractTransaction | void>;

  claimOgTemple(lockedEntryIndex: number): Promise<void>;

  claimAvailableTemple(): Promise<void>;

  restakeAvailableTemple(): Promise<void>;

  getRewardsForOGT(ogtAmount: number): Promise<number | void>;

  getJoinQueueData(ogtAmount: BigNumber): Promise<JoinQueueData | void>;

  getSellQuote(amountToSell: BigNumber): Promise<BigNumber | void>;

  getBuyQuote(amountToBuy: BigNumber): Promise<BigNumber | void>;

  getBalance(): Promise<Balance | void>;

  collectTempleTeamPayment(
    paymentType: TEAM_PAYMENTS_TYPES,
    epoch: TEAM_PAYMENTS_EPOCHS
  ): Promise<void | TransactionReceipt>;

  apy: number;

  verifyFaith(lockingPeriod?: number): Promise<void>;

  redeemFaith(faithAmount: BigNumber): Promise<BigNumber | void>;

  getTempleFaithReward(faithAmount: BigNumber): Promise<BigNumber | void>;

  getFaithQuote(): Promise<FaithQuote | void>;
}

const INITIAL_STATE: WalletState = {
  balance: {
    stableCoin: 0,
    temple: 0,
    ogTempleLocked: 0,
    ogTempleLockedClaimable: 0,
    ogTemple: 0,
  },
  faith: {
    usableFaith: 0,
    lifeTimeFaith: 0,
    totalSupply: 0,
    share: 0,
  },
  // Fallback when user has not connected wallet, we can update this from Vercel and redeploy
  exchangeRate: ENV_VARS.NEXT_PUBLIC_EXCHANGE_RATE_VALUE
    ? +ENV_VARS.NEXT_PUBLIC_EXCHANGE_RATE_VALUE
    : 0.9,
  allocation: {
    amount: 0,
    startEpoch: undefined,
  },
  isConnected: false,
  wallet: null,
  ritual: new Map(),
  lockInPeriod: 0,
  currentEpoch: -1,
  templePrice: 0,
  isLoading: true,
  ocTemplar: {
    isGuest: false,
    isVerified: false,
    numInvited: 0,
    doublingIndexAtVerification: 1,
    totalSacrificedTemple: 0,
    totalSacrificedStablec: 0,
  },
  maxInvitesPerVerifiedUser: 0,
  lockedEntries: [],
  exitQueueData: {
    lastClaimableEpochAt: 0,
    claimableTemple: 0,
    totalTempleOwned: 0,
    claimableEpochs: [],
  },
  buy: noop,
  sell: noop,
  connectWallet: noop,
  changeWalletAddress: noop,
  updateWallet: noop,
  stake: asyncNoop,
  mintAndStake: noop,
  increaseAllowanceForRitual: noop,
  clearRitual: noop,
  //verifyQuest: noop,
  inviteFriend: noop,
  claim: asyncNoop,
  claimFaithAirdrop: asyncNoop,
  verifyAMMWhitelist: asyncNoop,
  signer: null,
  network: null,
  claimOgTemple: asyncNoop,
  getRewardsForOGT: asyncNoop,
  claimAvailableTemple: asyncNoop,
  restakeAvailableTemple: asyncNoop,
  getJoinQueueData: asyncNoop,
  getSellQuote: asyncNoop,
  getBuyQuote: asyncNoop,
  getBalance: asyncNoop,
  collectTempleTeamPayment: asyncNoop,
  apy: 0,
  verifyFaith: asyncNoop,
  redeemFaith: asyncNoop,
  getTempleFaithReward: asyncNoop,
  getFaithQuote: asyncNoop,
};

const STABLE_COIN_ADDRESS = ENV_VARS.VITE_PUBLIC_STABLE_COIN_ADDRESS;
const TEMPLE_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_ADDRESS;
const LOCKED_OG_TEMPLE_ADDRESS = ENV_VARS.VITE_PUBLIC_LOCKED_OG_TEMPLE_ADDRESS;
const LOCKED_OG_TEMPLE_DEVOTION_ADDRESS =
  ENV_VARS.VITE_PUBLIC_LOCKED_OG_TEMPLE_DEVOTION_ADDRESS;
const TEMPLE_STAKING_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_STAKING_ADDRESS;
const TREASURY_ADDRESS = ENV_VARS.VITE_PUBLIC_TREASURY_ADDRESS;
const EXIT_QUEUE_ADDRESS = ENV_VARS.VITE_PUBLIC_EXIT_QUEUE_ADDRESS;
const OPENING_CEREMONY_ADDRESS = ENV_VARS.VITE_PUBLIC_OPENING_CEREMONY_ADDRESS;
const TEMPLE_CASHBACK_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_CASHBACK_ADDRESS;
const AMM_WHITELIST_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_ROUTER_WHITELIST;
const TEMPLE_V2_ROUTER_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_V2_ROUTER_ADDRESS;
const TEMPLE_V2_PAIR_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_V2_PAIR_ADDRESS;
const ACCELERATED_EXIT_QUEUE_ADDRESS =
  ENV_VARS.VITE_PUBLIC_ACCELERATED_EXIT_QUEUE_ADDRESS;
const FAITH_AIRDROP_ADDRESS = ENV_VARS.VITE_PUBLIC_FAITH_AIRDROP_ADDRESS;

const TEMPLE_TEAM_FIXED_PAYMENTS_ADDRESS =
  ENV_VARS.VITE_PUBLIC_TEMPLE_R1_TEAM_FIXED_PAYMENTS_ADDRESS;
const TEMPLE_TEAM_CONTINGENT_PAYMENTS_ADDRESS =
  ENV_VARS.VITE_PUBLIC_TEMPLE_R1_TEAM_CONTINGENT_PAYMENTS_ADDRESS;
const TEMPLE_DEVOTION_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_DEVOTION_ADDRESS;
const TEMPLE_FAITH_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_FAITH_ADDRESS;
if (
  STABLE_COIN_ADDRESS === undefined ||
  TEMPLE_ADDRESS === undefined ||
  TEMPLE_STAKING_ADDRESS === undefined ||
  TREASURY_ADDRESS === undefined ||
  LOCKED_OG_TEMPLE_ADDRESS === undefined ||
  EXIT_QUEUE_ADDRESS === undefined ||
  OPENING_CEREMONY_ADDRESS === undefined ||
  TEMPLE_CASHBACK_ADDRESS === undefined ||
  TEMPLE_V2_ROUTER_ADDRESS === undefined ||
  TEMPLE_V2_PAIR_ADDRESS === undefined ||
  ACCELERATED_EXIT_QUEUE_ADDRESS === undefined ||
  FAITH_AIRDROP_ADDRESS === undefined ||
  TEMPLE_DEVOTION_ADDRESS === undefined ||
  TEMPLE_FAITH_ADDRESS === undefined ||
  LOCKED_OG_TEMPLE_DEVOTION_ADDRESS === undefined
) {
  console.info(`
STABLE_COIN_ADDRESS=${STABLE_COIN_ADDRESS}
TEMPLE_ADDRESS=${TEMPLE_ADDRESS}
TEMPLE_STAKING_ADDRESS=${TEMPLE_STAKING_ADDRESS}
TREASURY_ADDRESS=${TREASURY_ADDRESS}
LOCKED_OG_TEMPLE_ADDRESS=${LOCKED_OG_TEMPLE_ADDRESS}
EXIT_QUEUE_ADDRESS=${EXIT_QUEUE_ADDRESS}
OPENING_CEREMONY_ADDRESS=${OPENING_CEREMONY_ADDRESS}
TEMPLE_CASHBACK_ADDRESS=${TEMPLE_CASHBACK_ADDRESS}
TEMPLE_V2_ROUTER_ADDRESS=${TEMPLE_V2_ROUTER_ADDRESS}
TEMPLE_V2_PAIR_ADDRESS=${TEMPLE_V2_PAIR_ADDRESS}
ACCELERATED_EXIT_QUEUE_ADDRESS=${ACCELERATED_EXIT_QUEUE_ADDRESS}
FAITH_AIRDROP_ADDRESS=${FAITH_AIRDROP_ADDRESS}
TEMPLE_DEVOTION_ADDRESS=${TEMPLE_DEVOTION_ADDRESS}
LOCKED_OG_TEMPLE_DEVOTION_ADDRESS=${LOCKED_OG_TEMPLE_DEVOTION_ADDRESS}
TEMPLE_FAITH_ADDRESS=${TEMPLE_FAITH_ADDRESS}
`);
  throw new Error(`Missing contract address from .env`);
}

const WalletContext = createContext<WalletState>(INITIAL_STATE);

export const WalletProvider = (props: PropsWithChildren<any>) => {
  const { children } = props;
  const [provider, setProvider] = useState<JsonRpcProvider | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [signerState, setSignerState] = useState<JsonRpcSigner | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnectedState, setIsConnectedState] = useState(false);
  const [balanceState, setBalanceState] = useState<Balance>(
    INITIAL_STATE.balance
  );
  const [exchangeRateState, setExchangeRateState] = useState<number>(
    INITIAL_STATE.exchangeRate
  );
  const [allocation, setAllocation] = useState<Allocation>(
    INITIAL_STATE.allocation
  );
  const [ritual, setRitual] = useState<RitualMapping>(INITIAL_STATE.ritual);
  const [lockInPeriod, setLockInPeriod] = useState<number>(
    INITIAL_STATE.lockInPeriod
  );
  const [currentEpoch, setCurrentEpoch] = useState<number>(
    INITIAL_STATE.currentEpoch
  );
  const [isLoading, setIsLoading] = useState<boolean>(INITIAL_STATE.isLoading);
  const [ocTemplar, setOcTemplar] = useState<OpeningCeremonyUser>(
    INITIAL_STATE.ocTemplar
  );
  const [maxInvitesPerVerifiedUser, setMaxInvitesPerVerifiedUser] =
    useState<number>(INITIAL_STATE.maxInvitesPerVerifiedUser);
  const [lockedEntries, setLockedEntries] = useState<Array<LockedEntry>>(
    INITIAL_STATE.lockedEntries
  );
  const [exitQueueData, setExitQueueData] = useState<ExitQueueData>(
    INITIAL_STATE.exitQueueData
  );
  const [apy, setApy] = useState(0);
  const [templePrice, setTemplePrice] = useState(INITIAL_STATE.templePrice);
  const [faith, setFaith] = useState(INITIAL_STATE.faith);

  const { openNotification } = useNotification();

  useEffect(() => {
    interactWithMetamask(undefined, true).then();
    if (typeof window !== undefined) {
      // @ts-ignore
      const { ethereum } = window;

      if (ethereum && ethereum.isMetaMask) {
        ethereum.on('accountsChanged', () => {
          window.location.reload();
        });
        ethereum.on('chainChanged', () => {
          window.location.reload();
        });
      }

      return () => {
        ethereum.removeListener('accountsChanged');
        ethereum.removeListener('networkChanged');
      };
    }
  }, []);

  const interactWithMetamask = async (
    action?: ETH_ACTIONS,
    syncConnected?: boolean
  ) => {
    if (typeof window !== undefined) {
      // @ts-ignore
      const { ethereum } = window;

      if (ethereum && ethereum.isMetaMask) {
        const provider: JsonRpcProvider = new ethers.providers.Web3Provider(
          ethereum
        );

        if (action) {
          await provider.send(action, [
            {
              eth_accounts: {},
            },
          ]);
        }

        const signer = provider.getSigner();
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          const wallet: string = await signer.getAddress();
          setSignerState(signer);
          setProvider(provider);
          setNetwork(await provider.getNetwork());
          setWalletAddress(wallet);
          await updateWallet();
        }
      } else {
        console.error('Please add MetaMask to your browser');
      }
    }
  };

  const connectWallet = async () => {
    await interactWithMetamask(ETH_ACTIONS.REQUEST_ACCOUNTS);
  };

  const changeWalletAddress = async () => {
    await interactWithMetamask(ETH_ACTIONS.REQUEST_PERMISSIONS);
  };

  const isConnected = (): void => {
    // only trigger once window is loaded
    if (typeof window !== undefined) {
      // @ts-ignore
      const ethereum = window.ethereum;
      if (ethereum) {
        const connected = ethereum.isConnected();
        setIsConnectedState(connected);
      }
    }
  };

  const inviteFriend = async (
    friendAddress: string,
    ritualKind: RitualKind
  ) => {
    if (walletAddress && signerState) {
      setRitual(
        new Map(
          ritual.set(ritualKind, {
            inviteFriendTransaction: RitualStatus.PROCESSING,
            completedBalanceApproval: RitualStatus.NO_STATUS,
            completedTransaction: RitualStatus.NO_STATUS,
            verifyingTransaction: RitualStatus.NO_STATUS,
          })
        )
      );

      try {
        const openingCeremonyContract = new OpeningCeremony__factory(
          signerState
        ).attach(OPENING_CEREMONY_ADDRESS);

        const inviteGuestTransaction =
          await openingCeremonyContract.addGuestUser(friendAddress, {
            gasLimit: 85000,
          });
        await inviteGuestTransaction.wait();

        setRitual(
          new Map(
            ritual.set(ritualKind, {
              completedBalanceApproval: RitualStatus.NO_STATUS,
              completedTransaction: RitualStatus.NO_STATUS,
              inviteFriendTransaction: RitualStatus.COMPLETED,
              verifyingTransaction: RitualStatus.NO_STATUS,
              ritualMessage: `continue`,
            })
          )
        );
      } catch (e) {
        setRitual(
          new Map(
            ritual.set(ritualKind, {
              inviteFriendTransaction: RitualStatus.FAILED,
              completedBalanceApproval: RitualStatus.NO_STATUS,
              completedTransaction: RitualStatus.NO_STATUS,
              verifyingTransaction: RitualStatus.NO_STATUS,
              ritualMessage: `failed to invite friend`,
            })
          )
        );
      }
    }
  };

  /**
   * updates the Templar data from OC Contract
   */
  const getOCTemplar = async () => {
    if (walletAddress && signerState) {
      const openingCeremony = new OpeningCeremony__factory(signerState).attach(
        OPENING_CEREMONY_ADDRESS
      );

      const ocTemplarData = await openingCeremony.users(walletAddress);

      setOcTemplar({
        doublingIndexAtVerification:
          ocTemplarData.doublingIndexAtVerification.toNumber(),
        isGuest: ocTemplarData.isGuest,
        isVerified: ocTemplarData.isVerified,
        numInvited: ocTemplarData.numInvited,
        totalSacrificedStablec: fromAtto(ocTemplarData.totalSacrificedStablec),
        totalSacrificedTemple: fromAtto(ocTemplarData.totalSacrificedTemple),
      });
    }
  };

  const getMaxInvitesPerVerifiedUser = async () => {
    if (walletAddress && signerState) {
      const openingCeremony = new OpeningCeremony__factory(signerState).attach(
        OPENING_CEREMONY_ADDRESS
      );

      const ocMaxInvitesPerVerifiedUser =
        await openingCeremony.maxInvitesPerVerifiedUser();
      setMaxInvitesPerVerifiedUser(ocMaxInvitesPerVerifiedUser.toNumber());
    }
  };

  const getLockedEntries = async () => {
    if (walletAddress && signerState) {
      const ogLockedTemple = new LockedOGTempleDeprecated__factory(
        signerState
      ).attach(LOCKED_OG_TEMPLE_ADDRESS);

      const lockedNum = (
        await ogLockedTemple.numLocks(walletAddress)
      ).toNumber();
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

      setLockedEntries([...lockedEntriesVals]);
    }
  };

  const getExitQueueData = async () => {
    if (walletAddress && signerState) {
      const EXIT_QUEUE = new ExitQueue__factory(signerState).attach(
        EXIT_QUEUE_ADDRESS
      );

      const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(
        signerState
      ).attach(ACCELERATED_EXIT_QUEUE_ADDRESS);

      const userData = await EXIT_QUEUE.userData(walletAddress);
      const totalTempleOwned = fromAtto(userData.Amount);

      if (totalTempleOwned === 0) {
        setExitQueueData(INITIAL_STATE.exitQueueData);
        return;
      }

      const currentEpoch = (
        await ACCELERATED_EXIT_QUEUE.currentEpoch()
      ).toNumber();
      const firstEpoch = userData.FirstExitEpoch.toNumber();
      const lastEpoch = userData.LastExitEpoch.toNumber();
      const todayInMs = new Date().getTime();
      const dayInMs = 8.64e7;
      const daysUntilLastClaimableEpoch = await epochsToDays(
        lastEpoch - currentEpoch + 1
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

      setExitQueueData({
        lastClaimableEpochAt,
        claimableTemple,
        totalTempleOwned,
        claimableEpochs,
      });
    }
  };

  const getApy = async () => {
    if (walletAddress && signerState) {
      const TEMPLE_STAKING = new TempleStaking__factory(signerState).attach(
        TEMPLE_STAKING_ADDRESS
      );
      const SCALE_FACTOR = 10000;
      const epy = (await TEMPLE_STAKING.getEpy(SCALE_FACTOR)).toNumber();
      setApy(Math.trunc((Math.pow(epy / SCALE_FACTOR + 1, 365.25) - 1) * 100));
    }
  };

  const getTemplePrice = async () => {
    if (walletAddress && signerState) {
      const TEMPLE_UNISWAP_V2_PAIR = new TempleUniswapV2Pair__factory(
        signerState
      ).attach(TEMPLE_V2_PAIR_ADDRESS);

      const { _reserve0, _reserve1 } =
        await TEMPLE_UNISWAP_V2_PAIR.getReserves();
      setTemplePrice(fromAtto(_reserve1) / fromAtto(_reserve0));
    }
  };

  const getFaith = async () => {
    if (walletAddress && signerState) {
      const FAITH = new Faith__factory(signerState).attach(
        TEMPLE_FAITH_ADDRESS
      );

      const faithBalances = await FAITH.balances(walletAddress);
      const totalSupply = await FAITH.totalSupply();
      const totalFaithSupply = fromAtto(totalSupply);
      const lifeTimeFaith = fromAtto(faithBalances.lifeTimeFaith);
      const usableFaith = fromAtto(faithBalances.usableFaith);
      setFaith({
        lifeTimeFaith: formatNumber(lifeTimeFaith),
        usableFaith: formatNumber(usableFaith),
        totalSupply: formatNumber(totalFaithSupply),
        share: formatNumber((usableFaith * 100) / totalFaithSupply),
      });
    }
  };

  /**
   * Load new data for the connected wallet
   * @param updateLoading Determines if the `isLoading` state should be updated
   */
  const updateWallet = async (updateLoading = true) => {
    if (updateLoading) {
      setIsLoading(true);
    }
    if (typeof window !== undefined) {
      // @ts-ignore
      const ethereum = window.ethereum;
      if (ethereum) {
        isConnected();
        // await getOCTemplar();
        // await getMaxInvitesPerVerifiedUser();
        await Promise.all([
          getTemplePrice(),
          getCurrentEpoch(),
          getExchangeRate(),
          getLockInPeriod(),
          getBalance(),
          getFaith(),
          getAllocation(),
          getLockedEntries(),
          getExitQueueData(),
          getApy(),
        ]);

        if (updateLoading) {
          setIsLoading(false);
        }
      }
    }
  };

  const getBalance = async () => {
    if (walletAddress && signerState) {
      const stableCoinContract = new ERC20__factory(signerState).attach(
        STABLE_COIN_ADDRESS
      );

      const ogLockedTemple = new LockedOGTempleDeprecated__factory(
        signerState
      ).attach(LOCKED_OG_TEMPLE_ADDRESS);

      const OGTEMPLE_LOCKED_DEVOTION = new LockedOGTemple__factory(
        signerState
      ).attach(LOCKED_OG_TEMPLE_DEVOTION_ADDRESS);

      const templeStakingContract = new TempleStaking__factory(
        signerState
      ).attach(TEMPLE_STAKING_ADDRESS);

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

      const balance: Balance = {
        stableCoin: fromAtto(stableCoinBalance),
        temple: temple,
        ogTempleLocked: ogTempleLocked + fromAtto(lockedOGTempleEntry.amount),
        ogTemple: ogTemple >= 1 ? ogTemple : 0,
        ogTempleLockedClaimable: ogTempleLockedClaimable,
      };
      setBalanceState(balance);
    }
  };

  const getExchangeRate = async (): Promise<void> => {
    if (walletAddress && signerState) {
      const treasury = new TempleTreasury__factory(signerState).attach(
        TREASURY_ADDRESS
      );

      const iv = await treasury.intrinsicValueRatio();
      const { temple, stablec } = iv;
      const mintMultiple = 6.0;
      const rate = fromAtto(temple) / fromAtto(stablec) / mintMultiple;
      // Only change the value if contract has valid data

      if (rate > 0) {
        setExchangeRateState(rate);
      }
    }
  };

  const getCurrentEpoch = async (): Promise<void> => {
    if (provider) {
      const blockNumber = await provider.getBlockNumber();
      const currentBlockTimestamp = (await provider.getBlock(blockNumber))
        .timestamp;
      // block timestamps are in seconds no ms
      setCurrentEpoch(currentBlockTimestamp * 1000);
    }
  };

  const getAllocation = async (): Promise<void> => {
    if (walletAddress && signerState && ocTemplar) {
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

      setAllocation({
        amount: allocation - ocTemplar.totalSacrificedStablec,
        //they can start right away once verified
        startEpoch: 1,
      });
    }
  };

  /**
   * Always use this to increase allowance for TOKENS
   * @param tokenName
   * @param token
   * @param spender
   * @param minAllowance
   */
  const ensureAllowance = async (
    tokenName: string,
    token: ERC20,
    spender: string,
    minAllowance: BigNumber
  ) => {
    // pre-condition
    if (!walletAddress) {
      throw new Error('precondition failed: No connected wallet');
    }

    const allowance = await token.allowance(walletAddress, spender);

    if (allowance.lt(minAllowance)) {
      // increase allowance
      const approveTXN = await token.approve(spender, DEFAULT_ALLOWANCE);
      await approveTXN.wait();

      // Show feedback to user
      openNotification({
        title: `${tokenName} allowance approved`,
        hash: approveTXN.hash,
      });
    }
  };

  const increaseTokenAllowance = async (
    amount: BigNumber,
    ritualKind: RitualKind,
    allowanceKind: COIN_TYPE = 'FRAX'
  ): Promise<boolean> => {
    if (walletAddress && signerState) {
      let allowance;
      const stableCoinContract = new ERC20__factory(signerState).attach(
        STABLE_COIN_ADDRESS
      );
      const templeStakingContract = new TempleStaking__factory(
        signerState
      ).attach(TEMPLE_STAKING_ADDRESS);
      const STAKING_OC_TEMPLE = await templeStakingContract.OG_TEMPLE();
      const OGTContract = new OGTemple__factory(signerState).attach(
        STAKING_OC_TEMPLE
      );
      const TEMPLE = new TempleERC20Token__factory(signerState).attach(
        TEMPLE_ADDRESS
      );

      switch (allowanceKind) {
        case 'TEMPLE':
          allowance = await TEMPLE.allowance(
            walletAddress,
            TEMPLE_V2_ROUTER_ADDRESS
          );
          break;
        case 'FRAX':
          allowance = await stableCoinContract.allowance(
            walletAddress,
            OPENING_CEREMONY_ADDRESS
          );
          break;
        case 'OGTEMPLE':
          allowance = await OGTContract.allowance(
            walletAddress,
            TEMPLE_STAKING_ADDRESS
          );
          break;
      }

      if (allowance.lt(amount)) {
        try {
          let approveTXN: ContractTransaction;
          switch (allowanceKind) {
            case 'TEMPLE':
              console.info(
                `checkk TEMPLEPELPEL approve => TEMPLE_V2_ROUTER_ADDRESS`
              );
              approveTXN = await TEMPLE.approve(
                TEMPLE_V2_ROUTER_ADDRESS,
                DEFAULT_ALLOWANCE
              );
              break;
            case 'FRAX':
              approveTXN = await stableCoinContract.approve(
                OPENING_CEREMONY_ADDRESS,
                DEFAULT_ALLOWANCE
              );
              break;
            case 'OGTEMPLE':
              approveTXN = await OGTContract.approve(
                TEMPLE_STAKING_ADDRESS,
                DEFAULT_ALLOWANCE
              );
              break;
          }
          // Show feedback to user
          openNotification({
            title: `${allowanceKind} Approved`,
            hash: approveTXN.hash,
          });
          await approveTXN.wait();
          return true;
        } catch (e) {
          setRitual(
            new Map(
              ritual.set(ritualKind, {
                completedBalanceApproval: RitualStatus.FAILED,
                completedTransaction: RitualStatus.NO_STATUS,
                inviteFriendTransaction: RitualStatus.NO_STATUS,
                verifyingTransaction: RitualStatus.NO_STATUS,
                ritualMessage: 'RITUAL FAILED ➢ PRAY HARDER',
              })
            )
          );

          return false;
        }
      } else {
        return true;
      }
    }
    return false;
  };

  const increaseAllowanceForRitual = async (
    amount: BigNumber,
    ritualKind: RitualKind,
    allowanceKind: COIN_TYPE
  ) => {
    if (walletAddress && signerState) {
      setRitual(
        new Map(
          ritual.set(ritualKind, {
            completedBalanceApproval: RitualStatus.PROCESSING,
            completedTransaction: RitualStatus.NO_STATUS,
            inviteFriendTransaction: RitualStatus.NO_STATUS,
            verifyingTransaction: RitualStatus.NO_STATUS,
          })
        )
      );
      const allowanceApproved: boolean = await increaseTokenAllowance(
        amount,
        ritualKind,
        allowanceKind
      );

      if (allowanceApproved) {
        setRitual(
          new Map(
            ritual.set(ritualKind, {
              completedBalanceApproval: RitualStatus.COMPLETED,
              completedTransaction: RitualStatus.NO_STATUS,
              inviteFriendTransaction: RitualStatus.NO_STATUS,
              verifyingTransaction: RitualStatus.NO_STATUS,
            })
          )
        );

        switch (ritualKind) {
          case RitualKind.OFFERING_STAKING:
            await mintAndStake(amount);
            break;
          case RitualKind.OGT_UNLOCK:
            await unstake(amount);
            break;
          default:
            console.error(`Unknown ritual: ${ritualKind}`);
            return;
        }
      }
    }
  };

  const mintAndStake = async (amount: BigNumber) => {
    if (walletAddress && signerState) {
      const openingCeremonyContract = new OpeningCeremony__factory(
        signerState
      ).attach(OPENING_CEREMONY_ADDRESS);

      const stableCoinContract = new ERC20__factory(signerState).attach(
        STABLE_COIN_ADDRESS
      );

      try {
        setRitual(
          new Map(
            ritual.set(RitualKind.OFFERING_STAKING, {
              completedBalanceApproval: RitualStatus.COMPLETED,
              completedTransaction: RitualStatus.PROCESSING,
              verifyingTransaction: RitualStatus.NO_STATUS,
              inviteFriendTransaction: RitualStatus.NO_STATUS,
            })
          )
        );
        const stableCoinBalance: BigNumber = await stableCoinContract.balanceOf(
          walletAddress
        );
        // ensure user input is not greater than user balance. if greater use all user balance.
        const offering = amount.lte(stableCoinBalance)
          ? amount
          : stableCoinBalance;
        const mintAndStakeTransaction =
          await openingCeremonyContract.mintAndStake(offering, {
            gasLimit: ENV_VARS.VITE_PUBLIC_MINT_AND_STAKE_GAS_LIMIT || 500000,
          });

        // Show feedback to user
        openNotification({
          title: `Incense burned`,
          hash: mintAndStakeTransaction.hash,
        });

        await mintAndStakeTransaction.wait();
        setRitual(
          new Map(
            ritual.set(RitualKind.OFFERING_STAKING, {
              completedBalanceApproval: RitualStatus.COMPLETED,
              inviteFriendTransaction: RitualStatus.NO_STATUS,
              completedTransaction: RitualStatus.COMPLETED,
              verifyingTransaction: RitualStatus.NO_STATUS,
              ritualMessage: 'burn more incense?',
            })
          )
        );
        await updateWallet(false);
      } catch (e) {
        /* TODO: Set a notification transaction has failed */
        setRitual(
          new Map(
            ritual.set(RitualKind.OFFERING_STAKING, {
              inviteFriendTransaction: RitualStatus.NO_STATUS,
              completedBalanceApproval: RitualStatus.COMPLETED,
              completedTransaction: RitualStatus.FAILED,
              verifyingTransaction: RitualStatus.NO_STATUS,
              ritualMessage: 'RITUAL FAILED ➢ PRAY HARDER',
            })
          )
        );
      }
    }
  };

  const unstake = async (amount: BigNumber) => {
    if (walletAddress && signerState) {
      const TEMPLE_STAKING = new TempleStaking__factory(signerState).attach(
        TEMPLE_STAKING_ADDRESS
      );

      const OGTContract = new OGTemple__factory(signerState).attach(
        await TEMPLE_STAKING.OG_TEMPLE()
      );

      const EXIT_QUEUE = new ExitQueue__factory(signerState).attach(
        EXIT_QUEUE_ADDRESS
      );

      try {
        setRitual(
          new Map(
            ritual.set(RitualKind.OGT_UNLOCK, {
              completedBalanceApproval: RitualStatus.COMPLETED,
              completedTransaction: RitualStatus.PROCESSING,
              verifyingTransaction: RitualStatus.NO_STATUS,
              inviteFriendTransaction: RitualStatus.NO_STATUS,
            })
          )
        );
        const ogTempleBalance: BigNumber = await OGTContract.balanceOf(
          walletAddress
        );
        // ensure user input is not greater than user balance. if greater use all user balance.
        const offering = amount.lte(ogTempleBalance) ? amount : ogTempleBalance;
        const baseGas = Number(
          ENV_VARS.VITE_PUBLIC_TEMPLE_STAKING_UNSTAKE_BASE_GAS_LIMIT || 300000
        );
        const gasPerEpoch = Number(
          ENV_VARS.VITE_PUBLIC_TEMPLE_STAKING_UNSTAKE_PER_EPOCH_GAS_LIMIT ||
            20000
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
          title: `Queue joined`,
          hash: unstakeTXN.hash,
        });

        setRitual(
          new Map(
            ritual.set(RitualKind.OGT_UNLOCK, {
              completedBalanceApproval: RitualStatus.COMPLETED,
              inviteFriendTransaction: RitualStatus.NO_STATUS,
              completedTransaction: RitualStatus.COMPLETED,
              verifyingTransaction: RitualStatus.NO_STATUS,
              ritualMessage: `${OG_TEMPLE_TOKEN} Unlocked`,
            })
          )
        );
        getExitQueueData();
        await updateWallet(false);
      } catch (e) {
        /* TODO: Set a notification transaction has failed */
        console.info(`error: ${JSON.stringify(e, null, 2)}`);
        setRitual(
          new Map(
            ritual.set(RitualKind.OFFERING_STAKING, {
              inviteFriendTransaction: RitualStatus.NO_STATUS,
              completedBalanceApproval: RitualStatus.COMPLETED,
              completedTransaction: RitualStatus.FAILED,
              verifyingTransaction: RitualStatus.NO_STATUS,
              ritualMessage: 'RITUAL FAILED ➢ PRAY HARDER',
            })
          )
        );
      }
    }
  };

  //TODO: purge?
  const getLockInPeriod = async () => {
    // if (walletAddress && signerState) {
    //   const presaleContract = new Presale__factory(signerState)
    //       .attach(PRESALE_ADDRESS)
    //
    //   const unlockTimestamp = (await presaleContract.unlockTimestamp()).toNumber();
    //   const now = Date.now();
    //   const diff = unlockTimestamp - now;
    //   // Transform ms to days
    //   const lip = diff / 1000 / 60 / 60 / 24;
    //   setLockInPeriod(Math.ceil(lip));
    // }
  };

  const clearRitual = (ritualKind: RitualKind) => {
    ritual.delete(ritualKind);
    setRitual(new Map(ritual));
  };

  const claim = async (
    claimType: ClaimType
  ): Promise<TransactionReceipt | void> => {
    if (walletAddress && signerState) {
      const { default: claims } = await import(
        `../data/claims/${claimType}.json`
      );

      const {
        hash,
        signature,
        tokenAddress,
        tokenQuantity,
        nonce,
      }: {
        hash: string;
        signature: string;
        tokenAddress: string;
        tokenQuantity: string;
        nonce: string;
      } = claims[walletAddress.toLowerCase()];

      const templeCashback = new TempleCashback__factory(signerState).attach(
        TEMPLE_CASHBACK_ADDRESS
      );

      const tx = await templeCashback.claim(
        hash,
        signature,
        tokenAddress,
        tokenQuantity,
        nonce,
        {
          gasLimit: ENV_VARS.VITE_PUBLIC_CLAIM_GAS_LIMIT || 100000,
        }
      );

      return tx.wait();
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
    if (signerState) {
      const faithAirdrop = new FaithMerkleAirdrop__factory(signerState).attach(
        FAITH_AIRDROP_ADDRESS
      );

      const tx = await faithAirdrop.claim(index, address, amount, proof, {
        gasLimit: ENV_VARS.VITE_PUBLIC_CLAIM_FAITH_GAS_LIMIT || 100000,
      });

      return tx.wait();
    } else {
      console.error('Missing wallet address');
    }
  };

  const verifyAMMWhitelist = async (
    signature: string
  ): Promise<ethers.ContractTransaction | void> => {
    if (walletAddress && signerState) {
      const AMMWhitelist = new AMMWhitelist__factory(signerState).attach(
        AMM_WHITELIST_ADDRESS
      );

      try {
        const sig = await ethers.utils.splitSignature(signature.trim());
        return await AMMWhitelist.verify(sig.v, sig.r, sig.s);
      } catch (e) {
        console.error(e);
      }
    } else {
      console.error('Missing wallet address');
    }
  };

  const claimOgTemple = async (lockedEntryIndex: number) => {
    if (walletAddress && signerState) {
      const lockedOGTempleContract = new LockedOGTempleDeprecated__factory(
        signerState
      ).attach(LOCKED_OG_TEMPLE_ADDRESS);

      const withdrawTXN = await lockedOGTempleContract.withdraw(
        lockedEntryIndex,
        {
          gasLimit: ENV_VARS.VITE_PUBLIC_CLAIM_OGTEMPLE_GAS_LIMIT || 100000,
        }
      );

      await withdrawTXN.wait();

      openNotification({
        title: `${OG_TEMPLE_TOKEN} claimed`,
        hash: withdrawTXN.hash,
      });
    }
  };

  const getRewardsForOGT = async (
    ogtAmount: number
  ): Promise<number | void> => {
    if (walletAddress && signerState) {
      const STAKING = new TempleStaking__factory(signerState).attach(
        TEMPLE_STAKING_ADDRESS
      );
      return fromAtto(await STAKING.balance(toAtto(ogtAmount)));
    }
  };

  const claimAvailableTemple = async (): Promise<void> => {
    if (walletAddress && signerState) {
      const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(
        signerState
      ).attach(ACCELERATED_EXIT_QUEUE_ADDRESS);

      if (exitQueueData.claimableEpochs.length) {
        const baseCase =
          ENV_VARS.VITE_PUBLIC_WITHDRAW_EPOCHS_BASE_GAS_LIMIT || 60000;
        const perEpoch =
          ENV_VARS.VITE_PUBLIC_WITHDRAW_EPOCHS_PER_EPOCH_GAS_LIMIT || 15000;
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
          title: `${TEMPLE_TOKEN} claimed`,
          hash: withdrawTXN.hash,
        });
      }
      getBalance();
    }
  };

  const restakeAvailableTemple = async (): Promise<void> => {
    if (walletAddress && signerState) {
      const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(
        signerState
      ).attach(ACCELERATED_EXIT_QUEUE_ADDRESS);

      const EXIT_QUEUE = new ExitQueue__factory(signerState).attach(
        EXIT_QUEUE_ADDRESS
      );

      const userData = await EXIT_QUEUE.userData(walletAddress);

      const currentEpoch = (await EXIT_QUEUE.currentEpoch()).toNumber();
      const firstEpoch = userData.FirstExitEpoch.toNumber();
      const lastEpoch = userData.LastExitEpoch.toNumber();
      const exitEntryPromises = [];

      // stores all epochs address has in the ExitQueue.sol, some might have Allocation 0
      const maybeClaimableEpochs: Array<number> = [];
      // stores all epochs with allocations for address
      const claimableEpochs: Array<number> = [];

      for (let i = firstEpoch; i <= lastEpoch; i++) {
        maybeClaimableEpochs.push(i);
        exitEntryPromises.push(
          EXIT_QUEUE.currentEpochAllocation(walletAddress, i)
        );
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
        const baseCase =
          ENV_VARS.VITE_PUBLIC_RESTAKE_EPOCHS_BASE_GAS_LIMIT || 175000;
        const perEpoch =
          ENV_VARS.VITE_PUBLIC_RESTAKE_EPOCHS_PER_EPOCH_GAS_LIMIT || 20000;
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
          title: `${TEMPLE_TOKEN} restaked`,
          hash: restakeTXN.hash,
        });
      }
      getBalance();
    }
  };

  const buy = async (
    amountInFrax: BigNumber,
    minAmountOutTemple: BigNumber
  ) => {
    if (walletAddress && signerState) {
      const AMM_ROUTER = new TempleFraxAMMRouter__factory(signerState).attach(
        TEMPLE_V2_ROUTER_ADDRESS
      );
      const STABLE_TOKEN = new ERC20__factory(signerState).attach(
        STABLE_COIN_ADDRESS
      );

      await ensureAllowance(
        STABLE_COIN_SYMBOL,
        STABLE_TOKEN,
        TEMPLE_V2_ROUTER_ADDRESS,
        amountInFrax
      );

      const balance = await STABLE_TOKEN.balanceOf(walletAddress);
      const verifiedAmountInFrax = amountInFrax.lt(balance)
        ? amountInFrax
        : balance;

      const deadline = formatNumberNoDecimals(Date.now() / 1000 + DEADLINE);

      const buyTXN = await AMM_ROUTER.swapExactFraxForTemple(
        verifiedAmountInFrax,
        minAmountOutTemple,
        walletAddress,
        deadline,
        {
          gasLimit:
            ENV_VARS.VITE_PUBLIC_AMM_FRAX_FOR_TEMPLE_GAS_LIMIT || 300000,
        }
      );
      await buyTXN.wait();
      // Show feedback to user
      openNotification({
        title: `Sacrificed ${STABLE_COIN_SYMBOL}`,
        hash: buyTXN.hash,
      });
    }
  };

  /**
   * AMM Sell
   * @param amountInTemple: Amount of $TEMPLE user wants to sell
   * @param minAmountOutFrax: % user is giving as slippage
   */
  const sell = async (
    amountInTemple: BigNumber,
    minAmountOutFrax: BigNumber
  ) => {
    if (walletAddress && signerState) {
      const AMM_ROUTER = new TempleFraxAMMRouter__factory(signerState).attach(
        TEMPLE_V2_ROUTER_ADDRESS
      );
      const TEMPLE = new TempleERC20Token__factory(signerState).attach(
        TEMPLE_ADDRESS
      );

      await ensureAllowance(
        TEMPLE_TOKEN,
        TEMPLE,
        TEMPLE_V2_ROUTER_ADDRESS,
        amountInTemple
      );

      const balance = await TEMPLE.balanceOf(walletAddress);
      const verifiedAmountInTemple = amountInTemple.lt(balance)
        ? amountInTemple
        : balance;

      const deadline = formatNumberNoDecimals(Date.now() / 1000 + DEADLINE);

      const sellTXN = await AMM_ROUTER.swapExactTempleForFrax(
        verifiedAmountInTemple,
        minAmountOutFrax,
        walletAddress,
        deadline,
        {
          gasLimit:
            ENV_VARS.VITE_PUBLIC_AMM_TEMPLE_FOR_FRAX_GAS_LIMIT || 195000,
        }
      );
      await sellTXN.wait();

      // Show feedback to user
      openNotification({
        title: `${TEMPLE_TOKEN} renounced`,
        hash: sellTXN.hash,
      });
    }
  };

  const getSellQuote = async (amountToSell: BigNumber) => {
    if (walletAddress && signerState) {
      const AMM_ROUTER = new TempleFraxAMMRouter__factory(signerState).attach(
        TEMPLE_V2_ROUTER_ADDRESS
      );

      const { amountOut } = await AMM_ROUTER.swapExactTempleForFraxQuote(
        amountToSell
      );

      return amountOut;
    }
    return BigNumber.from(0);
  };

  const getBuyQuote = async (fraxIn: BigNumber): Promise<BigNumber> => {
    if (walletAddress && signerState) {
      const AMM_ROUTER = new TempleFraxAMMRouter__factory(signerState).attach(
        TEMPLE_V2_ROUTER_ADDRESS
      );

      const { amountOutAMM, amountOutProtocol } =
        await AMM_ROUTER.swapExactFraxForTempleQuote(fraxIn);

      return amountOutAMM.add(amountOutProtocol);
    }
    return BigNumber.from(0);
  };

  const stake = async (amountToStake: BigNumber) => {
    if (walletAddress && signerState) {
      console.info(`staking START`);
      const TEMPLE_STAKING = new TempleStaking__factory(signerState).attach(
        TEMPLE_STAKING_ADDRESS
      );

      const TEMPLE = new TempleERC20Token__factory(signerState).attach(
        TEMPLE_ADDRESS
      );

      await ensureAllowance(
        TEMPLE_TOKEN,
        TEMPLE,
        TEMPLE_STAKING_ADDRESS,
        amountToStake
      );

      const balance = await TEMPLE.balanceOf(walletAddress);
      const verifiedAmountToStake = amountToStake.lt(balance)
        ? amountToStake
        : balance;

      const stakeTXN = await TEMPLE_STAKING.stake(verifiedAmountToStake, {
        gasLimit: ENV_VARS.VITE_PUBLIC_STAKE_GAS_LIMIT || 150000,
      });
      await stakeTXN.wait();

      // Show feedback to user
      openNotification({
        title: `${TEMPLE_TOKEN} staked`,
        hash: stakeTXN.hash,
      });
    }
  };

  const epochsToDays = async (epochs: number) => {
    if (signerState) {
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
        const num =
          await ACCELERATED_EXIT_QUEUE.epochAccelerationFactorNumerator();
        const den =
          await ACCELERATED_EXIT_QUEUE.epochAccelerationFactorDenominator();
        const acceleratedDays = epochsToDays / (1 + num.div(den).toNumber());
        return formatNumber(acceleratedDays);
      }

      return formatNumber(epochsToDays);
    }

    return 0;
  };

  const getJoinQueueData = async (
    ogtAmount: BigNumber
  ): Promise<JoinQueueData | void> => {
    if (walletAddress && signerState) {
      const EXIT_QUEUE = new ExitQueue__factory(signerState).attach(
        EXIT_QUEUE_ADDRESS
      );
      const STAKING = new TempleStaking__factory(signerState).attach(
        TEMPLE_STAKING_ADDRESS
      );
      const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory(
        signerState
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
        queueLength: await epochsToDays(
          queueLengthEpochs >= 0 ? queueLengthEpochs : 0
        ),
        processTime: await epochsToDays(processTimeEpochs),
      };
    }
  };

  const collectTempleTeamPayment = async (
    paymentType: TEAM_PAYMENTS_TYPES,
    epoch: TEAM_PAYMENTS_EPOCHS
  ) => {
    if (walletAddress && signerState) {
      const fixedTeamPaymentAddress =
        TEAM_PAYMENTS_FIXED_ADDRESSES_BY_EPOCH[epoch];
      const contingentTeamPaymentAddress =
        TEAM_PAYMENTS_CONTINGENT_ADDRESSES_BY_EPOCH[epoch];

      const teamPaymentContract = new TempleTeamPayments__factory(
        signerState
      ).attach(
        paymentType === TEAM_PAYMENTS_TYPES.FIXED
          ? fixedTeamPaymentAddress
          : contingentTeamPaymentAddress
      );

      const collectTxn = await teamPaymentContract.claim();

      const txnReceipt = await collectTxn.wait();

      openNotification({
        title: `${TEMPLE_TOKEN} claimed`,
        hash: collectTxn.hash,
      });

      return txnReceipt;
    } else {
      console.error('Missing wallet address');
    }
  };

  const verifyFaith = async () => {
    if (walletAddress && signerState) {
      const DEVOTION = new Devotion__factory(signerState).attach(
        TEMPLE_DEVOTION_ADDRESS
      );

      const TEMPLE_STAKING = new TempleStaking__factory(signerState).attach(
        TEMPLE_STAKING_ADDRESS
      );

      const OG_TEMPLE = new OGTemple__factory(signerState).attach(
        await TEMPLE_STAKING.OG_TEMPLE()
      );

      const walletOGTEMPLE = await OG_TEMPLE.balanceOf(walletAddress);
      await ensureAllowance(
        OG_TEMPLE_TOKEN,
        OG_TEMPLE,
        LOCKED_OG_TEMPLE_DEVOTION_ADDRESS,
        walletOGTEMPLE
      );

      const faithVerificationTXN = await DEVOTION.lockAndVerify(
        walletOGTEMPLE,
        {
          gasLimit:
            ENV_VARS.VITE_PUBLIC_DEVOTION_LOCK_AND_VERIFY_GAS_LIMIT || 250000,
        }
      );
      await faithVerificationTXN.wait();

      openNotification({
        title: `${FAITH_TOKEN} verified`,
        hash: faithVerificationTXN.hash,
      });
    } else {
      console.error('Missing wallet address');
    }
  };

  const redeemFaith = async (faithAmount: BigNumber) => {
    if (walletAddress && signerState) {
      const DEVOTION = new Devotion__factory(signerState).attach(
        TEMPLE_DEVOTION_ADDRESS
      );

      const faithClaimTXN = await DEVOTION.claimTempleReward(faithAmount);
      await faithClaimTXN.wait();

      openNotification({
        title: `${FAITH_TOKEN} redeemed`,
        hash: faithClaimTXN.hash,
      });
    } else {
      console.error('Missing wallet address');
    }
  };

  const getTempleFaithReward = async (faithAmount: BigNumber) => {
    if (walletAddress && signerState) {
      const DEVOTION = new Devotion__factory(signerState).attach(
        TEMPLE_DEVOTION_ADDRESS
      );

      return await DEVOTION.claimableTempleRewardQuote(faithAmount);
    } else {
      console.error('Missing wallet address');
    }
  };

  const getFaithQuote = async () => {
    if (walletAddress && signerState) {
      const DEVOTION = new Devotion__factory(signerState).attach(
        TEMPLE_DEVOTION_ADDRESS
      );

      const faithQuote = await DEVOTION.verifyFaithQuote(walletAddress);
      return {
        canClaim: faithQuote.canClaim,
        claimableFaith: faithQuote.claimableFaith.toNumber(),
      };
    } else {
      console.error('Missing wallet address');
    }
  };

  return (
    <WalletContext.Provider
      value={{
        balance: balanceState,
        exchangeRate: exchangeRateState,
        ritual: ritual,
        allocation,
        isConnected: isConnectedState,
        wallet: walletAddress,
        lockInPeriod,
        currentEpoch,
        isLoading,
        ocTemplar,
        templePrice,
        buy,
        sell,
        connectWallet,
        changeWalletAddress,
        updateWallet,
        stake,
        mintAndStake,
        increaseAllowanceForRitual,
        clearRitual,
        //verifyQuest,
        inviteFriend,
        verifyAMMWhitelist,
        maxInvitesPerVerifiedUser,
        claim,
        claimFaithAirdrop,
        signer: signerState,
        network,
        claimOgTemple,
        getRewardsForOGT,
        claimAvailableTemple,
        exitQueueData,
        lockedEntries,
        getJoinQueueData,
        getSellQuote,
        getBuyQuote,
        getBalance,
        apy,
        restakeAvailableTemple,
        collectTempleTeamPayment,
        verifyFaith,
        redeemFaith,
        getTempleFaithReward,
        getFaithQuote,
        faith,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
