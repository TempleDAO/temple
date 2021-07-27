import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber, ethers } from 'ethers';
import { createContext, PropsWithChildren, useContext, useState } from 'react';
import { STABLE_COIN_SYMBOL } from '../pages/rituals';
import {
  ERC20__factory,
  LockedOGTemple__factory,
  Presale__factory,
  PresaleAllocation__factory,
  TempleStaking__factory,
  TempleTreasury__factory
} from '../types/typechain';
import { fromAtto } from '../utils/bigNumber';
import { noop } from '../utils/helpers';
import { useNotification } from './NotificationProvider';

/**
 * temple Staking . balance => all temple for user
 */

export enum RitualKind {
  OFFERING_STAKING = 'OFFERING_STAKING'
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
  ritualMessage?: string,
}>;

interface WalletState {
  // has the user connected a wallet to the dapp
  isConnected: boolean,

  wallet: string | null,
  // current
  balance: Balance,

  exchangeRate: number,
  allocation: Allocation,
  templeEpy: number,
  templeApy: number,
  treasury: number,
  ritual: RitualMapping,
  lockInPeriod: number,
  currentEpoch: number,
  isLoading: boolean,

  connectWallet(): void

  updateWallet(): Promise<void> | void

  buy(amountToBuy: number): void

  stake(amountToBuy: number): void

  mintAndStake(amountToBuy: BigNumber): void

  increaseAllowanceForRitual(amountToBuy: BigNumber, ritualKind: RitualKind): void

  clearRitual(ritualKind: RitualKind): void

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
  templeEpy: 0.01,
  templeApy: 0,
  // Fallback when user has not connected wallet, we can update this from Vercel and redeploy
  treasury: process.env.NEXT_PUBLIC_TREASURY_VALUE
      ? +process.env.NEXT_PUBLIC_TREASURY_VALUE
      : 100000,
  isConnected: false,
  wallet: null,
  ritual: new Map(),
  lockInPeriod: 0,
  currentEpoch: -1,
  isLoading: true,
  buy: noop,
  connectWallet: noop,
  updateWallet: noop,
  stake: noop,
  mintAndStake: noop,
  increaseAllowanceForRitual: noop,
  clearRitual: noop,
};

enum ethActions {
  REQUEST_ACCOUNTS = 'eth_requestAccounts',
}

const STABLE_COIN_ADDRESS = process.env.NEXT_PUBLIC_STABLE_COIN_ADDRESS;
const TEMPLE_ADDRESS = process.env.NEXT_PUBLIC_TEMPLE_ADDRESS;
const LOCKED_OG_TEMPLE_ADDRESS = process.env.NEXT_PUBLIC_LOCKED_OG_TEMPLE_ADDRESS;
const TEMPLE_STAKING_ADDRESS = process.env.NEXT_PUBLIC_TEMPLE_STAKING_ADDRESS;
const PRESALE_ADDRESS = process.env.NEXT_PUBLIC_PRESALE_ADDRESS;
const PRESALE_ALLOCATION_ADDRESS = process.env.NEXT_PUBLIC_PRESALE_ALLOCATION_ADDRESS;
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
const EXIT_QUEUE_ADDRESS = process.env.NEXT_PUBLIC_EXIT_QUEUE_ADDRESS;

