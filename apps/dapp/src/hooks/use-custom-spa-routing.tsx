import * as React from 'react';

import { AMMView } from 'components/Pages/AmmAltars';

export enum NexusView {
  Account,
  TempleGates,
  Foyer,
  DashboardDoor,
  Dashboard,
  RitualPosters,
  Portals,
  AltarEnter,
  AltarExit,
  AltarDevotion,
}

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

  function changePageTo(pageRoute: CustomRoutingPage) {
    setNavHistory((history) => [...history, currentPage]);
    setCurrentPage(() => pageRoute);
  }

  function back() {
    const [prevPage] = navHistory.slice(-1);
    setNavHistory((history) => [...history.slice(0, -1)]);
    const backPage = prevPage ? () => prevPage : () => baseNexusPage;
    setCurrentPage(backPage);
  }

  return {
    changePageTo,
    back,
    currentPage,
  };
}

export default useCustomRouting;
