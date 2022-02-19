import * as React from 'react';

import { AMMView } from 'components/Pages/AmmAltars';

type NexusView =
  'Account' |
  'TempleGates' |
  'Foyer' |
  'DashboardDoor' |
  'Dashboard' |
  'RitualsPosters' |
  'Portals' |
  'AltarEnter' |
  'AltarExit' |
  'AltarDevotion';

export type CustomRoutingPage = NexusView | AMMView;

type RoutingState = {
  changePageTo(PageComponent: CustomRoutingPage): void;
  back(): void;
  currentPage: CustomRoutingPage;
};

export type CustomRoutingPageProps = {
  routingHelper: RoutingState;
  preloadPages?: () => void;
};

function useCustomRouting(
  baseNexusPage: CustomRoutingPage,
  startingNexusPage?: CustomRoutingPage,
  startingNexuHistory?: CustomRoutingPage[]
): RoutingState {
  const [currentPage, setCurrentPage] = React.useState<CustomRoutingPage>(
    () => startingNexusPage || baseNexusPage
  );
  const [navHistory, setNavHistory] = React.useState<CustomRoutingPage[]>(
    startingNexuHistory || []
  );

  function changePageTo(PageComponent: CustomRoutingPage) {
    setNavHistory((history) => [...history, currentPage]);
    setCurrentPage(() => PageComponent);
  }

  function back() {
    const [PrevPage] = navHistory.slice(-1);
    setNavHistory((history) => [...history.slice(0, -1)]);
    const BackPage = PrevPage ? () => PrevPage : () => baseNexusPage;
    setCurrentPage(BackPage);
  }

  return {
    changePageTo,
    back,
    currentPage,
  };
}

export default useCustomRouting;