if (
    STABLE_COIN_ADDRESS === undefined
    || TEMPLE_ADDRESS === undefined
    || TEMPLE_STAKING_ADDRESS === undefined
    || TREASURY_ADDRESS === undefined
    || PRESALE_ADDRESS === undefined
    || PRESALE_ALLOCATION_ADDRESS === undefined
    || LOCKED_OG_TEMPLE_ADDRESS === undefined
    || EXIT_QUEUE_ADDRESS === undefined
) {
  console.info(`
STABLE_COIN_ADDRESS=${STABLE_COIN_ADDRESS}
TEMPLE_ADDRESS=${TEMPLE_ADDRESS}
TEMPLE_STAKING_ADDRESS=${TEMPLE_STAKING_ADDRESS}
TREASURY_ADDRESS=${TREASURY_ADDRESS}
PRESALE_ADDRESS=${PRESALE_ADDRESS}
PRESALE_ALLOCATION_ADDRESS=${PRESALE_ALLOCATION_ADDRESS}
LOCKED_OG_TEMPLE_ADDRESS=${LOCKED_OG_TEMPLE_ADDRESS}
EXIT_QUEUE_ADDRESS=${EXIT_QUEUE_ADDRESS}
`);
  throw new Error(`Missinig contract address from .env (in local dev, it's an output of yarn local-deploy, just copy pasta that into .env.local)`);
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
  const [templeEpy, setTempleEpy] = useState<number>(INITIAL_STATE.templeEpy);
  const [treasury, setTreasury] = useState<number>(INITIAL_STATE.treasury);
  const [ritual, setRitual] = useState<RitualMapping>(INITIAL_STATE.ritual);
  const [lockInPeriod, setLockInPeriod] = useState<number>(INITIAL_STATE.lockInPeriod);
  const [currentEpoch, setCurrentEpoch] = useState<number>(INITIAL_STATE.currentEpoch);
  const [isLoading, setIsLoading] = useState<boolean>(INITIAL_STATE.isLoading);

  const { openNotification } = useNotification();

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
        await getAllocation();
        await getCurrentEpoch();
        await getExchangeRate();
        await getTempleEpy();
        await getTreasuryValue();
        await getLockInPeriod();
        await getBalance();
        if (updateLoading) {
          setIsLoading(false);
        }
      }
    }
  };


  const connectWallet = async () => {
    if (typeof window !== undefined) {
      // @ts-ignore
      const ethereum = window.ethereum;
      if (ethereum) {
        const provider: JsonRpcProvider = new ethers.providers.Web3Provider(ethereum);
        await provider.send(ethActions.REQUEST_ACCOUNTS, []);
        const signer = provider.getSigner();
        setProvider(provider);
        const wallet: string = await signer.getAddress();
        setSignerState(signer);
        setWalletAddress(wallet);
        await updateWallet();
      } else {
        alert('Please add MetaMask to your browser');
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
      const presale = new Presale__factory()
          .attach(PRESALE_ADDRESS)
          .connect(signerState);

      const iv = await treasury.intrinsicValueRatio();
      const { temple, stablec } = iv;
      const mintMultiple = (await presale.mintMultiple());
      const rate = (fromAtto(temple) / fromAtto(stablec)) / mintMultiple.toNumber();
      // Only change the value if contract has valid data
      if (rate > 0) {
        setExchangeRateState(rate);
      }
    }
  };

  const getTempleEpy = async (): Promise<void> => {
    if (walletAddress && signerState) {
      const templeStaking = new TempleStaking__factory()
          .attach(TEMPLE_STAKING_ADDRESS)
          .connect(signerState);

      const epy = (await templeStaking.getEpy(10000)).toNumber() / 10000;
      // Only change the value if contract has valid data
      if (epy > 0) {
        setTempleEpy(epy);
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

  const getTreasuryValue = async (): Promise<void> => {
    if (walletAddress && signerState) {
      const stableCoinContract = new ERC20__factory()
          .attach(STABLE_COIN_ADDRESS)
          .connect(signerState);

      const treasury = fromAtto((await stableCoinContract.balanceOf(TREASURY_ADDRESS)));
      if (treasury > 0) {
        setTreasury(treasury);
      }
    }
  };

  const getAllocation = async (): Promise<void> => {
    if (walletAddress && signerState) {
      const presaleAllocation = new PresaleAllocation__factory()
          .attach(PRESALE_ALLOCATION_ADDRESS)
          .connect(signerState);
      const presaleContract = new Presale__factory()
          .attach(PRESALE_ADDRESS)
          .connect(signerState);
      const stakingContract = new TempleStaking__factory()
          .attach(TEMPLE_STAKING_ADDRESS)
          .connect(signerState);

      const userPresaleAllocation = await presaleAllocation.allocationOf(walletAddress);
      const userUsedAllocation = await presaleContract.allocationUsed(walletAddress);
      const { amount, epoch } = userPresaleAllocation;

      // returns seconds not ms
      const startTimestamp = (await stakingContract.startTimestamp()).toNumber() * 1000;
      // returns seconds not ms
      const epochSize = 24 * 60 * 60 * 1000; // seconds in day;

      setAllocation({
        amount: fromAtto(amount.sub(userUsedAllocation)),
        startEpoch: epoch.toNumber() * epochSize + startTimestamp,
      });
    }
  };

  const increaseAllowanceForRitual = async (amount: BigNumber, ritualKind: RitualKind) => {
    if (walletAddress && signerState) {
      setRitual(new Map(ritual.set(ritualKind, {
        completedBalanceApproval: RitualStatus.PROCESSING,
        completedTransaction: RitualStatus.NO_STATUS,
      })));
      const stableCoinContract = new ERC20__factory()
          .attach(STABLE_COIN_ADDRESS)
          .connect(signerState);
      let approvalFailed: boolean = false;
      const stableCoinAllowance = await stableCoinContract.allowance(walletAddress, PRESALE_ADDRESS);

      if (stableCoinAllowance.lt(amount)) {
        try {
          const stableApproveTransaction = await stableCoinContract.approve(PRESALE_ADDRESS, amount);
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
            ritualMessage: 'RITUAL FAILED ➢ PRAY HARDER'
          })));
        }
      }

      if (!approvalFailed) {
        setRitual(new Map(ritual.set(ritualKind, {
          completedBalanceApproval: RitualStatus.COMPLETED,
          completedTransaction: RitualStatus.NO_STATUS,
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
      const presaleContract = new Presale__factory()
          .attach(PRESALE_ADDRESS)
          .connect(signerState);

      const stableCoinContract = new ERC20__factory()
          .attach(STABLE_COIN_ADDRESS)
          .connect(signerState);

      try {
        setRitual(new Map(ritual.set(RitualKind.OFFERING_STAKING, {
          completedBalanceApproval: RitualStatus.COMPLETED,
          completedTransaction: RitualStatus.PROCESSING,
        })));
        const stableCoinBalance: BigNumber = await stableCoinContract.balanceOf(walletAddress);
        // ensure user input is not greater than user balance. if greater use all user balance.
        const offering = amount.lte(stableCoinBalance) ? amount : stableCoinBalance;
        const mintAndStakeTransaction = await presaleContract.mintAndStake(offering, {
          gasLimit: 500000
        });

        // Show feedback to user
        openNotification({
          title: `Incense burned`,
          hash: mintAndStakeTransaction.hash,
        });

        await mintAndStakeTransaction.wait();
        setRitual(new Map(ritual.set(RitualKind.OFFERING_STAKING, {
          completedBalanceApproval: RitualStatus.COMPLETED,
          completedTransaction: RitualStatus.COMPLETED,
          ritualMessage: 'burn more incense?'
        })));
        await updateWallet(false);
      } catch (e) {
        /* TODO: Set a notification transaction has failed */
        setRitual(new Map(ritual.set(RitualKind.OFFERING_STAKING, {
          completedBalanceApproval: RitualStatus.COMPLETED,
          completedTransaction: RitualStatus.FAILED,
          ritualMessage: 'RITUAL FAILED ➢ PRAY HARDER'
        })));
      }
    }
  };

  const getLockInPeriod = async () => {
    if (walletAddress && signerState) {
      const presaleContract = new Presale__factory()
          .attach(PRESALE_ADDRESS)
          .connect(signerState);

      const unlockTimestamp = (await presaleContract.unlockTimestamp()).toNumber();
      const now = Date.now();
      const diff = unlockTimestamp - now;
      // Transform ms to days
      const lip = diff / 1000 / 60 / 60 / 24;
      setLockInPeriod(Math.ceil(lip));
    }
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
        templeEpy,
        templeApy: Math.trunc((Math.pow(templeEpy + 1, 365.25) - 1) * 100),
        treasury,
        isConnected: isConnectedState,
        wallet: walletAddress,
        lockInPeriod,
        currentEpoch,
        isLoading,
        buy: noop,
        connectWallet,
        updateWallet,
        stake: noop,
        mintAndStake,
        increaseAllowanceForRitual,
        clearRitual,
      }}>
    {children}
  </WalletContext.Provider>;
};

export const useWallet = () => useContext(WalletContext);
