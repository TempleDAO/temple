import { FC } from 'react';
import { WagmiConfig, createClient, configureChains } from 'wagmi';
import { mainnet, goerli, hardhat, arbitrum, arbitrumGoerli, sepolia } from 'wagmi/chains';
import { Buffer } from 'buffer';

import { alchemyProvider } from 'wagmi/providers/alchemy';
import { infuraProvider } from 'wagmi/providers/infura';
import { publicProvider } from 'wagmi/providers/public';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { SafeConnector } from 'wagmi/connectors/safe';
import env from 'constants/env';

// polyfill Buffer for client
// Buffer is required for WalletConnect to work.
if (!window.Buffer) {
  window.Buffer = Buffer;
}

// The default WAGMI HardHat Chain has the wrong ChainId.
export const LOCAL_CHAIN = {
  ...hardhat,
  id: 31337,
};

const APP_CHAINS = [mainnet, sepolia, LOCAL_CHAIN, arbitrum, arbitrumGoerli];

const { chains, provider } = configureChains(APP_CHAINS, [
  alchemyProvider({ apiKey: env.alchemyId }),
  infuraProvider({ apiKey: env.infuraId }),
  publicProvider(),
]);

const connectors = [
  new MetaMaskConnector({
    chains,
    options: {
      shimDisconnect: true,
    },
  }),
  new WalletConnectConnector({
    chains,
    options: {
      showQrModal: true,
      projectId: 'b7ff3533ae86dc9fd727429a32572d08',
    },
  }),
  new CoinbaseWalletConnector({
    chains,
    options: {
      appName: 'TempleDAO',
    },
  }),
  new SafeConnector({
    chains,
    options: {
      allowedDomains: [/https:\/\/app.safe.global$/],
      debug: false,
    },
  }),
  // NOTE: This should always remain the last in this array
  // https://github.com/TempleDAO/temple/blob/1fab91737d7fe91a0945a3318e848f577ef98511/apps/dapp/src/components/Layouts/CoreLayout/ConnectorPopover.tsx#L49
  new InjectedConnector({
    chains,
    options: {
      shimDisconnect: true,
    },
  }),
];

const client = createClient({
  autoConnect: true,
  connectors,
  provider,
});

export const WagmiProvider: FC = ({ children }) => <WagmiConfig client={client}>{children}</WagmiConfig>;
