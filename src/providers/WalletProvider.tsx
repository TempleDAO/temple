import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { STABLE_COIN_SYMBOL } from 'components/Pages/Rituals';
import { ClaimType } from 'enums/claim-type';
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
  AMMWhitelist__factory,
  ERC20,
  ERC20__factory,
  ExitQueue__factory,
  LockedOGTempleDeprecated__factory,
  OGTemple__factory,
  OpeningCeremony__factory,
  TempleCashback__factory,
  TempleERC20Token__factory,
  TempleFraxAMMRouter__factory,
  TempleStaking__factory,
  TempleTreasury__factory,
  TempleUniswapV2Pair__factory,
  UniswapV2Pair__factory,
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

type COIN_TYPE = 'FRAX' | 'OGT' | 'TEMPLE';

enum ETH_ACTIONS {
  REQUEST_ACCOUNTS = 'eth_requestAccounts',
  REQUEST_PERMISSIONS = 'wallet_requestPermissions',
}

export type Balance = {
  stableCoin: number;
  temple: number;
  ogTempleLocked: number;
  ogTemple: number;
} | null;

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
  claimableAt: number;
  // list of epochs with a claimable amount
  claimableEpochs: Array<number>;
}

export interface JoinQueueData {
  // current queue length
  queueLength: number;
  // how is going to take to process OG TEMPLE
  processTime: number;
}

interface WalletState {
  // has the user connected a wallet to the dapp
  isConnected: boolean;

  wallet: string | null;
  // current
  balance: Balance;
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

  verifyAMMWhitelist(signature: string): Promise<ContractTransaction | void>;

  claimOgTemple(lockedEntryIndex: number): Promise<void>;

  claimAvailableTemple(): Promise<void>;

  getRewardsForOGT(ogtAmount: number): Promise<number | void>;

  getJoinQueueData(ogtAmount: BigNumber): Promise<JoinQueueData | void>;

  getSellQuote(amountToSell: BigNumber): Promise<BigNumber | void>;

  getBuyQuote(amountToBuy: BigNumber): Promise<BigNumber | void>;

  getBalance(): Promise<Balance | void>;

  apy: number;
}

const INITIAL_STATE: WalletState = {
  balance: null,
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
    claimableAt: 0,
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
  verifyAMMWhitelist: asyncNoop,
  signer: null,
  claimOgTemple: asyncNoop,
  getRewardsForOGT: asyncNoop,
  claimAvailableTemple: asyncNoop,
  getJoinQueueData: asyncNoop,
  getSellQuote: asyncNoop,
  getBuyQuote: asyncNoop,
  getBalance: asyncNoop,
  apy: 0,
};

const STABLE_COIN_ADDRESS = ENV_VARS.VITE_PUBLIC_STABLE_COIN_ADDRESS;
const TEMPLE_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_ADDRESS;
const LOCKED_OG_TEMPLE_ADDRESS = ENV_VARS.VITE_PUBLIC_LOCKED_OG_TEMPLE_ADDRESS;
const TEMPLE_STAKING_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_STAKING_ADDRESS;
const TREASURY_ADDRESS = ENV_VARS.VITE_PUBLIC_TREASURY_ADDRESS;
const EXIT_QUEUE_ADDRESS = ENV_VARS.VITE_PUBLIC_EXIT_QUEUE_ADDRESS;
const OPENING_CEREMONY_ADDRESS = ENV_VARS.VITE_PUBLIC_OPENING_CEREMONY_ADDRESS;
const VERIFY_QUEST_ADDRESS = ENV_VARS.VITE_PUBLIC_VERIFY_QUEST_ADDRESS;
const TEMPLE_CASHBACK_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_CASHBACK_ADDRESS;
const AMM_WHITELIST_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_ROUTER_WHITELIST;
const TEMPLE_V2_ROUTER_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_V2_ROUTER_ADDRESS;
const TEMPLE_V2_PAIR_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_V2_PAIR_ADDRESS;

