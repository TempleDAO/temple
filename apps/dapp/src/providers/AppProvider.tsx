import React, { PropsWithChildren } from 'react';
import { ThemeProvider } from 'styled-components';
import { theme } from 'styles/theme';
import { NotificationProvider } from 'providers/NotificationProvider';
import { WalletProvider } from 'providers/WalletProvider';
import { SwapProvider } from 'providers/SwapProvider';
import { StakingProvider } from 'providers/StakingProvider';
import { FaithProvider } from 'providers/FaithProvider';
import { WagmiProvider } from 'components/WagmiProvider';
import { PopoverProvider } from './PopoverProvider';

export const AppProvider = (props: PropsWithChildren<{}>) => {
  return (
    <ThemeProvider theme={theme}>
      <NotificationProvider>
        <WagmiProvider>
          <WalletProvider>
            <SwapProvider>
              <StakingProvider>
                <FaithProvider>
                  {props.children}
                </FaithProvider>
              </StakingProvider>
            </SwapProvider>
          </WalletProvider>
        </WagmiProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};
