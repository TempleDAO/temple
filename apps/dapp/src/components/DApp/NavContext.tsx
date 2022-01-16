import React from 'react';
import { DAppView } from 'enums/dapp-view';

export const NavContext = React.createContext({
  activeView: DAppView.BUY,

  // eslint-disable-next-line @typescript-eslint/no-empty-function,  @typescript-eslint/no-unused-vars
  setView: (view: DAppView) => {},
});
