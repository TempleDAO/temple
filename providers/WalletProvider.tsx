import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber, ethers } from 'ethers';
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { STABLE_COIN_SYMBOL } from '../pages/rituals';
import {
  ERC20__factory,
  LockedOGTemple__factory,
  OpeningCeremony__factory,
  TempleTreasury__factory,
  VerifyQuest__factory
} from '../types/typechain';
import { fromAtto, toAtto } from '../utils/bigNumber';
import { noop } from '../utils/helpers';
import { useNotification } from './NotificationProvider';

/**
 * temple Staking . balance => all temple for user
 */

export enum RitualKind {
  OFFERING_STAKING = 'OFFERING_STAKING',
  VERIFYING = 'VERIFYING',
  INVITE_FRIEND = 'INVITE_FRIEND',
}

enum ETH_ACTIONS {
  REQUEST_ACCOUNTS = 'eth_requestAccounts',
  REQUEST_PERMISSIONS = 'wallet_requestPermissions',
}

export type Balance = {
  stableCoin: number,
  temple: number,
} | null;

export type Allocation = {
  amount: number,
  // Contract returns the number of block/days at which the user will be able to start the rituals
  // this value will be set to a timestamp of ms from epoch 0ms to ease use in dapp
  startEpoch: number | undefined,
}

export enum RitualStatus {
  NO_STATUS,
  COMPLETED,
  PROCESSING,
  FAILED,
}

type RitualMapping = Map<RitualKind, {
  completedBalanceApproval: RitualStatus,
  completedTransaction: RitualStatus,
  verifyingTransaction: RitualStatus,
  inviteFriendTransaction: RitualStatus,
  ritualMessage?: string,
}>;

interface OpeningCeremonyUser {
  isVerified: boolean;
  isGuest: boolean;
  numInvited: number;
  doublingIndexAtVerification: number;
  totalSacrificedStablec: number;
  totalSacrificedTemple: number;
}

interface WalletState {
  // has the user connected a wallet to the dapp
  isConnected: boolean,

  wallet: string | null,
  // current
  balance: Balance,

  exchangeRate: number,
  allocation: Allocation,
  ritual: RitualMapping,
  lockInPeriod: number,
  currentEpoch: number,
  isLoading: boolean,
  ocTemplar: OpeningCeremonyUser,
  maxInvitesPerVerifiedUser: number,

  connectWallet(): void

  changeWalletAddress(): void

  updateWallet(): Promise<void> | void

  buy(amountToBuy: number): void

  stake(amountToBuy: number): void

  mintAndStake(amountToBuy: BigNumber): void

  increaseAllowanceForRitual(amountToBuy: BigNumber, ritualKind: RitualKind): void

  clearRitual(ritualKind: RitualKind): void

  verifyQuest(sandalWoodToken: string, ritualKind: RitualKind): void

  inviteFriend(sandalWoodToken: string, ritualKind: RitualKind): void

}

const INITIAL_STATE: WalletState = {
  balance: null,
  // Fallback when user has not connected wallet, we can update this from Vercel and redeploy
  exchangeRate: process.env.NEXT_PUBLIC_EXCHANGE_RATE_VALUE
      ? +process.env.NEXT_PUBLIC_EXCHANGE_RATE_VALUE
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
  buy: noop,
  connectWallet: noop,
  changeWalletAddress: noop,
  updateWallet: noop,
  stake: noop,
  mintAndStake: noop,
  increaseAllowanceForRitual: noop,
  clearRitual: noop,
  verifyQuest: noop,
  inviteFriend: noop,
};

const STABLE_COIN_ADDRESS = process.env.NEXT_PUBLIC_STABLE_COIN_ADDRESS;
const TEMPLE_ADDRESS = process.env.NEXT_PUBLIC_TEMPLE_ADDRESS;
const LOCKED_OG_TEMPLE_ADDRESS = process.env.NEXT_PUBLIC_LOCKED_OG_TEMPLE_ADDRESS;
const TEMPLE_STAKING_ADDRESS = process.env.NEXT_PUBLIC_TEMPLE_STAKING_ADDRESS;
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
const EXIT_QUEUE_ADDRESS = process.env.NEXT_PUBLIC_EXIT_QUEUE_ADDRESS;
const OPENING_CEREMONY_ADDRESS = process.env.NEXT_PUBLIC_OPENING_CEREMONY_ADDRESS;
const VERIFY_QUEST_ADDRESS = process.env.NEXT_PUBLIC_VERIFY_QUEST_ADDRESS;