if (
  STABLE_COIN_ADDRESS === undefined ||
  TEMPLE_ADDRESS === undefined ||
  TEMPLE_STAKING_ADDRESS === undefined ||
  TREASURY_ADDRESS === undefined ||
  LOCKED_OG_TEMPLE_ADDRESS === undefined ||
  EXIT_QUEUE_ADDRESS === undefined ||
  OPENING_CEREMONY_ADDRESS === undefined ||
  VERIFY_QUEST_ADDRESS === undefined ||
  TEMPLE_CASHBACK_ADDRESS === undefined ||
  TEMPLE_V2_ROUTER_ADDRESS === undefined ||
  TEMPLE_V2_PAIR_ADDRESS === undefined
) {
  console.info(`
STABLE_COIN_ADDRESS=${STABLE_COIN_ADDRESS}
TEMPLE_ADDRESS=${TEMPLE_ADDRESS}
TEMPLE_STAKING_ADDRESS=${TEMPLE_STAKING_ADDRESS}
TREASURY_ADDRESS=${TREASURY_ADDRESS}
LOCKED_OG_TEMPLE_ADDRESS=${LOCKED_OG_TEMPLE_ADDRESS}
EXIT_QUEUE_ADDRESS=${EXIT_QUEUE_ADDRESS}
OPENING_CEREMONY_ADDRESS=${OPENING_CEREMONY_ADDRESS}
VERIFY_QUEST_ADDRESS=${VERIFY_QUEST_ADDRESS}
TEMPLE_CASHBACK_ADDRESS=${TEMPLE_CASHBACK_ADDRESS}
TEMPLE_V2_ROUTER_ADDRESS=${TEMPLE_V2_ROUTER_ADDRESS}
TEMPLE_V2_PAIR_ADDRESS=${TEMPLE_V2_PAIR_ADDRESS}
`);
  throw new Error(`Missing contract address from .env`);
}

const WalletContext = createContext<WalletState>(INITIAL_STATE);

