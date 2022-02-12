import React, { useState } from 'react';

import { AMMView } from 'components/Pages/AmmAltars';

type PageName =
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

export type CustomRoutingPage = PageName | AMMView;

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
  BasePageComponent: CustomRoutingPage,
  StartingPage?: CustomRoutingPage,
  StartingNavHistory?: CustomRoutingPage[]
): RoutingState {
  const [currentPage, setCurrentPage] = useState<CustomRoutingPage>(
    () => StartingPage || BasePageComponent
  );
  const [navHistory, setNavHistory] = useState<CustomRoutingPage[]>(
    StartingNavHistory || []
  );

  function changePageTo(PageComponent: CustomRoutingPage) {
    setNavHistory((history) => [...history, currentPage]);
    setCurrentPage(() => PageComponent);
  }

  function back() {
    const [PrevPage] = navHistory.slice(-1);
    setNavHistory((history) => [...history.slice(0, -1)]);
    const BackPage = PrevPage ? () => PrevPage : () => BasePageComponent;
    setCurrentPage(BackPage);
  }

  return {
    changePageTo,
    back,
    currentPage,
  };
}

export default useCustomRouting;
