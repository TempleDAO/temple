import { createContext, PropsWithChildren, useContext, useState } from 'react';
import { BigNumber, Signer } from 'ethers';
import { useAccount, useSigner, useNetwork, useConnect } from 'wagmi';

import { useNotification } from 'providers/NotificationProvider';
import { NoWalletAddressError } from 'providers/errors';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { TEAM_PAYMENTS_EPOCHS, TEAM_PAYMENTS_FIXED_ADDRESSES_BY_EPOCH } from 'enums/team-payment';
import { toAtto } from 'utils/bigNumber';
import { asyncNoop } from 'utils/helpers';
import { WalletState, Balance } from 'providers/types';
import {
  ERC20__factory,
  TempleERC20Token__factory,
  TempleStaking__factory,
  OGTemple__factory,
  TempleTeamPayments__factory,
  ERC20,
} from 'types/typechain';
import env from 'constants/env';
import { ZERO } from 'utils/bigNumber';

// We want to save gas burn $ for the Templars,
// so we approving 1M up front, so only 1 approve TXN is required for approve
const DEFAULT_ALLOWANCE = toAtto(100000000);

const INITIAL_STATE: WalletState = {
  balance: {
    frax: ZERO,
    usdc: ZERO,
    usdt: ZERO,
    dai: ZERO,
    temple: ZERO,
    ogTemple: ZERO,
  },
  wallet: null,
  isConnected: false,
  isConnecting: false,
  signer: null,
  network: null,
  getBalance: asyncNoop,
  updateBalance: asyncNoop,
  collectTempleTeamPayment: asyncNoop,
  ensureAllowance: asyncNoop,
};

const WalletContext = createContext<WalletState>(INITIAL_STATE);

export const WalletProvider = (props: PropsWithChildren<{}>) => {
  const { children } = props;

  const { data: signer, isLoading: signerLoading } = useSigner();
  const { chain } = useNetwork();
  const { address, isConnecting: accountLoading } = useAccount();
  const { isLoading: connectLoading } = useConnect();

  const { openNotification } = useNotification();
  const [balanceState, setBalanceState] = useState<Balance>(INITIAL_STATE.balance);

  const walletAddress = address;
  const isConnected = !!walletAddress && !!signer;

  const getBalance = async (walletAddress: string, signer: Signer) => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const fraxContract = new ERC20__factory(signer).attach(env.contracts.frax);
    const usdcContract = new ERC20__factory(signer).attach(env.contracts.usdc);
    const usdtContract = new ERC20__factory(signer).attach(env.contracts.usdt);
    const daiContract = new ERC20__factory(signer).attach(env.contracts.dai);
    const templeStakingContract = new TempleStaking__factory(signer).attach(env.contracts.templeStaking);
    const OG_TEMPLE_CONTRACT = new OGTemple__factory(signer).attach(await templeStakingContract.OG_TEMPLE());
    const templeContract = new TempleERC20Token__factory(signer).attach(env.contracts.temple);

    const fraxBalance: BigNumber = await fraxContract.balanceOf(walletAddress);
    const usdcBalance: BigNumber = await usdcContract.balanceOf(walletAddress);
    const usdtBalance: BigNumber = await usdtContract.balanceOf(walletAddress);
    const daiBalance: BigNumber = await daiContract.balanceOf(walletAddress);
    const ogTemple = await OG_TEMPLE_CONTRACT.balanceOf(walletAddress);
    const temple = await templeContract.balanceOf(walletAddress);

    return {
      frax: fraxBalance,
      dai: daiBalance,
      usdt: usdtBalance,
      usdc: usdcBalance,
      temple,
      ogTemple,
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
        ensureAllowance,
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
