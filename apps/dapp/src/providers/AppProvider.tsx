import { PropsWithChildren, useContext, createContext } from 'react';
import { ThemeProvider } from 'styled-components';
import { theme } from 'styles/theme';
import { NotificationProvider } from 'providers/NotificationProvider';
import { WalletProvider } from 'providers/WalletProvider';
import { SwapProvider } from 'providers/SwapProvider';
import { StakingProvider } from 'providers/StakingProvider';
import { FaithProvider } from 'providers/FaithProvider';
import { VaultContextProvider } from 'components/Pages/Core/VaultContext';

import { Web3OnboardInitProvider } from 'components/Web3OnboardInitProvider';
import { WrongNetworkPopover } from 'components/Layouts/CoreLayout/WrongNetworkPopover';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AppProviderState {}

export const INITIAL_STATE: AppProviderState = {};

export const AppContext = createContext<AppProviderState>(INITIAL_STATE);

// eslint-disable-next-line @typescript-eslint/ban-types
export const AppProvider = (props: PropsWithChildren<{}>) => {
  const queryClient = new QueryClient();

  return (
    <NotificationProvider>
      <Web3OnboardInitProvider>
        <WalletProvider>
          <QueryClientProvider client={queryClient}>
            <SwapProvider>
              <StakingProvider>
                <FaithProvider>
                  <VaultContextProvider>
                    <ThemeProvider theme={theme}>
                      <AppContext.Provider value={{}}>
                        <WrongNetworkPopover />
                        {props.children}
                      </AppContext.Provider>
                    </ThemeProvider>
                  </VaultContextProvider>
                </FaithProvider>
              </StakingProvider>
            </SwapProvider>
          </QueryClientProvider>
        </WalletProvider>
      </Web3OnboardInitProvider>
    </NotificationProvider>
  );
};

export const useAppContext = () => useContext(AppContext);
