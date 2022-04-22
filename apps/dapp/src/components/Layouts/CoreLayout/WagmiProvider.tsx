import { FC } from 'react';
import { providers } from 'ethers';
import { BaseProvider } from '@ethersproject/providers';
import { 
  Provider,
  chain,
  Connector,
} from 'wagmi';
import { WalletLinkConnector } from 'wagmi/connectors/walletLink';
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
  ...chain.hardhat,
  id: 1337,
};

const chains = [chain.mainnet, chain.rinkeby, LOCAL_CHAIN];
const defaultChain = chain.mainnet;

const ENV_VARS = import.meta.env;
const ENV = ENV_VARS.VITE_ENV;
const ALCHEMY_PROVIDER_NETWORK = ENV_VARS.VITE_ALCHEMY_PROVIDER_NETWORK;
const ALCHEMY_API_KEY = ENV_VARS.VITE_ALCHEMY_API_KEY;

type ProviderConfig = { chainId?: number; connector?: Connector };
const provider = ({ chainId }: ProviderConfig) => {
  const provider = ENV === 'development'
    ? new providers.Web3Provider(window.ethereum)
    : new providers.AlchemyProvider(
      ALCHEMY_PROVIDER_NETWORK,
      ALCHEMY_API_KEY
    );
  return provider as unknown as BaseProvider;
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
    new WalletLinkConnector({
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
