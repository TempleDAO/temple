import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
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
import {
  AcceleratedExitQueue__factory,
  AMMWhitelist__factory,
  Devotion__factory,
  ERC20,
  ERC20__factory,
  ExitQueue__factory,
  FaithMerkleAirdrop__factory,
  LockedOGTempleDeprecated__factory,
  OGTemple__factory,
  OpeningCeremony__factory,
  TempleCashback__factory,
  TempleERC20Token__factory,
  TempleFraxAMMRouter__factory,
  TempleStaking__factory,
  TempleTeamPayments__factory,
} from 'types/typechain';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { formatNumberNoDecimals } from 'utils/formatter';
import { asyncNoop, noop } from 'utils/helpers';

import {
  getTemplePrice,
  getCurrentEpoch,
  getExchangeRate,
  getBalance,
  getFaith,
  getAllocation,
  getLockedEntries,
  getExitQueueData,
  getEpochsToDays,
  getApy,
  getRewardsForOGTemple,
} from './util';

import {
  OpeningCeremonyUser,
  WalletState,
  Balance,
  Allocation,
  RitualMapping,
  LockedEntry,
  ExitQueueData,
  ETH_ACTIONS,
  COIN_TYPE,
  RitualKind,
  JoinQueueData,
  RitualStatus,
} from './types';

