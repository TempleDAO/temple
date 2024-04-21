import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { BigNumber, ethers, Signer } from 'ethers';
import { useConnectWallet } from '@web3-onboard/react';

import { useNotification } from 'providers/NotificationProvider';
import { NoWalletAddressError } from 'providers/errors';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
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
import { Nullable } from 'types/util';

// We want to save gas burn $ for the Templars,
// so we approving 1M up front, so only 1 approve TXN is required for approve
const DEFAULT_ALLOWANCE = toAtto(100000000);

const INITIAL_STATE: WalletState = {
  balance: {
    FRAX: ZERO,
    USDC: ZERO,
    USDT: ZERO,
    DAI: ZERO,
    ETH: ZERO,
    WETH: ZERO,
    TEMPLE: ZERO,
    OGTEMPLE: ZERO,
    OHM: ZERO,
  },
  wallet: undefined,
  walletAddress: undefined,
  isConnected: false,
  isConnecting: false,
  signer: null,
  getBalance: asyncNoop,
  updateBalance: asyncNoop,
  collectTempleTeamPayment: asyncNoop,
  ensureAllowance: asyncNoop,
};

const WalletContext = createContext<WalletState>(INITIAL_STATE);

export const WalletProvider = (props: PropsWithChildren<object>) => {
  const { children } = props;

  const [{ wallet, connecting }] = useConnectWallet();
  const [signer, setSigner] = useState<Nullable<Signer>>(null);
  const [walletAddress, setWalletAddress] = useState<string | undefined>();

  useEffect(() => {
    if (wallet) {
      const ethersProvider = new ethers.providers.Web3Provider(wallet.provider);
      setSigner(ethersProvider.getSigner());
      if (wallet.accounts.length > 0) {
        setWalletAddress(wallet.accounts[0].address);
      } else {
        setWalletAddress(undefined);
      }
    } else {
      setWalletAddress(undefined);
    }
  }, [wallet, connecting]);

  const { openNotification } = useNotification();

  const [balanceState, setBalanceState] = useState<Balance>(
    INITIAL_STATE.balance
  );

  const getBalance = async (walletAddress: string, signer: Signer) => {
    if (!walletAddress || !signer) {
      throw new NoWalletAddressError();
    }

    let response: Balance = {
      ETH: ZERO,
      TEMPLE: ZERO,
      OGTEMPLE: ZERO,
      FRAX: ZERO,
      USDC: ZERO,
      USDT: ZERO,
      DAI: ZERO,
      WETH: ZERO,
      OHM: ZERO,
    };

    if (env.contracts.frax) {
      const fraxContract = new ERC20__factory(signer).attach(
        env.contracts.frax
      );
      const fraxBalance: BigNumber = await fraxContract.balanceOf(
        walletAddress
      );
      response = { ...response, FRAX: fraxBalance };
    }

    if (env.contracts.usdc) {
      const usdcContract = new ERC20__factory(signer).attach(
        env.contracts.usdc
      );
      const usdcBalance: BigNumber = await usdcContract.balanceOf(
        walletAddress
      );
      response = { ...response, USDC: usdcBalance };
    }

    if (env.contracts.usdt) {
      const usdtContract = new ERC20__factory(signer).attach(
        env.contracts.usdt
      );
      const usdtBalance: BigNumber = await usdtContract.balanceOf(
        walletAddress
      );
      response = { ...response, USDT: usdtBalance };
    }

    if (env.contracts.dai) {
      const daiContract = new ERC20__factory(signer).attach(env.contracts.dai);
      const daiBalance: BigNumber = await daiContract.balanceOf(walletAddress);
      response = { ...response, DAI: daiBalance };
    }

    if (env.contracts.weth) {
      const wethContract = new ERC20__factory(signer).attach(
        env.contracts.weth
      );
      const wethBalance: BigNumber = await wethContract.balanceOf(
        walletAddress
      );
      response = { ...response, WETH: wethBalance };
    }

    if (env.contracts.olympus) {
      const ohmContract = new ERC20__factory(signer).attach(
        env.contracts.olympus
      );
      const ohmBalance: BigNumber = await ohmContract.balanceOf(walletAddress);
      response = { ...response, OHM: ohmBalance };
    }

    if (env.contracts.templeStaking) {
      const templeStakingContract = new TempleStaking__factory(signer).attach(
        env.contracts.templeStaking
      );
      const OG_TEMPLE_CONTRACT = new OGTemple__factory(signer).attach(
        await templeStakingContract.OG_TEMPLE()
      );
      const ogTempleBalance = await OG_TEMPLE_CONTRACT.balanceOf(walletAddress);
      response = { ...response, OGTEMPLE: ogTempleBalance };
    }

    if (env.contracts.temple) {
      const templeContract = new TempleERC20Token__factory(signer).attach(
        env.contracts.temple
      );
      const templeBalance = await templeContract.balanceOf(walletAddress);
      response = { ...response, TEMPLE: templeBalance };
    }

    return {
      ...response,
      ETH: await signer.getBalance(),
    };
  };

  const updateBalance = useCallback(async () => {
    if (!walletAddress || !signer) {
      return;
    }

    const balance = await getBalance(walletAddress, signer);
    setBalanceState(balance);
  }, [walletAddress, signer]);

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
      const approveTXN = await token.approve(spender, DEFAULT_ALLOWANCE, {
        gasLimit: 50000,
      });
      await approveTXN.wait();

      // Show feedback to user
      openNotification({
        title: `${tokenName} allowance approved`,
        hash: approveTXN.hash,
      });
    }
  };

  const collectTempleTeamPayment = async (epoch: number) => {
    if (walletAddress && signer && env.contracts.teamPayments) {
      const contractAddress = env.contracts.teamPayments[epoch].address;
      const teamPaymentContract = new TempleTeamPayments__factory(
        signer
      ).attach(contractAddress);

      const collectTxn = await teamPaymentContract.claim();
      const txnReceipt = await collectTxn.wait();

      openNotification({
        title: `${
          epoch <= 14 ? TICKER_SYMBOL.TEMPLE_TOKEN : TICKER_SYMBOL.DAI
        } claimed`,
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
        isConnected: !!walletAddress && !connecting,
        isConnecting: connecting,
        wallet: walletAddress, // to be deprecated, keeping now for backwards compatibility
        walletAddress,
        ensureAllowance,
        signer,
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
