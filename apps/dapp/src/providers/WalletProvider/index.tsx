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
  ERC20,
  TempleCashback__factory,
  TempleTeamPayments__factory,
} from 'types/typechain';
import { toAtto } from 'utils/bigNumber';
import { asyncNoop, noop } from 'utils/helpers';
import { NoWalletAddressError } from './errors';

import {
  getTemplePrice,
  getCurrentEpoch,
  getExchangeRate,
  getBalance,
  getApy,
} from './util';

import { WalletState, Balance, ETH_ACTIONS } from './types';

import {
  TEMPLE_CASHBACK_ADDRESS,
  NEXT_PUBLIC_EXCHANGE_RATE_VALUE,
  VITE_PUBLIC_CLAIM_GAS_LIMIT,
} from './env';

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
  connectWallet: noop,
  changeWalletAddress: noop,
  updateWallet: noop,
  claim: asyncNoop,
  signer: null,
  network: null,
  getBalance: asyncNoop,
  collectTempleTeamPayment: asyncNoop,
  apy: 0,
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
        connectWallet,
        changeWalletAddress,
        updateWallet,
        ensureAllowance,
        claim,
        signer: signerState,
        network,
        getBalance: updateBalance,
        apy,
        collectTempleTeamPayment,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
