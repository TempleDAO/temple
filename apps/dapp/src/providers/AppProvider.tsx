import {
  PropsWithChildren,
  useState,
  useCallback,
  useContext,
  createContext,
} from 'react';
import { ThemeProvider } from 'styled-components';
import { theme } from 'styles/theme';
import { NotificationProvider } from 'providers/NotificationProvider';
import { WalletProvider } from 'providers/WalletProvider';
import { SwapProvider } from 'providers/SwapProvider';
import { StakingProvider } from 'providers/StakingProvider';
import { FaithProvider } from 'providers/FaithProvider';
import { WagmiProvider } from 'components/WagmiProvider';

import { noop } from 'utils/helpers';
import { ConnectorPopover } from 'components/Layouts/CoreLayout/ConnectorPopover';
import { WrongNetworkPopover } from 'components/Layouts/CoreLayout/WrongNetworkPopover';
import { RelicProvider } from './RelicProvider';

interface AppProviderState {
  showConnectPopover: () => void;
}

export const INITIAL_STATE: AppProviderState = {
  showConnectPopover: noop,
};

export const AppContext = createContext<AppProviderState>(INITIAL_STATE);

export const AppProvider = (props: PropsWithChildren<{}>) => {
  const [connectPopoverVisible, setConnectPopoverVisibile] = useState(false);

  const showConnectPopover = useCallback(() => {
    setConnectPopoverVisibile(true);
  }, [setConnectPopoverVisibile]);

  return (
    <NotificationProvider>
      <WagmiProvider>
        <WalletProvider>
          <SwapProvider>
            <StakingProvider>
              <FaithProvider>
                <RelicProvider>
                  <ThemeProvider theme={theme}>
                    <AppContext.Provider value={{ showConnectPopover }}>
                      <ConnectorPopover
                        isOpen={connectPopoverVisible}
                        onClose={() => setConnectPopoverVisibile(false)}
                      />
                      <WrongNetworkPopover />
                      {props.children}
                    </AppContext.Provider>
                  </ThemeProvider>
                </RelicProvider>
              </FaithProvider>
            </StakingProvider>
          </SwapProvider>
        </WalletProvider>
      </WagmiProvider>
    </NotificationProvider>
  );
};

export const useAppContext = () => useContext(AppContext);
