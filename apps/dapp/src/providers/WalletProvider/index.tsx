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
import { ClaimType } from 'enums/claim-type';
import {
  TEAM_PAYMENTS_EPOCHS,
  TEAM_PAYMENTS_FIXED_ADDRESSES_BY_EPOCH,
} from 'enums/team-payment';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber, ethers } from 'ethers';
import { useNotification } from 'providers/NotificationProvider';
import {
  Devotion__factory,
  ERC20,
  ERC20__factory,
  FaithMerkleAirdrop__factory,
  LockedOGTempleDeprecated__factory,
  TempleCashback__factory,
  TempleERC20Token__factory,
  TempleFraxAMMRouter__factory,
  TempleTeamPayments__factory,
} from 'types/typechain';
import { toAtto } from 'utils/bigNumber';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { asyncNoop, noop } from 'utils/helpers';
import { NoWalletAddressError } from './errors';

import {
  getTemplePrice,
  getCurrentEpoch,
  getExchangeRate,
  getBalance,
  getLockedEntries,
  getApy,
  getRewardsForOGTemple,
} from './util';

import {
  WalletState,
  Balance,
  LockedEntry,
  ExitQueueData,
  ETH_ACTIONS,
} from './types';

import {
  LOCKED_OG_TEMPLE_ADDRESS,
  TEMPLE_ADDRESS,
  STABLE_COIN_ADDRESS,
  TEMPLE_V2_ROUTER_ADDRESS,
  FAITH_AIRDROP_ADDRESS,
  TEMPLE_CASHBACK_ADDRESS,
  TEMPLE_DEVOTION_ADDRESS,
  NEXT_PUBLIC_EXCHANGE_RATE_VALUE,
  VITE_PUBLIC_CLAIM_GAS_LIMIT,
  VITE_PUBLIC_CLAIM_FAITH_GAS_LIMIT,
  VITE_PUBLIC_AMM_FRAX_FOR_TEMPLE_GAS_LIMIT,
  VITE_PUBLIC_AMM_TEMPLE_FOR_FRAX_GAS_LIMIT,
  VITE_PUBLIC_CLAIM_OGTEMPLE_GAS_LIMIT,
} from './env';