if (
    STABLE_COIN_ADDRESS === undefined
    || TEMPLE_ADDRESS === undefined
    || TEMPLE_STAKING_ADDRESS === undefined
    || TREASURY_ADDRESS === undefined
    || LOCKED_OG_TEMPLE_ADDRESS === undefined
    || EXIT_QUEUE_ADDRESS === undefined
    || OPENING_CEREMONY_ADDRESS === undefined
    || VERIFY_QUEST_ADDRESS === undefined
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
`);
  throw new Error(`Missinig contract address from .env`);
}

const WalletContext = createContext<WalletState>(INITIAL_STATE);

export const WalletProvider = (props: PropsWithChildren<any>) => {
  const { children } = props;
  const [provider, setProvider] = useState<JsonRpcProvider | null>(null);
  const [signerState, setSignerState] = useState<JsonRpcSigner | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnectedState, setIsConnectedState] = useState(false);
  const [balanceState, setBalanceState] = useState<Balance>(null);
  const [exchangeRateState, setExchangeRateState] = useState<number>(INITIAL_STATE.exchangeRate);
  const [allocation, setAllocation] = useState<Allocation>(INITIAL_STATE.allocation);
  const [ritual, setRitual] = useState<RitualMapping>(INITIAL_STATE.ritual);
  const [lockInPeriod, setLockInPeriod] = useState<number>(INITIAL_STATE.lockInPeriod);
  const [currentEpoch, setCurrentEpoch] = useState<number>(INITIAL_STATE.currentEpoch);
  const [isLoading, setIsLoading] = useState<boolean>(INITIAL_STATE.isLoading);
  const [ocTemplar, setOcTemplar] = useState<OpeningCeremonyUser>(INITIAL_STATE.ocTemplar);
  const [maxInvitesPerVerifiedUser, setMaxInvitesPerVerifiedUser] = useState<number>(INITIAL_STATE.maxInvitesPerVerifiedUser);

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

  const interactWithMetamask = async (action?: ETH_ACTIONS, syncConnected?: boolean) => {
    if (typeof window !== undefined) {
      // @ts-ignore
      const { ethereum } = window;

      if (ethereum && ethereum.isMetaMask) {
        const provider: JsonRpcProvider = new ethers.providers.Web3Provider(ethereum);

        if (action) {
          await provider.send(action, [{
            eth_accounts: {}
          }]);
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
        alert('Please add MetaMask to your browser');
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

  const verifyQuest = async (sandalWoodToken: string, ritualKind: RitualKind) => {
    if (walletAddress && signerState) {
      setRitual(new Map(ritual.set(ritualKind, {
        completedBalanceApproval: RitualStatus.NO_STATUS,
        completedTransaction: RitualStatus.NO_STATUS,
        inviteFriendTransaction: RitualStatus.NO_STATUS,
        verifyingTransaction: RitualStatus.PROCESSING,
      })));

      try {
        const verifyQuestContract = new VerifyQuest__factory()
            .attach(VERIFY_QUEST_ADDRESS)
            .connect(signerState);
        const sig = JSON.parse(Buffer.from(sandalWoodToken, 'base64').toString('ascii'));
        console.info(sig, sandalWoodToken);

        const verifyTransaction = await verifyQuestContract.verify(sig.v, sig.r, sig.s, {
          gasLimit: 125000
        });
        await verifyTransaction.wait();
        setRitual(new Map(ritual.set(ritualKind, {
          completedBalanceApproval: RitualStatus.NO_STATUS,
          completedTransaction: RitualStatus.NO_STATUS,
          inviteFriendTransaction: RitualStatus.NO_STATUS,
          verifyingTransaction: RitualStatus.COMPLETED,
          ritualMessage: `commence ${STABLE_COIN_SYMBOL} sacrifice`
        })));

        // Update Templar data from contract.
        await getOCTemplar();
      } catch (e) {
        setRitual(new Map(ritual.set(ritualKind, {
          completedBalanceApproval: RitualStatus.NO_STATUS,
          completedTransaction: RitualStatus.NO_STATUS,
          inviteFriendTransaction: RitualStatus.NO_STATUS,
          verifyingTransaction: RitualStatus.FAILED,
          ritualMessage: `RETRY`
        })));
      }
    }
  };

  const inviteFriend = async (friendAddress: string, ritualKind: RitualKind) => {
    if (walletAddress && signerState) {
      setRitual(new Map(ritual.set(ritualKind, {
        inviteFriendTransaction: RitualStatus.PROCESSING,
        completedBalanceApproval: RitualStatus.NO_STATUS,
        completedTransaction: RitualStatus.NO_STATUS,
        verifyingTransaction: RitualStatus.NO_STATUS,
      })));

      try {
        const openingCeremonyContract = new OpeningCeremony__factory()
            .attach(OPENING_CEREMONY_ADDRESS)
            .connect(signerState);

        const inviteGuestTransaction = await openingCeremonyContract.addGuestUser(friendAddress, {
          gasLimit: 85000
        });
        await inviteGuestTransaction.wait();

        setRitual(new Map(ritual.set(ritualKind, {
          completedBalanceApproval: RitualStatus.NO_STATUS,
          completedTransaction: RitualStatus.NO_STATUS,
          inviteFriendTransaction: RitualStatus.COMPLETED,
          verifyingTransaction: RitualStatus.NO_STATUS,
          ritualMessage: `continue`
        })));
      } catch (e) {
        setRitual(new Map(ritual.set(ritualKind, {
          inviteFriendTransaction: RitualStatus.FAILED,
          completedBalanceApproval: RitualStatus.NO_STATUS,
          completedTransaction: RitualStatus.NO_STATUS,
          verifyingTransaction: RitualStatus.NO_STATUS,
          ritualMessage: `failed to invite friend`
        })));
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
        doublingIndexAtVerification: ocTemplarData.doublingIndexAtVerification.toNumber(),
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

      const ocMaxInvitesPerVerifiedUser = await openingCeremony.maxInvitesPerVerifiedUser();
      setMaxInvitesPerVerifiedUser(ocMaxInvitesPerVerifiedUser.toNumber());
    }
  };

  /**
   * Load new data for the connected wallet
   * @param updateLoading Determines if the `isLoading` state should be updated
   */
  const updateWallet = async (updateLoading: boolean = true) => {
    if (updateLoading) {
      setIsLoading(true);
    }
    if (typeof window !== undefined) {
      // @ts-ignore
      const ethereum = window.ethereum;
      if (ethereum) {
        isConnected();
        await getOCTemplar();
        await getCurrentEpoch();
        await getExchangeRate();
        await getLockInPeriod();
        await getBalance();
        await getAllocation();
        await getMaxInvitesPerVerifiedUser();
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

      const ogLockedTemple = new LockedOGTemple__factory()
          .attach(LOCKED_OG_TEMPLE_ADDRESS)
          .connect(signerState);

      const stableCoinBalance: BigNumber = await stableCoinContract.balanceOf(walletAddress);

      // get the locked OG temple
      const lockedNum = (await ogLockedTemple.numLocks(walletAddress)).toNumber();
      let templeBalance: number = 0;
      const templeLockedPromises = [];
      for (let i = 0; i < lockedNum; i++) {
        templeLockedPromises.push(ogLockedTemple.locked(walletAddress, i));
      }

      const templeLocked = await Promise.all(templeLockedPromises);
      templeLocked.map(x => {
        templeBalance += fromAtto(x.BalanceOGTemple);
      });

      const balance: Balance = {
        stableCoin: fromAtto(stableCoinBalance),
        temple: templeBalance,
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
      const rate = (fromAtto(temple) / fromAtto(stablec)) / mintMultiple;
      // Only change the value if contract has valid data
      if (rate > 0) {
        setExchangeRateState(rate);
      }
    }
  };

  const getCurrentEpoch = async (): Promise<void> => {
    if (provider) {
      const blockNumber = await provider.getBlockNumber();
      const currentBlockTimestamp = (await provider.getBlock(blockNumber)).timestamp;
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
          ? fromAtto(await openingCeremony.maxSacrificableStablec(ocTemplar.doublingIndexAtVerification))
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

  const increaseAllowanceForRitual = async (amount: BigNumber, ritualKind: RitualKind) => {
    if (walletAddress && signerState) {
      setRitual(new Map(ritual.set(ritualKind, {
        completedBalanceApproval: RitualStatus.PROCESSING,
        completedTransaction: RitualStatus.NO_STATUS,
        inviteFriendTransaction: RitualStatus.NO_STATUS,
        verifyingTransaction: RitualStatus.NO_STATUS,
      })));
      const stableCoinContract = new ERC20__factory()
          .attach(STABLE_COIN_ADDRESS)
          .connect(signerState);
      let approvalFailed: boolean = false;
      const stableCoinAllowance = await stableCoinContract.allowance(walletAddress, OPENING_CEREMONY_ADDRESS);

      if (stableCoinAllowance.lt(amount)) {
        try {
          // We want to save gas burn $ for the Templars,
          // so we approving 1M up front, so only 1 approve TXN is required for approve
          const ONE_MILLION = toAtto(1000000);
          const stableApproveTransaction = await stableCoinContract.approve(OPENING_CEREMONY_ADDRESS, ONE_MILLION);
          // Show feedback to user
          openNotification({
            title: `${STABLE_COIN_SYMBOL} Approved`,
            hash: stableApproveTransaction.hash
          });
          await stableApproveTransaction.wait();

        } catch (e) {
          approvalFailed = true;
          setRitual(new Map(ritual.set(ritualKind, {
            completedBalanceApproval: RitualStatus.FAILED,
            completedTransaction: RitualStatus.NO_STATUS,
            inviteFriendTransaction: RitualStatus.NO_STATUS,
            verifyingTransaction: RitualStatus.NO_STATUS,
            ritualMessage: 'RITUAL FAILED ➢ PRAY HARDER'
          })));
        }
      }

      if (!approvalFailed) {
        setRitual(new Map(ritual.set(ritualKind, {
          completedBalanceApproval: RitualStatus.COMPLETED,
          completedTransaction: RitualStatus.NO_STATUS,
          inviteFriendTransaction: RitualStatus.NO_STATUS,
          verifyingTransaction: RitualStatus.NO_STATUS,
        })));

        switch (ritualKind) {
          case RitualKind.OFFERING_STAKING:
            await mintAndStake(amount);
            return;
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
        setRitual(new Map(ritual.set(RitualKind.OFFERING_STAKING, {
          completedBalanceApproval: RitualStatus.COMPLETED,
          completedTransaction: RitualStatus.PROCESSING,
          verifyingTransaction: RitualStatus.NO_STATUS,
          inviteFriendTransaction: RitualStatus.NO_STATUS,
        })));
        const stableCoinBalance: BigNumber = await stableCoinContract.balanceOf(walletAddress);
        // ensure user input is not greater than user balance. if greater use all user balance.
        const offering = amount.lte(stableCoinBalance) ? amount : stableCoinBalance;
        const mintAndStakeTransaction = await openingCeremonyContract.mintAndStake(offering, {
          gasLimit: process.env.NEXT_PUBLIC_MINT_AND_STAKE_GAS_LIMIT || 500000
        });

        // Show feedback to user
        openNotification({
          title: `Incense burned`,
          hash: mintAndStakeTransaction.hash,
        });

        await mintAndStakeTransaction.wait();
        setRitual(new Map(ritual.set(RitualKind.OFFERING_STAKING, {
          completedBalanceApproval: RitualStatus.COMPLETED,
          inviteFriendTransaction: RitualStatus.NO_STATUS,
          completedTransaction: RitualStatus.COMPLETED,
          verifyingTransaction: RitualStatus.NO_STATUS,
          ritualMessage: 'burn more incense?'
        })));
        await updateWallet(false);
      } catch (e) {
        /* TODO: Set a notification transaction has failed */
        setRitual(new Map(ritual.set(RitualKind.OFFERING_STAKING, {
          inviteFriendTransaction: RitualStatus.NO_STATUS,
          completedBalanceApproval: RitualStatus.COMPLETED,
          completedTransaction: RitualStatus.FAILED,
          verifyingTransaction: RitualStatus.NO_STATUS,
          ritualMessage: 'RITUAL FAILED ➢ PRAY HARDER'
        })));
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

  return <WalletContext.Provider
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
        buy: noop,
        connectWallet,
        changeWalletAddress,
        updateWallet,
        stake: noop,
        mintAndStake,
        increaseAllowanceForRitual,
        clearRitual,
        verifyQuest,
        inviteFriend,
        maxInvitesPerVerifiedUser,
      }}>
    {children}
  </WalletContext.Provider>;
};

export const useWallet = () => useContext(WalletContext);
