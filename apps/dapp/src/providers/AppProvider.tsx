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

export enum PopoverName {
  Connect = 'Connect'
}

interface PopoverState {
  isOpen: boolean;
}

interface AppProviderState {
  state: Record<PopoverName, PopoverState>;
  openPopover: (name: PopoverName) => void;
  closePopover: (name: PopoverName) => void;
}

export const INITIAL_STATE: AppProviderState = {
  state: {
    [PopoverName.Connect]: {
      isOpen: false,
    },
  },
  openPopover: noop,
  closePopover: noop,
};

export const AppContext = createContext<AppProviderState>(INITIAL_STATE);

export const AppProvider = (props: PropsWithChildren<{}>) => {
  const [state, setState] = useState<AppProviderState['state']>(INITIAL_STATE.state);

  const togglePopoverState = useCallback((popover: PopoverName, isOpen: boolean) => setState((prevState) => ({
    ...prevState,
    [popover]: {
      ...prevState[popover],
      isOpen,
    },
  })), [setState]);

  const openPopover = useCallback((name: PopoverName) => {
    togglePopoverState(name, true);
  }, [togglePopoverState]);

  const closePopover = useCallback((name: PopoverName) => {
    togglePopoverState(name, false);
  }, [togglePopoverState]);

  return (
    <NotificationProvider>
      <WagmiProvider>
        <WalletProvider>
          <SwapProvider>
            <StakingProvider>
              <FaithProvider>
                <ThemeProvider theme={theme}>
                  <AppContext.Provider value={{ state, closePopover, openPopover }}>
                    <ConnectorPopover
                      isOpen={state[PopoverName.Connect].isOpen}
                      onClose={() => togglePopoverState(PopoverName.Connect, false)}
                    />
                    <WrongNetworkPopover />
                    {props.children}
                  </AppContext.Provider>
                </ThemeProvider>
              </FaithProvider>
            </StakingProvider>
          </SwapProvider>
        </WalletProvider>
      </WagmiProvider>
    </NotificationProvider>
  );
};

export const useAppContext = () => useContext(AppContext);
