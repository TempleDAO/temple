import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { BigNumber, ethers, Signer } from 'ethers';
import { useConnectWallet, useSetChain } from '@web3-onboard/react';

import { useNotification } from 'providers/NotificationProvider';
import { NoWalletAddressError } from 'providers/errors';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { toAtto } from 'utils/bigNumber';
import { asyncNoop } from 'utils/helpers';
import { WalletState, Balance } from 'providers/types';
import {
  ERC20__factory,
  TempleTeamPayments__factory,
  ERC20,
} from 'types/typechain';
import env from 'constants/env';
import { ZERO } from 'utils/bigNumber';
import { Nullable } from 'types/util';
import { estimateAndMine } from 'utils/ethers';
import { useApiManager } from 'hooks/use-api-manager';
import { getAppConfig } from 'constants/newenv';

const ENV = import.meta.env;

// We want to save gas burn $ for the Templars,
// so we approving 1M up front, so only 1 approve TXN is required for approve
const DEFAULT_ALLOWANCE = toAtto(100000000);

// const readOnlyProvider = new ethers.providers.JsonRpcProvider(env.rpcUrl)

const INITIAL_STATE: WalletState = {
  balance: {
    FRAX: ZERO,
    USDC: ZERO,
    USDT: ZERO,
    DAI: ZERO,
    USDS: ZERO,
    ETH: ZERO,
    WETH: ZERO,
    TEMPLE: ZERO,
    OGTEMPLE: ZERO,
    OHM: ZERO,
    TGLD: ZERO,
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
  ensureAllowanceWithSigner: asyncNoop,
  ethersProvider: null,
  // new properties
  switchNetwork: asyncNoop,
  getConnectedSigner: () => {
    throw new Error('Not implemented');
  },
};

const WalletContext = createContext<WalletState>(INITIAL_STATE);

export const WalletProvider = (props: PropsWithChildren<object>) => {
  const { children } = props;

  const [{ wallet, connecting }] = useConnectWallet();
  const [signer, setSigner] = useState<Nullable<Signer>>(null);
  const [walletAddress, setWalletAddress] = useState<string | undefined>();
  const [ethersProvider, setEthersProvider] =
    useState<ethers.providers.Web3Provider | null>(null);

  const { papi } = useApiManager();

  // new methods and properties ---------------------------------------
  const [, setChain] = useSetChain();

  const getConnectedSigner = useCallback(() => {
    if (!wallet?.provider) {
      throw new Error('No wallet connected');
    }
    const provider = new ethers.providers.Web3Provider(wallet.provider, 'any');
    return provider.getSigner();
  }, [wallet]);

  const getCurrentChainId = useCallback(async (): Promise<number> => {
    if (!ethersProvider) {
      throw new Error('No provider available');
    }

    const { chainId } = await ethersProvider.getNetwork();
    return chainId;
  }, [ethersProvider]);

  const switchNetwork = useCallback(
    async (chainId: number) => {
      try {
        await setChain({ chainId: '0x' + chainId.toString(16) });

        const currentChainId = await getCurrentChainId();
        if (currentChainId !== chainId) {
          throw new Error(
            `Network switch failed: expected ${chainId}, but got ${currentChainId}`
          );
        }

        console.log(`Successfully switched to chain ${chainId}`);
      } catch (error) {
        console.error('Failed to switch network:', error);
      }
    },
    [getCurrentChainId, setChain]
  );

  const getChainIdForToken = useCallback(() => {
    // Really we need to refactor this also,
    // we should use chains.ts or some other approach
    // for now this is ok

    // ENV is either production or preview (or local, but don't really care about local)
    if (ENV.VITE_ENV === 'production') {
      // for now, only the one chain in production, mainnet
      return 1;
    } else if (ENV.VITE_ENV === 'preview') {
      // for now, only the one chain in preview, sepolia
      return 11155111;
    } else {
      throw new Error('Invalid environment');
    }
  }, []);

  // ------------------------------------------------------------

  useEffect(() => {
    if (wallet) {
      const ethersProvider = new ethers.providers.Web3Provider(wallet.provider);
      setEthersProvider(ethersProvider);
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

  const getBalance = useCallback(
    async (walletAddress: string) => {
      if (!walletAddress) {
        throw new NoWalletAddressError();
      }

      let response: Balance = {
        ETH: ZERO,
        TEMPLE: ZERO,
        OGTEMPLE: ZERO,
        DAI: ZERO,
        USDS: ZERO,
        TGLD: ZERO,
        FRAX: ZERO,
        USDC: ZERO,
        USDT: ZERO,
        WETH: ZERO,
        OHM: ZERO,
      };

      // FYI Temporarily comment out unused tokens
      // These can probably be removed completely
      // if (env.contracts.frax) {
      //   const fraxContract = getTokenContract(
      //     env.contracts.frax,
      //     getChainIdForToken()
      //   );

      //   const fraxBalance: BigNumber = await fraxContract.balanceOf(
      //     walletAddress
      //   );
      //   response = { ...response, FRAX: fraxBalance };
      // }

      // if (env.contracts.usdc) {
      //   const usdcContract = getTokenContract(
      //     env.contracts.usdc,
      //     getChainIdForToken()
      //   );

      //   const usdcBalance: BigNumber = await usdcContract.balanceOf(
      //     walletAddress
      //   );
      //   response = { ...response, USDC: usdcBalance };
      // }

      // if (env.contracts.usdt) {
      //   const usdtContract = getTokenContract(
      //     env.contracts.usdt,
      //     getChainIdForToken()
      //   );
      //   const usdtBalance: BigNumber = await usdtContract.balanceOf(
      //     walletAddress
      //   );
      //   response = { ...response, USDT: usdtBalance };
      // }

      // if (env.contracts.weth) {
      //   const wethContract = getTokenContract(
      //     env.contracts.weth,
      //     getChainIdForToken()
      //   );
      //   const wethBalance: BigNumber = await wethContract.balanceOf(
      //     walletAddress
      //   );
      //   response = { ...response, WETH: wethBalance };
      // }

      // if (env.contracts.olympus) {
      //   const ohmContract = getTokenContract(
      //     env.contracts.olympus,
      //     getChainIdForToken()
      //   );
      //   const ohmBalance: BigNumber = await ohmContract.balanceOf(
      //     walletAddress
      //   );
      //   response = { ...response, OHM: ohmBalance };
      // }

      if (getAppConfig().tokens.daiToken?.address) {
        const daiBalance = await papi.getTokenBalance(
          walletAddress,
          getAppConfig().tokens.daiToken
        );
        response = { ...response, DAI: daiBalance };
      }

      if (getAppConfig().tokens.usdsToken?.address) {
        const usdsBalance = await papi.getTokenBalance(
          walletAddress,
          getAppConfig().tokens.usdsToken
        );
        response = { ...response, USDS: usdsBalance };
      }

      if (getAppConfig().tokens.ogTempleToken?.address) {
        const ogTempleBalance = await papi.getTokenBalance(
          walletAddress,
          getAppConfig().tokens.ogTempleToken
        );
        response = { ...response, OGTEMPLE: ogTempleBalance };
      }

      if (getAppConfig().tokens.templeToken?.address) {
        const templeBalance = await papi.getTokenBalance(
          walletAddress,
          getAppConfig().tokens.templeToken
        );
        response = { ...response, TEMPLE: templeBalance };
      }

      if (getAppConfig().contracts.templeGoldStaking.address) {
        const tgldBalance = await papi.getTokenBalance(
          walletAddress,
          getAppConfig().tokens.templeGoldToken
        );
        response = { ...response, TGLD: tgldBalance };
      }

      return {
        ...response,
        // TODO: Technically need get native balance for each chain
        ETH: await papi.getNativeBalance(getChainIdForToken(), walletAddress),
      };
    },
    [getChainIdForToken, papi]
  );

  const updateBalance = useCallback(async () => {
    if (!walletAddress) {
      setBalanceState(INITIAL_STATE.balance);
      return;
    }

    const balance = await getBalance(walletAddress);
    setBalanceState(balance);
  }, [getBalance, walletAddress]);

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
    minAllowance: BigNumber,
    shouldUseMinAllowance = false
  ) => {
    // pre-condition
    if (!walletAddress || !signer) {
      throw new NoWalletAddressError();
    }

    const token = erc20Token as ERC20;
    const allowance = await token.allowance(walletAddress, spender);

    if (allowance.lt(minAllowance)) {
      // increase allowance
      const populatedTransaction = await token.populateTransaction.approve(
        spender,
        shouldUseMinAllowance ? minAllowance : DEFAULT_ALLOWANCE
      );

      const receipt = await estimateAndMine(signer, populatedTransaction);

      // Show feedback to user
      openNotification({
        title: `${tokenName} allowance approved`,
        hash: receipt.transactionHash,
      });
    }
  };

  // The reason we have this is that, with the new network agnostic implementation
  // we can't use the contract bound to a signer that might not be on the right chain
  // or a wallet signer at all. So it could cause problems.
  // This should be moved to a new signer api with a better approach but it's fine for now
  const ensureAllowanceWithSigner = async (
    tokenName: string,
    tokenAddress: string,
    spenderAddress: string,
    minAllowance: BigNumber,
    shouldUseMinAllowance = false,
    signer: Signer
  ) => {
    // pre-condition
    if (!walletAddress || !signer) {
      throw new NoWalletAddressError();
    }

    const tokenContract = new ERC20__factory(signer).attach(tokenAddress);

    const allowance = await tokenContract.allowance(
      walletAddress,
      spenderAddress
    );

    if (allowance.lt(minAllowance)) {
      // increase allowance
      const populatedTransaction =
        await tokenContract.populateTransaction.approve(
          spenderAddress,
          shouldUseMinAllowance ? minAllowance : DEFAULT_ALLOWANCE
        );

      const receipt = await estimateAndMine(signer, populatedTransaction);

      // Show feedback to user
      openNotification({
        title: `${tokenName} allowance approved`,
        hash: receipt.transactionHash,
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
        ensureAllowanceWithSigner,
        signer,
        getBalance: updateBalance,
        updateBalance,
        collectTempleTeamPayment,
        ethersProvider,
        // new methods
        switchNetwork,
        getConnectedSigner,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
