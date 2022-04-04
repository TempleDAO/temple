import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { BigNumber, ethers } from 'ethers';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import {
  JsonRpcProvider,
  JsonRpcSigner,
  Network,
} from '@ethersproject/providers';
import axios from 'axios';
// Circular dependency
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { useNotification } from 'providers/NotificationProvider';
import { NoWalletAddressError } from 'providers/errors';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { ClaimType } from 'enums/claim-type';
import {
  TEAM_PAYMENTS_EPOCHS,
  TEAM_PAYMENTS_FIXED_ADDRESSES_BY_EPOCH,
} from 'enums/team-payment';
import { Network as NetworkEnum } from 'enums/network';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { createZapperTokenBalanceUrl } from 'utils/url';
import { asyncNoop, noop } from 'utils/helpers';
import {
  WalletState,
  Balance,
  ZapperTokenData,
  ZapperTokenResponse,
  ETH_ACTIONS,
} from 'providers/types';
import {
  ERC20,
  ERC20__factory,
  TempleERC20Token__factory,
  LockedOGTemple__factory,
  TempleStaking__factory,
  OGTemple__factory,
  TempleCashback__factory,
  TempleTeamPayments__factory,
  LockedOGTempleDeprecated__factory,
} from 'types/typechain';
import {
  TEMPLE_ADDRESS,
  STABLE_COIN_ADDRESS,
  TEMPLE_STAKING_ADDRESS,
  TEMPLE_CASHBACK_ADDRESS,
  LOCKED_OG_TEMPLE_ADDRESS,
  LOCKED_OG_TEMPLE_DEVOTION_ADDRESS,
  VITE_PUBLIC_CLAIM_GAS_LIMIT,
} from 'providers/env';

// We want to save gas burn $ for the Templars,
// so we approving 1M up front, so only 1 approve TXN is required for approve
const DEFAULT_ALLOWANCE = toAtto(100000000);

const INITIAL_STATE: WalletState = {
  balance: {
    stableCoin: 0,
    temple: 0,
    ogTempleLocked: 0,
    ogTempleLockedClaimable: 0,
    ogTemple: 0,
  },
  zapperBalances: [
    {
      address: '',
      balance: 0,
      balanceRaw: '',
      balanceUSD: 0,
      decimals: 0,
      network: '',
      price: 0,
      symbol: 'TOKEN',
      type: '',
    },
  ],
  wallet: null,
  isConnected: () => false,
  connectWallet: noop,
  changeWalletAddress: noop,
  claim: asyncNoop,
  signer: null,
  network: null,
  getCurrentEpoch: asyncNoop,
  getBalance: asyncNoop,
  updateBalance: asyncNoop,
  updateZapperBalances: asyncNoop,
  collectTempleTeamPayment: asyncNoop,
  ensureAllowance: asyncNoop,
  getZapperToken: noop,
};

const WalletContext = createContext<WalletState>(INITIAL_STATE);

export const WalletProvider = (props: PropsWithChildren<{}>) => {
  const { children } = props;
  const [provider, setProvider] = useState<JsonRpcProvider | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [signerState, setSignerState] = useState<JsonRpcSigner | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balanceState, setBalanceState] = useState<Balance>(
    INITIAL_STATE.balance
  );
  const [zapperBalances, setZapperBalances] = useState(
    INITIAL_STATE.zapperBalances
  );

  const { openNotification } = useNotification();
  const refreshWalletState = useRefreshWalletState();

  useEffect(() => {
    interactWithMetamask(undefined, true).then();
    if (typeof window !== undefined) {
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

  const isConnected = (): boolean => {
    // only trigger once window is loaded
    if (typeof window !== undefined) {
      const ethereum = window.ethereum;
      if (ethereum) {
        return ethereum.isConnected();
      }
    }
    return false;
  };

  const interactWithMetamask = async (
    action?: ETH_ACTIONS,
    syncConnected?: boolean
  ) => {
    if (typeof window !== undefined) {
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
          // Circular dependency
          await refreshWalletState();
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

  const getBalance = async (
    walletAddress: string,
    signerState: JsonRpcSigner
  ) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

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
    const lockedNum = (await ogLockedTemple.numLocks(walletAddress)).toNumber();
    let ogTempleLocked = 0;
    let ogTempleLockedClaimable = 0;
    const templeLockedPromises = [];
    for (let i = 0; i < lockedNum; i++) {
      templeLockedPromises.push(ogLockedTemple.locked(walletAddress, i));
    }

    const now = formatNumberFixedDecimals(Date.now() / 1000, 0);
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

    return {
      stableCoin: fromAtto(stableCoinBalance),
      temple: temple,
      ogTempleLocked: ogTempleLocked + fromAtto(lockedOGTempleEntry.amount),
      ogTemple: ogTemple >= 1 ? ogTemple : 0,
      ogTempleLockedClaimable: ogTempleLockedClaimable,
    };
  };

  const updateBalance = async () => {
    if (!walletAddress || !signerState) {
      return;
    }

    const balance = await getBalance(walletAddress, signerState);
    setBalanceState(balance);
  };

  const updateZapperBalances = async () => {
    if (!walletAddress || !signerState) {
      throw new NoWalletAddressError();
    }

    const url = createZapperTokenBalanceUrl(walletAddress);
    const res = await axios.get(url);

    if (!res) {
      throw new Error(`Network request error: ${url}`);
    }

    const tokenResponse: ZapperTokenResponse[] = res.data;
    const tokenData: ZapperTokenData[] =
      Object.values(tokenResponse)[0].products[0].assets;
    //TODO: additionally filter according to our allowed list
    const tokens = tokenData.filter(
      (token) => token.network === NetworkEnum.Ethereum
    );

    setZapperBalances(tokens);
  };

  const getCurrentEpoch = async (): Promise<void | number> => {
    if (!provider) {
      return;
    }

    const blockNumber = await provider.getBlockNumber();
    const currentBlockTimestamp = (await provider.getBlock(blockNumber))
      .timestamp;
    // block timestamps are in seconds no ms
    return currentBlockTimestamp * 1000;
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

  const getZapperToken = (token: TICKER_SYMBOL, network: NetworkEnum) => {
    return zapperBalances
      .filter((token) => token.network === network)
      .find((zapperToken) => zapperToken.symbol === token);
  };

  return (
    <WalletContext.Provider
      value={{
        balance: balanceState,
        zapperBalances,
        isConnected,
        wallet: walletAddress,
        connectWallet,
        changeWalletAddress,
        ensureAllowance,
        claim,
        signer: signerState,
        network,
        getCurrentEpoch,
        getBalance: updateBalance,
        updateBalance,
        updateZapperBalances,
        collectTempleTeamPayment,
        getZapperToken,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
