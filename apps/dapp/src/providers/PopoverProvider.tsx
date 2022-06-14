import {
  createContext,
  useContext,
  FC,
  useState,
  useCallback,
} from 'react';
import { noop } from 'utils/helpers';
import { ConnectorPopover } from 'components/Layouts/CoreLayout/ConnectorPopover';
import { WrongNetworkPopover } from 'components/Layouts/CoreLayout/WrongNetworkPopover';

export enum PopoverName {
  Connect = 'Connect'
}

interface PopoverState {
  isOpen: boolean;
}

interface PopoverProviderState {
  state: Record<PopoverName, PopoverState>;
  openPopover: (name: PopoverName) => void;
  closePopover: (name: PopoverName) => void;
}

export const INITIAL_STATE: PopoverProviderState = {
  state: {
    [PopoverName.Connect]: {
      isOpen: false,
    },
  },
  openPopover: noop,
  closePopover: noop,
};

export const PopoverContext = createContext<PopoverProviderState>(INITIAL_STATE);

export const PopoverProvider: FC<{}> = ({ children }) => {
  const [state, setState] = useState<PopoverProviderState['state']>(INITIAL_STATE.state);

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
    <PopoverContext.Provider value={{ state, closePopover, openPopover }}>
      <>
        <ConnectorPopover
          isOpen={state[PopoverName.Connect].isOpen}
          onClose={() => togglePopoverState(PopoverName.Connect, false)}
        />
        <WrongNetworkPopover />
      </>
      {children}
    </PopoverContext.Provider>
  );
};

export const usePopoverContext = () => useContext(PopoverContext);
