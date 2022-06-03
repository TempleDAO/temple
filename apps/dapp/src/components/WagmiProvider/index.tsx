import { FC } from 'react';
import { providers, getDefaultProvider } from 'ethers';
import { BaseProvider } from '@ethersproject/providers';
import { 
  Provider,
  chain,
  Connector,
} from 'wagmi';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { Buffer } from 'buffer';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';

// polyfill Buffer for client
// Buffer is required for WalletConnect to work.
if (!window.Buffer) {
  window.Buffer = Buffer;
}

// The default WAGMI HardHat Chain has the wrong ChainId.
export const LOCAL_CHAIN = {
  ...chain.mainnet
  //...chain.hardhat,
  //id: 31337,
};

const chains = [chain.mainnet, chain.rinkeby, LOCAL_CHAIN];
const defaultChain = LOCAL_CHAIN; //change back to chain.mainnet

const ENV_VARS = import.meta.env;
const ALCHEMY_PROVIDER_NETWORK = ENV_VARS.VITE_ALCHEMY_PROVIDER_NETWORK;
const ALCHEMY_API_KEY = ENV_VARS.VITE_ALCHEMY_API_KEY;
const ENV = ENV_VARS.VITE_ENV;

type ProviderConfig = { chainId?: number; connector?: Connector };
const provider = ({ chainId }: ProviderConfig) => {
  if (ENV === 'production') {
    return new providers.AlchemyProvider(
      ALCHEMY_PROVIDER_NETWORK,
      ALCHEMY_API_KEY
    ) as unknown as BaseProvider;
  }

  if (window.ethereum) {
    return new providers.Web3Provider(window.ethereum) as unknown as BaseProvider;
  }
  
  return getDefaultProvider() as BaseProvider;
};

type ConnectorsConfig = { chainId?: number };
const connectors = ({ chainId }: ConnectorsConfig) => {
  const rpcUrl = chains.find(({ id }) => id === chainId)?.rpcUrls?.[0] ?? defaultChain.rpcUrls[0];
  
  return [
    new InjectedConnector({ chains, options: { shimDisconnect: true } }),
    new WalletConnectConnector({
      chains,
      options: {
        qrcode: true,
      },
    }),
    new CoinbaseWalletConnector({
      chains,
      options: {
        appName: 'TempleDAO',
        jsonRpcUrl: `${rpcUrl}/${ALCHEMY_API_KEY}`,
      },
    }),
  ];
};

export const WagmiProvider: FC = ({ children }) => (
  <Provider
    autoConnect
    provider={provider}
    connectors={connectors}
  >
    {children}
  </Provider>
);
