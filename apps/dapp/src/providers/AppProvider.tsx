import { PropsWithChildren, useContext, createContext } from 'react';
import { ThemeProvider } from 'styled-components';
import { theme } from 'styles/theme';
import { NotificationProvider } from 'providers/NotificationProvider';
import { WalletProvider } from 'providers/WalletProvider';
import { StakingProvider } from 'providers/StakingProvider';
import { FaithProvider } from 'providers/FaithProvider';
import { VaultContextProvider } from 'components/Pages/Core/VaultContext';

import { WrongNetworkPopover } from 'components/Layouts/CoreLayout/WrongNetworkPopover';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SpiceBazaarProvider } from './SpiceBazaarProvider';
import { SpiceAuctionProvider } from './SpiceAuctionProvider';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AppProviderState {}

export const INITIAL_STATE: AppProviderState = {};

export const AppContext = createContext<AppProviderState>(INITIAL_STATE);

// eslint-disable-next-line @typescript-eslint/ban-types
export const AppProvider = (props: PropsWithChildren<{}>) => {
  const queryClient = new QueryClient();

  return (
    <NotificationProvider>
      <WalletProvider>
        <QueryClientProvider client={queryClient}>
          <StakingProvider>
            <FaithProvider>
              <VaultContextProvider>
                <ThemeProvider theme={theme}>
                  <AppContext.Provider value={{}}>
                    <WrongNetworkPopover />
                    <SpiceAuctionProvider>
                      <SpiceBazaarProvider>
                        {props.children}
                      </SpiceBazaarProvider>
                    </SpiceAuctionProvider>
                  </AppContext.Provider>
                </ThemeProvider>
              </VaultContextProvider>
            </FaithProvider>
          </StakingProvider>
        </QueryClientProvider>
      </WalletProvider>
    </NotificationProvider>
  );
};

export const useAppContext = () => useContext(AppContext);
