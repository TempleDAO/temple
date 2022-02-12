import { AMMView } from 'components/Pages/AmmAltars';
import React, { useState } from 'react';

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

  //<Altars {...props} view={AMMView.STAKE} />

export type CustomRoutingPage = PageName | AMMView;

  // const Account = React.lazy(() => import('components/Pages/Account'));
  // const TempleGates = React.lazy(() => import('components/Pages/TempleGates'));
  // const Foyer = React.lazy(() => import('components/Pages/Foyer'));
  // const DashboardDoor = React.lazy(() => import('components/Pages/DashboardDoor'));
  // const Dashboard = React.lazy(() => import('components/Pages/Dashboard'));
  // const RitualsPosters = React.lazy(() => import('components/Pages/RitualsMoviePoster'));
  // const Portals = React.lazy(() => import('components/Pages/Portals'));
  // const AltarEnter = React.lazy(() => import('components/Pages/AltarEnter'));
  // const AltarExit = React.lazy(() => import('components/Pages/AltarExit'));
  // const AltarDevotion = React.lazy(() => import('components/Pages/AltarDevotion'));

type RoutingState = {
  changePageTo(PageComponent: CustomRoutingPage): void;
  back(): void;
  currentPage: CustomRoutingPage;
};

export type CustomRoutingPageProps = {
  routingHelper: RoutingState;
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
