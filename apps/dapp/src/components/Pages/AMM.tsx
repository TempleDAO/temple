import React from 'react';
import styled from 'styled-components';

import useCustomRouting, { CustomRoutingPageProps } from 'hooks/use-custom-spa-routing';
import MetamaskButton from 'components/Button/MetamaskButton';
import DevotionCTA from 'components/Accessories/DevotionCTA';
import { useHash } from 'hooks/use-query';
import Loader from 'components/Loader/Loader';
import { AMMView } from './AmmAltars';

const Account = React.lazy(() => import('components/Pages/Account'));
const TempleGates = React.lazy(() => import('components/Pages/TempleGates'));
const Foyer = React.lazy(() => import('components/Pages/Foyer'));
const DashboardDoor = React.lazy(() => import('components/Pages/DashboardDoor'));
const Dashboard = React.lazy(() => import('components/Pages/Dashboard'));
const RitualsPosters = React.lazy(() => import('components/Pages/RitualsMoviePoster'));
const Portals = React.lazy(() => import('components/Pages/Portals'));
const AltarEnter = React.lazy(() => import('components/Pages/AltarEnter'));
const AltarExit = React.lazy(() => import('components/Pages/AltarExit'));
const AltarDevotion = React.lazy(() => import('components/Pages/AltarDevotion'));
const AmmAltars = React.lazy(() => import('./AmmAltars'));

const Container = styled.div`
  height: 100vh;
  width: 100vw;
`;

const CurrentPage = ({ routingHelper }: CustomRoutingPageProps) => {
  switch (routingHelper.currentPage) {
    case 'TempleGates':
      return (
        <React.Suspense fallback={<Loader />}>
          <TempleGates routingHelper={routingHelper} />
        </React.Suspense>
      );
    case 'Account':
      return (
        <React.Suspense fallback={<Loader />}>
          <Account routingHelper={routingHelper} />
        </React.Suspense>
      );
    case 'Foyer':
      return (
        <React.Suspense fallback={<Loader />}>
          <Foyer routingHelper={routingHelper} />
        </React.Suspense>
      );
    case 'Dashboard':
      return (
        <React.Suspense fallback={<Loader />}>
          <Dashboard routingHelper={routingHelper} />
        </React.Suspense>
      );
    case 'DashboardDoor':
      return (
        <React.Suspense fallback={<Loader />}>
          <DashboardDoor routingHelper={routingHelper} />
        </React.Suspense>
      );
    case 'RitualsPosters':
      return (
        <React.Suspense fallback={<Loader />}>
          <RitualsPosters routingHelper={routingHelper} />
        </React.Suspense>
      );
    case 'Portals':
      return (
        <React.Suspense fallback={<Loader />}>
          <Portals routingHelper={routingHelper} />
        </React.Suspense>
      );
    case 'AltarEnter':
      return (
        <React.Suspense fallback={<Loader />}>
          <AltarEnter routingHelper={routingHelper} />
        </React.Suspense>
      );
    case 'AltarExit':
      return (
        <React.Suspense fallback={<Loader />}>
          <AltarExit routingHelper={routingHelper} />
        </React.Suspense>
      );
    case 'AltarDevotion':
      return (
        <React.Suspense fallback={<Loader />}>
          <AltarDevotion routingHelper={routingHelper} />
        </React.Suspense>
      );
  }

  if (routingHelper.currentPage in AMMView) {
    return (
      <React.Suspense fallback={<Loader />}>
        <AmmAltars
          routingHelper={routingHelper}
          view={routingHelper.currentPage}
        />
      </React.Suspense>
    );
  }

  return null;
}

const AmmSpaRoot = () => {
  const hash = useHash();
  const isDiscordRedirect = hash.get('access_token') && hash.get('token_type');

  const routingHelper = useCustomRouting(
    'TempleGates',
    isDiscordRedirect ? 'Account' : 'TempleGates',
    isDiscordRedirect ? ['TempleGates', 'Foyer', 'DashboardDoor'] : []
  );

  return (
    <Container>
      <DevotionCTA />
      <MetamaskButton />
      <CurrentPage routingHelper={routingHelper} />
    </Container>
  );
};

export default AmmSpaRoot;
