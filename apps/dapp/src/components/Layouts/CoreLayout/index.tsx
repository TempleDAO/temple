import { Outlet } from 'react-router-dom';
import styled from 'styled-components';
import { phoneAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';
import { Provider as WagmiProvider, chain, defaultChains } from 'wagmi';
import { Buffer } from 'buffer';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';

import Header from './Header';

// polyfill Buffer for client
if (!window.Buffer) {
  window.Buffer = Buffer;
}

const chains = defaultChains;

type ConnectorsConfig = { chainId?: number };
const connectors = ({ chainId }: ConnectorsConfig) => {
  return [
    new InjectedConnector({ chains, options: { shimDisconnect: true } }),
    new WalletConnectConnector({
      chains,
      options: {
        qrcode: true,
      },
    }),
    // TODO(Fujisawa): This borks the build but we should support it eventually.
    // new WalletLinkConnector({
    //   chains,
    //   options: {
    //     appName: 'wagmi',
    //     jsonRpcUrl: `${rpcUrl}/${ ''}`,
    //   },
    // }),
  ]
}

const CoreLayout = () => (
  <WagmiProvider
    autoConnect
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
