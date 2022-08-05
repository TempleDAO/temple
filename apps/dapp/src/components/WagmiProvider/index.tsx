import { FC } from 'react';
import { WagmiConfig, chain, createClient, configureChains } from 'wagmi';
import { Buffer } from 'buffer';

import { alchemyProvider } from 'wagmi/providers/alchemy';
import { infuraProvider } from 'wagmi/providers/infura';
import { publicProvider } from 'wagmi/providers/public';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import env from 'constants/env';

// polyfill Buffer for client
// Buffer is required for WalletConnect to work.
if (!window.Buffer) {
  window.Buffer = Buffer;
}

// The default WAGMI HardHat Chain has the wrong ChainId.
export const LOCAL_CHAIN = {
  ...chain.hardhat,
  id: 31337,
};

const APP_CHAINS = [chain.mainnet, chain.rinkeby, chain.goerli, LOCAL_CHAIN];

const { chains, provider } = configureChains(APP_CHAINS, [
  alchemyProvider({ apiKey: env.alchemyId }),
  infuraProvider({ apiKey: env.infuraId }),
  publicProvider(),
]);

const connectors = [
  new InjectedConnector({
    chains,
    options: {
      shimDisconnect: true,
    },
  }),
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
    },
  }),
];

const client = createClient({
  autoConnect: true,
  connectors,
  provider,
});

export const WagmiProvider: FC = ({ children }) => <WagmiConfig client={client}>{children}</WagmiConfig>;
