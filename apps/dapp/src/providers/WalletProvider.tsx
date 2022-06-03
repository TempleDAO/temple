import { createContext, PropsWithChildren, useContext, useState } from 'react';
import { BigNumber, Signer } from 'ethers';
import { useAccount, useSigner, useNetwork, useProvider, useConnect } from 'wagmi';
import { TransactionReceipt } from '@ethersproject/abstract-provider';

import { useNotification } from 'providers/NotificationProvider';
import { NoWalletAddressError } from 'providers/errors';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { ClaimType } from 'enums/claim-type';
import { TEAM_PAYMENTS_EPOCHS, TEAM_PAYMENTS_FIXED_ADDRESSES_BY_EPOCH } from 'enums/team-payment';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { asyncNoop, noop } from 'utils/helpers';
import { WalletState, Balance } from 'providers/types';
import {
  ERC20__factory,
  TempleERC20Token__factory,
  TempleStaking__factory,
  OGTemple__factory,
  TempleTeamPayments__factory,
  ERC20,
} from 'types/typechain';
import { TEMPLE_ADDRESS, FRAX_ADDRESS, TEMPLE_STAKING_ADDRESS, FEI_ADDRESS } from 'providers/env';

// We want to save gas burn $ for the Templars,
// so we approving 1M up front, so only 1 approve TXN is required for approve
const DEFAULT_ALLOWANCE = toAtto(100000000);

const INITIAL_STATE: WalletState = {
  balance: {
    frax: 0,
    fei: 0,
    temple: 0,
    ogTemple: 0,
  },
  wallet: null,
  isConnected: false,
  isConnecting: false,
  connectWallet: noop,
  changeWalletAddress: noop,
  signer: null,
  network: null,
  claim: asyncNoop,
  getBalance: asyncNoop,
  updateBalance: asyncNoop,
  collectTempleTeamPayment: asyncNoop,
  ensureAllowance: asyncNoop,
};

const WalletContext = createContext<WalletState>(INITIAL_STATE);

export const WalletProvider = (props: PropsWithChildren<{}>) => {
  const { children } = props;

  const [{ data: signer, loading: signerLoading }] = useSigner();
  const [{ data: network }] = useNetwork();
  const [{ data: accountData, loading: accountLoading }] = useAccount();
  const [{ loading: connectLoading }] = useConnect();

  const { openNotification } = useNotification();
  const [balanceState, setBalanceState] = useState<Balance>(INITIAL_STATE.balance);

  const chain = network?.chain;
  const walletAddress = accountData?.address;
  const isConnected = !!walletAddress && !!signer;

  const connectWallet = async () => {
    throw new Error('Deprecated');
  };

  const changeWalletAddress = async () => {
    throw new Error('Deprecated');
  };

  const getBalance = async (walletAddress: string, signer: Signer) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const fraxContract = new ERC20__factory(signer).attach(FRAX_ADDRESS);

    const feiContract = new ERC20__factory(signer).attach(FEI_ADDRESS);

    const templeStakingContract = new TempleStaking__factory(signer).attach(TEMPLE_STAKING_ADDRESS);

    const OG_TEMPLE_CONTRACT = new OGTemple__factory(signer).attach(await templeStakingContract.OG_TEMPLE());

    const templeContract = new TempleERC20Token__factory(signer).attach(TEMPLE_ADDRESS);

    const fraxBalance: BigNumber = await fraxContract.balanceOf(walletAddress);

    const feiBalance: BigNumber = await feiContract.balanceOf(walletAddress);

    const ogTemple = fromAtto(await OG_TEMPLE_CONTRACT.balanceOf(walletAddress));
    const temple = fromAtto(await templeContract.balanceOf(walletAddress));

    return {
      frax: fromAtto(fraxBalance),
      fei: fromAtto(feiBalance),
      temple: temple,
      ogTemple: ogTemple >= 1 ? ogTemple : 0,
    };
  };

  const updateBalance = async () => {
    if (!walletAddress || !signer) {
      return;
    }

    const balance = await getBalance(walletAddress, signer);
    setBalanceState(balance);
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
    // Should be ERC20, need to update Typechain (fix is in 8.0.x)
    erc20Token: any,
    spender: string,
    minAllowance: BigNumber
  ) => {
    // pre-condition
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const token = erc20Token as ERC20;
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

  // TODO: remove as part of #239
  const claim = async (claimType: ClaimType): Promise<TransactionReceipt | void> => {};

  const collectTempleTeamPayment = async (epoch: TEAM_PAYMENTS_EPOCHS) => {
    if (walletAddress && signer) {
      const fixedTeamPaymentAddress = TEAM_PAYMENTS_FIXED_ADDRESSES_BY_EPOCH[epoch];

      const teamPaymentContract = new TempleTeamPayments__factory(signer).attach(fixedTeamPaymentAddress);

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
        isConnected: isConnected,
        isConnecting: signerLoading || connectLoading || accountLoading,
        wallet: walletAddress || null,
        connectWallet,
        changeWalletAddress,
        ensureAllowance,
        claim,
        signer: signer || null,
        network: !chain
          ? null
          : {
              chainId: chain.id,
              name: chain.name || '',
            },
        getBalance: updateBalance,
        updateBalance,
        collectTempleTeamPayment,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
