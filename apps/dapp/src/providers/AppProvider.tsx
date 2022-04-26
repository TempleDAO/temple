import React, { PropsWithChildren } from 'react';
import { ThemeProvider } from 'styled-components';
import { theme } from 'styles/theme';
import { NotificationProvider } from 'providers/NotificationProvider';
import { WalletProvider } from 'providers/WalletProvider';
import { SwapProvider } from 'providers/SwapProvider';
import { StakingProvider } from 'providers/StakingProvider';
import { FaithProvider } from 'providers/FaithProvider';
import { WagmiProvider } from 'components/WagmiProvider';

export const AppProvider = (props: PropsWithChildren<{}>) => {
  return (
    <NotificationProvider>
      <WagmiProvider>
        <WalletProvider>
          <SwapProvider>
            <StakingProvider>
              <FaithProvider>
                <ThemeProvider theme={theme}>{props.children}</ThemeProvider>
              </FaithProvider>
            </StakingProvider>
          </SwapProvider>
        </WalletProvider>
      </WagmiProvider>
    </NotificationProvider>
  );
};
