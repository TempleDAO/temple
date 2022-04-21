import { Outlet } from 'react-router-dom';
import styled from 'styled-components';
import { phoneAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';
import { providers } from 'ethers';
import { BaseProvider } from '@ethersproject/providers';
import { 
  WagmiProvider,
  chain,
  defaultChains,
  Connector,
  developmentChains,
} from 'wagmi';
import { WalletLinkConnector } from 'wagmi/connectors/walletLink';
import { Buffer } from 'buffer';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';

import Header from './Header';

// polyfill Buffer for client
// Buffer is required for WalletConnect to work.
if (!window.Buffer) {
  window.Buffer = Buffer;
}

const chains = [chain.mainnet, ...developmentChains];
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

const CoreLayout = () => (
  <WagmiProvider
    autoConnect
    provider={provider}
    connectors={connectors}
  >
    <Header />
    <Main>
      <Outlet />
    </Main>
  </WagmiProvider>
);

export default CoreLayout;

const Main = styled.main`
  margin: 0 auto;
  padding: 0px;
  ${phoneAndAbove(`
    max-width: ${theme.metrics.desktop.maxWidth};
  `)}
`;
