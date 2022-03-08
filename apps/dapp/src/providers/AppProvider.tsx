import React, { PropsWithChildren } from 'react';
import { ThemeProvider } from 'styled-components';
import { theme } from 'styles/theme';
import { NotificationProvider } from 'providers/NotificationProvider';
import { WalletProvider } from 'providers/WalletProvider';
import { SwapProvider } from 'providers/SwapProvider';
import { StakingProvider } from 'providers/StakingProvider';
import { FaithProvider } from 'providers/FaithProvider';

export const AppProvider = (props: PropsWithChildren<{}>) => {
  return (
    <NotificationProvider>
      <WalletProvider>
        <SwapProvider>
          <StakingProvider>
            <FaithProvider>
              <ThemeProvider theme={theme}>{props.children}</ThemeProvider>
            </FaithProvider>
          </StakingProvider>
        </SwapProvider>
      </WalletProvider>
    </NotificationProvider>
  );
};