/* TODO: Move this to a common place */

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
  // Fallback when user has not connected wallet, we can update this from Vercel and redeploy
  exchangeRate: NEXT_PUBLIC_EXCHANGE_RATE_VALUE
    ? +NEXT_PUBLIC_EXCHANGE_RATE_VALUE
    : 0.9,
  isConnected: false,
  wallet: null,
  currentEpoch: -1,
  templePrice: 0,
  isLoading: true,
  lockedEntries: [],

  buy: noop,
  sell: noop,
  connectWallet: noop,
  changeWalletAddress: noop,
  updateWallet: noop,
  claim: asyncNoop,
  claimFaithAirdrop: asyncNoop,
  signer: null,
  network: null,
  claimOgTemple: asyncNoop,
  getRewardsForOGT: asyncNoop,
  getSellQuote: asyncNoop,
  getBuyQuote: asyncNoop,
  getBalance: asyncNoop,
  collectTempleTeamPayment: asyncNoop,
  apy: 0,
  getTempleFaithReward: asyncNoop,
  getExitQueueData: asyncNoop,
  ensureAllowance: asyncNoop,
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
  const [currentEpoch, setCurrentEpoch] = useState<number>(
    INITIAL_STATE.currentEpoch
  );
  const [isLoading, setIsLoading] = useState<boolean>(INITIAL_STATE.isLoading);
  const [lockedEntries, setLockedEntries] = useState<Array<LockedEntry>>(
    INITIAL_STATE.lockedEntries
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
      const ethereum = window.ethereum;
      if (ethereum) {
        const connected = ethereum.isConnected();
        setIsConnectedState(connected);
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

  /**
   * Load new data for the connected wallet
   * @param updateLoading Determines if the `isLoading` state should be updated
   */
  const updateWallet = async (updateLoading = true) => {
    if (updateLoading) {
      setIsLoading(true);
    }
    if (typeof window !== undefined) {
      const ethereum = window.ethereum;
      if (ethereum) {
        isConnected();

        await Promise.all([
          updateTemplePrice(),
          updateCurrentEpoch(),
          updateExchangeRate(),
          updateBalance(),
          updateFaith(),
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
      throw new NoWalletAddressError();
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
      const faithAirdrop = new FaithMerkleAirdrop__factory(signerState).attach(
        FAITH_AIRDROP_ADDRESS
      );

      const tx = await faithAirdrop.claim(index, address, amount, proof, {
        gasLimit: VITE_PUBLIC_CLAIM_FAITH_GAS_LIMIT || 100000,
      });

      return tx.wait();
    } else {
      console.error('Missing wallet address');
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

  const claimOgTemple = async (lockedEntryIndex: number) => {
    if (walletAddress && signerState) {
      const lockedOGTempleContract = new LockedOGTempleDeprecated__factory(
        signerState
      ).attach(LOCKED_OG_TEMPLE_ADDRESS);

      const withdrawTXN = await lockedOGTempleContract.withdraw(
        lockedEntryIndex,
        {
          gasLimit: VITE_PUBLIC_CLAIM_OGTEMPLE_GAS_LIMIT || 100000,
        }
      );

      await withdrawTXN.wait();

      openNotification({
        title: `${TICKER_SYMBOL.OG_TEMPLE_TOKEN} claimed`,
        hash: withdrawTXN.hash,
      });
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
        TICKER_SYMBOL.STABLE_TOKEN,
        STABLE_TOKEN,
        TEMPLE_V2_ROUTER_ADDRESS,
        amountInFrax
      );

      const balance = await STABLE_TOKEN.balanceOf(walletAddress);
      const verifiedAmountInFrax = amountInFrax.lt(balance)
        ? amountInFrax
        : balance;

      const deadline = formatNumberFixedDecimals(
        Date.now() / 1000 + DEADLINE,
        0
      );

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
        title: `Sacrificed ${TICKER_SYMBOL.STABLE_TOKEN}`,
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
        TICKER_SYMBOL.TEMPLE_TOKEN,
        TEMPLE,
        TEMPLE_V2_ROUTER_ADDRESS,
        amountInTemple
      );

      const balance = await TEMPLE.balanceOf(walletAddress);
      const verifiedAmountInTemple = amountInTemple.lt(balance)
        ? amountInTemple
        : balance;

      const deadline = formatNumberFixedDecimals(
        Date.now() / 1000 + DEADLINE,
        0
      );

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
        title: `${TICKER_SYMBOL.TEMPLE_TOKEN} renounced`,
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

  const collectTempleTeamPayment = async (epoch: TEAM_PAYMENTS_EPOCHS) => {
    if (walletAddress && signerState) {
      const fixedTeamPaymentAddress =
        TEAM_PAYMENTS_FIXED_ADDRESSES_BY_EPOCH[epoch];

      const teamPaymentContract = new TempleTeamPayments__factory(
        signerState
      ).attach(fixedTeamPaymentAddress);

      const collectTxn = await teamPaymentContract.claim();

      const txnReceipt = await collectTxn.wait();

      openNotification({
        title: `${TICKER_SYMBOL.TEMPLE_TOKEN} claimed`,
        hash: collectTxn.hash,
      });

      return txnReceipt;
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

  return (
    <WalletContext.Provider
      value={{
        balance: balanceState,
        exchangeRate: exchangeRateState,
        isConnected: isConnectedState,
        wallet: walletAddress,
        currentEpoch,
        isLoading,
        templePrice,
        buy,
        sell,
        connectWallet,
        changeWalletAddress,
        updateWallet,
        ensureAllowance,
        claim,
        claimFaithAirdrop,
        signer: signerState,
        network,
        claimOgTemple,
        getRewardsForOGT,
        lockedEntries,
        getSellQuote,
        getBuyQuote,
        getBalance: updateBalance,
        apy,
        collectTempleTeamPayment,
        getTempleFaithReward,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