import {
  EXIT_QUEUE_ADDRESS,
  AMM_WHITELIST_ADDRESS,
  ACCELERATED_EXIT_QUEUE_ADDRESS,
  LOCKED_OG_TEMPLE_ADDRESS,
  TEMPLE_STAKING_ADDRESS,
  OPENING_CEREMONY_ADDRESS,
  TEMPLE_ADDRESS,
  STABLE_COIN_ADDRESS,
  TEMPLE_V2_ROUTER_ADDRESS,
  FAITH_AIRDROP_ADDRESS,
  TEMPLE_CASHBACK_ADDRESS,
  TEMPLE_DEVOTION_ADDRESS,
  LOCKED_OG_TEMPLE_DEVOTION_ADDRESS,
  NEXT_PUBLIC_EXCHANGE_RATE_VALUE,
  VITE_PUBLIC_MINT_AND_STAKE_GAS_LIMIT,
  VITE_PUBLIC_TEMPLE_STAKING_UNSTAKE_BASE_GAS_LIMIT,
  VITE_PUBLIC_TEMPLE_STAKING_UNSTAKE_PER_EPOCH_GAS_LIMIT,
  VITE_PUBLIC_CLAIM_GAS_LIMIT,
  VITE_PUBLIC_CLAIM_FAITH_GAS_LIMIT,
  VITE_PUBLIC_WITHDRAW_EPOCHS_BASE_GAS_LIMIT,
  VITE_PUBLIC_WITHDRAW_EPOCHS_PER_EPOCH_GAS_LIMIT,
  VITE_PUBLIC_RESTAKE_EPOCHS_BASE_GAS_LIMIT,
  VITE_PUBLIC_RESTAKE_EPOCHS_PER_EPOCH_GAS_LIMIT,
  VITE_PUBLIC_AMM_FRAX_FOR_TEMPLE_GAS_LIMIT,
  VITE_PUBLIC_AMM_TEMPLE_FOR_FRAX_GAS_LIMIT,
  VITE_PUBLIC_CLAIM_OGTEMPLE_GAS_LIMIT,
  VITE_PUBLIC_STAKE_GAS_LIMIT,
  VITE_PUBLIC_DEVOTION_LOCK_AND_VERIFY_GAS_LIMIT,
} from './env';

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
  exchangeRate: NEXT_PUBLIC_EXCHANGE_RATE_VALUE
    ? +NEXT_PUBLIC_EXCHANGE_RATE_VALUE
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

  const updateLockedEntries = async () => {
    if (!walletAddress || !signerState) {
      return;
    }

    const lockedEntries = await getLockedEntries(walletAddress, signerState);
    setLockedEntries(lockedEntries);
  };

  const updateExitQueueData = async () => {
    if (!walletAddress || !signerState) {
      return;
    }

    const exitQueueData = await getExitQueueData(walletAddress, signerState);
    setExitQueueData(exitQueueData);
  };

  const updateApy = async () => {
    if (!walletAddress || !signerState) {
      return;
    }

    const apy = await getApy(walletAddress, signerState);
    setApy(apy);
  };

  const updateTemplePrice = async () => {
    if (!walletAddress || !signerState) {
      return;
    }
    const price = await getTemplePrice(walletAddress, signerState);
    setTemplePrice(price);
  };

  const updateFaith = async () => {
    if (!walletAddress || !signerState) {
      return;
    }

    const faith = await getFaith(walletAddress, signerState);
    setFaith(faith);
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

        await Promise.all([
          updateTemplePrice(),
          updateCurrentEpoch(),
          updateExchangeRate(),
          updateBalance(),
          updateFaith(),
          updateAllocation(),
          updateLockedEntries(),
          updateExitQueueData(),
          updateApy(),
        ]);

        if (updateLoading) {
          setIsLoading(false);
        }
      }
    }
  };

  const updateBalance = async () => {
    if (!walletAddress || !signerState) {
      return;
    }

    const balance = await getBalance(walletAddress, signerState);
    setBalanceState(balance);
  };

  const updateExchangeRate = async (): Promise<void> => {
    if (!walletAddress || !signerState) {
      return;
    }

    const rate = await getExchangeRate(walletAddress, signerState);
    if (rate > 0) {
      setExchangeRateState(rate);
    }
  };

  const updateCurrentEpoch = async (): Promise<void> => {
    if (!provider) {
      return;
    }

    const epoch = await getCurrentEpoch(provider);
    setCurrentEpoch(epoch);
  };

  const updateAllocation = async (): Promise<void> => {
    if (!walletAddress || !signerState || !ocTemplar) {
      return;
    }

    const allocation = await getAllocation(walletAddress, signerState, ocTemplar);
    setAllocation(allocation);
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
            gasLimit: VITE_PUBLIC_MINT_AND_STAKE_GAS_LIMIT || 500000,
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
        const ogTempleBalance: BigNumber = await OGTContract.balanceOf(
          walletAddress
        );
        // ensure user input is not greater than user balance. if greater use all user balance.
        const offering = amount.lte(ogTempleBalance) ? amount : ogTempleBalance;
        const baseGas = Number(
          VITE_PUBLIC_TEMPLE_STAKING_UNSTAKE_BASE_GAS_LIMIT || 300000
        );
        const gasPerEpoch = Number(
          VITE_PUBLIC_TEMPLE_STAKING_UNSTAKE_PER_EPOCH_GAS_LIMIT ||
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
        updateExitQueueData();
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
          gasLimit: VITE_PUBLIC_CLAIM_GAS_LIMIT || 100000,
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
      const faithAirdrop = new FaithMerkleAirdrop__factory()
        .attach(FAITH_AIRDROP_ADDRESS)
        .connect(signerState);

      const tx = await faithAirdrop.claim(index, address, amount, proof, {
        gasLimit: VITE_PUBLIC_CLAIM_FAITH_GAS_LIMIT || 100000,
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
          gasLimit: VITE_PUBLIC_CLAIM_OGTEMPLE_GAS_LIMIT || 100000,
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
    if (!walletAddress || !signerState) {
      return;
    }

    const rewards = await getRewardsForOGTemple(
      walletAddress,
      signerState,
      ogtAmount
    );
    return rewards;
  };

  const claimAvailableTemple = async (): Promise<void> => {
    if (walletAddress && signerState) {
      const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory()
        .attach(ACCELERATED_EXIT_QUEUE_ADDRESS)
        .connect(signerState);

      if (exitQueueData.claimableEpochs.length) {
        const baseCase =
          VITE_PUBLIC_WITHDRAW_EPOCHS_BASE_GAS_LIMIT || 60000;
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
          title: `${TEMPLE_TOKEN} claimed`,
          hash: withdrawTXN.hash,
        });
      }
      updateBalance();
    }
  };

  const restakeAvailableTemple = async (): Promise<void> => {
    if (walletAddress && signerState) {
      const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory()
        .attach(ACCELERATED_EXIT_QUEUE_ADDRESS)
        .connect(signerState);

      const EXIT_QUEUE = new ExitQueue__factory()
        .attach(EXIT_QUEUE_ADDRESS)
        .connect(signerState);

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
          VITE_PUBLIC_RESTAKE_EPOCHS_BASE_GAS_LIMIT || 175000;
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
          title: `${TEMPLE_TOKEN} restaked`,
          hash: restakeTXN.hash,
        });
      }
      updateBalance();
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
          gasLimit: VITE_PUBLIC_AMM_FRAX_FOR_TEMPLE_GAS_LIMIT || 300000,
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
          gasLimit: VITE_PUBLIC_AMM_TEMPLE_FOR_FRAX_GAS_LIMIT || 195000,
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

      const balance = await TEMPLE.balanceOf(walletAddress);
      const verifiedAmountToStake = amountToStake.lt(balance)
        ? amountToStake
        : balance;

      const stakeTXN = await TEMPLE_STAKING.stake(verifiedAmountToStake, {
        gasLimit: VITE_PUBLIC_STAKE_GAS_LIMIT || 150000,
      });
      await stakeTXN.wait();

      // Show feedback to user
      openNotification({
        title: `${TEMPLE_TOKEN} staked`,
        hash: stakeTXN.hash,
      });
    }
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
      const ACCELERATED_EXIT_QUEUE = new AcceleratedExitQueue__factory()
        .attach(ACCELERATED_EXIT_QUEUE_ADDRESS)
        .connect(signerState);

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
          signerState
        ),
        processTime: await getEpochsToDays(processTimeEpochs, signerState),
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

      const teamPaymentContract = new TempleTeamPayments__factory()
        .attach(
          paymentType === TEAM_PAYMENTS_TYPES.FIXED
            ? fixedTeamPaymentAddress
            : contingentTeamPaymentAddress
        )
        .connect(signerState);

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
      const DEVOTION = new Devotion__factory()
        .attach(TEMPLE_DEVOTION_ADDRESS)
        .connect(signerState);

      const TEMPLE_STAKING = new TempleStaking__factory()
        .attach(TEMPLE_STAKING_ADDRESS)
        .connect(signerState);

      const OG_TEMPLE = new OGTemple__factory()
        .attach(await TEMPLE_STAKING.OG_TEMPLE())
        .connect(signerState);

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
          gasLimit: VITE_PUBLIC_DEVOTION_LOCK_AND_VERIFY_GAS_LIMIT || 250000,
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
      const DEVOTION = new Devotion__factory()
        .attach(TEMPLE_DEVOTION_ADDRESS)
        .connect(signerState);

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
      const DEVOTION = new Devotion__factory()
        .attach(TEMPLE_DEVOTION_ADDRESS)
        .connect(signerState);

      return await DEVOTION.claimableTempleRewardQuote(faithAmount);
    } else {
      console.error('Missing wallet address');
    }
  };

  const getFaithQuote = async () => {
    if (walletAddress && signerState) {
      const DEVOTION = new Devotion__factory()
        .attach(TEMPLE_DEVOTION_ADDRESS)
        .connect(signerState);

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
        getBalance: updateBalance,
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