export const WalletProvider = (props: PropsWithChildren<any>) => {
  const { children } = props;
  const [provider, setProvider] = useState<JsonRpcProvider | null>(null);
  const [signerState, setSignerState] = useState<JsonRpcSigner | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnectedState, setIsConnectedState] = useState(false);
  const [balanceState, setBalanceState] = useState<Balance>(null);
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
      }

      return () => {
        ethereum.removeListener('accountsChanged');
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
        const openingCeremonyContract = new OpeningCeremony__factory()
          .attach(OPENING_CEREMONY_ADDRESS)
          .connect(signerState);

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
      const openingCeremony = new OpeningCeremony__factory()
        .attach(OPENING_CEREMONY_ADDRESS)
        .connect(signerState);

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
      const openingCeremony = new OpeningCeremony__factory()
        .attach(OPENING_CEREMONY_ADDRESS)
        .connect(signerState);

      const ocMaxInvitesPerVerifiedUser =
        await openingCeremony.maxInvitesPerVerifiedUser();
      setMaxInvitesPerVerifiedUser(ocMaxInvitesPerVerifiedUser.toNumber());
    }
  };

  const getLockedEntries = async () => {
    if (walletAddress && signerState) {
      const ogLockedTemple = new LockedOGTempleDeprecated__factory()
        .attach(LOCKED_OG_TEMPLE_ADDRESS)
        .connect(signerState);

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

      setLockedEntries([...lockedEntriesVals]);
    }
  };

  const getExitQueueData = async () => {
    if (walletAddress && signerState) {
      const EXIT_QUEUE = new ExitQueue__factory()
        .attach(EXIT_QUEUE_ADDRESS)
        .connect(signerState);

      const userData = await EXIT_QUEUE.userData(walletAddress);
      const totalTempleOwned = fromAtto(userData.Amount);

      if (totalTempleOwned === 0) {
        setExitQueueData(INITIAL_STATE.exitQueueData);
        return;
      }

      const currentEpoch = (await EXIT_QUEUE.currentEpoch()).toNumber();
      const firstEpoch = userData.FirstExitEpoch.toNumber();
      const lastEpoch = userData.LastExitEpoch.toNumber();
      const today = new Date();
      const daysUntilClaimable = await epochsToDays(
        lastEpoch - currentEpoch + 1
      );
      const claimableAt = today.setDate(today.getDate() + daysUntilClaimable);
      const exitEntryPromises = [];

      // stores all epochs address has in the ExitQueue.sol, some might have Allocation 0
      const maybeClaimableEpochs: Array<number> = [];
      // stores all epochs with allocations for address
      const claimableEpochs: Array<number> = [];
      console.log(firstEpoch, currentEpoch, currentEpoch - firstEpoch);
      for (let i = firstEpoch; i < currentEpoch; i++) {
        maybeClaimableEpochs.push(i);
        exitEntryPromises.push(
          EXIT_QUEUE.currentEpochAllocation(walletAddress, i)
        );
      }

      console.log(exitEntryPromises.length);
      console.log(exitEntryPromises);

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
        claimableAt,
        claimableTemple,
        totalTempleOwned,
        claimableEpochs,
      });
    }
  };

  const getApy = async () => {
    if (walletAddress && signerState) {
      // const TEMPLE_STAKING = new TempleStaking__factory()
      //   .attach(TEMPLE_STAKING_ADDRESS)
      //   .connect(signerState);
      // const SCALE_FACTOR = 10000;
      /* TODO: update this back to read from contract once we decide */
      // const epy = (await TEMPLE_STAKING.getEpy(SCALE_FACTOR)).toNumber();
      // setApy(Math.trunc((Math.pow(epy / SCALE_FACTOR + 1, 365.25) - 1) * 100));
      const epy = 0.01;
      setApy(Math.trunc((Math.pow(epy + 1, 365.25) - 1) * 100));
    }
  };

  const getTemplePrice = async () => {
    if (walletAddress && signerState) {
      const TEMPLE_UNISWAP_V2_PAIR = new TempleUniswapV2Pair__factory()
        .attach(TEMPLE_V2_PAIR_ADDRESS)
        .connect(signerState);

      const { _reserve0, _reserve1 } =
        await TEMPLE_UNISWAP_V2_PAIR.getReserves();
      setTemplePrice(fromAtto(_reserve1) / fromAtto(_reserve0));
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

  const getBalance = async (): Promise<Balance> => {
    if (walletAddress && signerState) {
      const stableCoinContract = new ERC20__factory()
        .attach(STABLE_COIN_ADDRESS)
        .connect(signerState);

      const ogLockedTemple = new LockedOGTempleDeprecated__factory()
        .attach(LOCKED_OG_TEMPLE_ADDRESS)
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
      const templeLockedPromises = [];
      for (let i = 0; i < lockedNum; i++) {
        templeLockedPromises.push(ogLockedTemple.locked(walletAddress, i));
      }

      const templeLocked = await Promise.all(templeLockedPromises);
      templeLocked.map((x) => {
        ogTempleLocked += fromAtto(x.BalanceOGTemple);
      });

      const ogTemple = fromAtto(
        await OG_TEMPLE_CONTRACT.balanceOf(walletAddress)
      );
      const temple = fromAtto(await templeContract.balanceOf(walletAddress));
      const balance: Balance = {
        stableCoin: fromAtto(stableCoinBalance),
        temple: temple,
        ogTempleLocked: ogTempleLocked,
        ogTemple: ogTemple,
      };
      setBalanceState(balance);
      return balance;
    }
    return null;
  };

  const getExchangeRate = async (): Promise<void> => {
    if (walletAddress && signerState) {
      const treasury = new TempleTreasury__factory()
        .attach(TREASURY_ADDRESS)
        .connect(signerState);

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
      const openingCeremony = new OpeningCeremony__factory()
        .attach(OPENING_CEREMONY_ADDRESS)
        .connect(signerState);

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
      const stableCoinContract = new ERC20__factory()
        .attach(STABLE_COIN_ADDRESS)
        .connect(signerState);
      const templeStakingContract = new TempleStaking__factory()
        .attach(TEMPLE_STAKING_ADDRESS)
        .connect(signerState);
      const STAKING_OC_TEMPLE = await templeStakingContract.OG_TEMPLE();
      const OGTContract = new OGTemple__factory()
        .attach(STAKING_OC_TEMPLE)
        .connect(signerState);
      const TEMPLE = new TempleERC20Token__factory()
        .attach(TEMPLE_ADDRESS)
        .connect(signerState);

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
        case 'OGT':
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
            case 'OGT':
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
      const openingCeremonyContract = new OpeningCeremony__factory()
        .attach(OPENING_CEREMONY_ADDRESS)
        .connect(signerState);

      const stableCoinContract = new ERC20__factory()
        .attach(STABLE_COIN_ADDRESS)
        .connect(signerState);

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
      const TEMPLE_STAKING = new TempleStaking__factory()
        .attach(TEMPLE_STAKING_ADDRESS)
        .connect(signerState);

      const OGTContract = new OGTemple__factory()
        .attach(await TEMPLE_STAKING.OG_TEMPLE())
        .connect(signerState);

      const EXIT_QUEUE = new ExitQueue__factory()
        .attach(EXIT_QUEUE_ADDRESS)
        .connect(signerState);

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
        const ogTempleBalance: BigNumber = await OGTContract.allowance(
          walletAddress,
          TEMPLE_STAKING_ADDRESS
        );
        // ensure user input is not greater than user balance. if greater use all user balance.
        const offering = amount.lte(ogTempleBalance) ? amount : ogTempleBalance;
        const baseGas =
          ENV_VARS.VITE_PUBLIC_TEMPLE_STAKING_UNSTAKE_BASE_GAS_LIMIT || 55000;
        const gasPerEpoch =
          ENV_VARS.VITE_PUBLIC_TEMPLE_STAKING_UNSTAKE_PER_EPOCH_GAS_LIMIT ||
          20000;
        const accFactor = await TEMPLE_STAKING.accumulationFactor();
        const maxPerEpoch = await EXIT_QUEUE.maxPerEpoch();
        const epochs = offering.mul(accFactor).div(maxPerEpoch);
        const recommendedGas =
          Number(baseGas) + Number(gasPerEpoch) * epochs.toNumber();

        const unstakeTXN = await TEMPLE_STAKING.unstake(offering, {
          gasLimit: recommendedGas,
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

  const getLockInPeriod = async () => {
    // if (walletAddress && signerState) {
    //   const presaleContract = new Presale__factory()
    //       .attach(PRESALE_ADDRESS)
    //       .connect(signerState);
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

      const templeCashback = new TempleCashback__factory()
        .attach(TEMPLE_CASHBACK_ADDRESS)
        .connect(signerState);

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

  const verifyAMMWhitelist = async (
    signature: string
  ): Promise<ethers.ContractTransaction | void> => {
    if (walletAddress && signerState) {
      const AMMWhitelist = new AMMWhitelist__factory()
        .attach(AMM_WHITELIST_ADDRESS)
        .connect(signerState);

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
      const lockedOGTempleContract = new LockedOGTempleDeprecated__factory()
        .attach(LOCKED_OG_TEMPLE_ADDRESS)
        .connect(signerState);

      const withdrawTXN = await lockedOGTempleContract.withdraw(
        lockedEntryIndex,
        {
          gasLimit: ENV_VARS.VITE_PUBLIC_CLAIM_OGTEMPLE_GAS_LIMIT || 50000,
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
      const STAKING = new TempleStaking__factory()
        .attach(TEMPLE_STAKING_ADDRESS)
        .connect(signerState);
      return fromAtto(await STAKING.balance(toAtto(ogtAmount)));
    }
  };

  const claimAvailableTemple = async (): Promise<void> => {
    if (walletAddress && signerState) {
      const EXIT_QUEUE = new ExitQueue__factory()
        .attach(EXIT_QUEUE_ADDRESS)
        .connect(signerState);

      if (exitQueueData.claimableEpochs.length) {
        const baseCase =
          ENV_VARS.VITE_PUBLIC_WITHDRAW_EPOCHS_BASE_GAS_LIMIT || 60000;
        const perEpoch =
          ENV_VARS.VITE_PUBLIC_WITHDRAW_EPOCHS_PER_EPOCH_GAS_LIMIT || 15000;
        const recommendedGas =
          Number(baseCase) +
          Number(perEpoch) * exitQueueData.claimableEpochs.length;

        const withdrawTXN = await EXIT_QUEUE.withdrawEpochs(
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

  const buy = async (
    amountInFrax: BigNumber,
    minAmountOutTemple: BigNumber
  ) => {
    if (walletAddress && signerState) {
      const AMM_ROUTER = new TempleFraxAMMRouter__factory()
        .attach(TEMPLE_V2_ROUTER_ADDRESS)
        .connect(signerState);
      const STABLE_TOKEN = new ERC20__factory()
        .attach(STABLE_COIN_ADDRESS)
        .connect(signerState);

      await ensureAllowance(
        STABLE_COIN_SYMBOL,
        STABLE_TOKEN,
        TEMPLE_V2_ROUTER_ADDRESS,
        amountInFrax
      );

      const deadline = formatNumberNoDecimals(Date.now() / 1000 + DEADLINE);

      const buyTXN = await AMM_ROUTER.swapExactFraxForTemple(
        amountInFrax,
        minAmountOutTemple,
        walletAddress,
        deadline,
        {
          gasLimit:
            ENV_VARS.VITE_PUBLIC_AMM_FRAX_FOR_TEMPLE_GAS_LIMIT || 150000,
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
      const AMM_ROUTER = new TempleFraxAMMRouter__factory()
        .attach(TEMPLE_V2_ROUTER_ADDRESS)
        .connect(signerState);
      const TEMPLE = new TempleERC20Token__factory()
        .attach(TEMPLE_ADDRESS)
        .connect(signerState);

      await ensureAllowance(
        TEMPLE_TOKEN,
        TEMPLE,
        TEMPLE_V2_ROUTER_ADDRESS,
        amountInTemple
      );

      const deadline = formatNumberNoDecimals(Date.now() / 1000 + DEADLINE);

      const sellTXN = await AMM_ROUTER.swapExactTempleForFrax(
        amountInTemple,
        minAmountOutFrax,
        walletAddress,
        deadline,
        {
          gasLimit:
            ENV_VARS.VITE_PUBLIC_AMM_TEMPLE_FOR_FRAX_GAS_LIMIT || 175000,
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
      const AMM_ROUTER = new TempleFraxAMMRouter__factory()
        .attach(TEMPLE_V2_ROUTER_ADDRESS)
        .connect(signerState);

      const { amountOut } = await AMM_ROUTER.swapExactTempleForFraxQuote(
        amountToSell
      );

      return amountOut;
    }
    return BigNumber.from(0);
  };

  const getBuyQuote = async (fraxIn: BigNumber): Promise<BigNumber> => {
    if (walletAddress && signerState) {
      const AMM_ROUTER = new TempleFraxAMMRouter__factory()
        .attach(TEMPLE_V2_ROUTER_ADDRESS)
        .connect(signerState);

      const { amountOutAMM, amountOutProtocol } =
        await AMM_ROUTER.swapExactFraxForTempleQuote(fraxIn);

      return amountOutAMM.add(amountOutProtocol);
    }
    return BigNumber.from(0);
  };

  const stake = async (amountToStake: BigNumber) => {
    if (walletAddress && signerState) {
      console.info(`staking START`);
      const TEMPLE_STAKING = new TempleStaking__factory()
        .attach(TEMPLE_STAKING_ADDRESS)
        .connect(signerState);

      const TEMPLE = new TempleERC20Token__factory()
        .attach(TEMPLE_ADDRESS)
        .connect(signerState);

      await ensureAllowance(
        TEMPLE_TOKEN,
        TEMPLE,
        TEMPLE_STAKING_ADDRESS,
        amountToStake
      );
      const stakeTXN = await TEMPLE_STAKING.stake(amountToStake, {
        gasLimit: ENV_VARS.VITE_PUBLIC_STAKE_GAS_LIMIT || 80000,
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
      const EXIT_QUEUE = new ExitQueue__factory()
        .attach(EXIT_QUEUE_ADDRESS)
        .connect(signerState);

      const MAINNET_APROX_BLOCKS_PER_DAY = 6400;
      const epochSizeInBlocks = (await EXIT_QUEUE.epochSize()).toNumber();
      const epochsPerDay = MAINNET_APROX_BLOCKS_PER_DAY / epochSizeInBlocks;

      return formatNumber(epochs / epochsPerDay);
    }
    return 0;
  };

  const getJoinQueueData = async (
    ogtAmount: BigNumber
  ): Promise<JoinQueueData | void> => {
    if (walletAddress && signerState) {
      const EXIT_QUEUE = new ExitQueue__factory()
        .attach(EXIT_QUEUE_ADDRESS)
        .connect(signerState);
      const STAKING = new TempleStaking__factory()
        .attach(TEMPLE_STAKING_ADDRESS)
        .connect(signerState);

      const maxPerAddress = await EXIT_QUEUE.maxPerAddress();
      const maxPerEpoch = await EXIT_QUEUE.maxPerEpoch();
      const maxPerAddressPerEpoch = maxPerAddress.lt(maxPerEpoch)
        ? maxPerAddress
        : maxPerEpoch;

      const nextUnallocatedEpoch = await EXIT_QUEUE.nextUnallocatedEpoch();
      const currentEpoch = await EXIT_QUEUE.currentEpoch();
      const amountTemple = await STAKING.balance(ogtAmount);

      const queueLengthEpochs = nextUnallocatedEpoch
        .sub(currentEpoch)
        .toNumber();
      // number of blocks to process, always rounding up
      const processTimeEpochs =
        amountTemple.div(maxPerAddressPerEpoch).toNumber() +
        (amountTemple.mod(maxPerAddressPerEpoch).eq(0) ? 0 : 1);

      return {
        queueLength: await epochsToDays(queueLengthEpochs),
        processTime: await epochsToDays(processTimeEpochs),
      };
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
        signer: signerState,
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
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
