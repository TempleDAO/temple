import React from 'react';
import styled from 'styled-components';

import useCustomRouting, { CustomRoutingPageProps } from 'hooks/use-custom-spa-routing';
import MetamaskButton from 'components/Button/MetamaskButton';
import DevotionCTA from 'components/Accessories/DevotionCTA';
import { useHash } from 'hooks/use-query';
import Spinner from 'components/Loader/Loader';
import { AMMView } from './AmmAltars';

type ExoticComponentWithPreload = React.LazyExoticComponent<React.ComponentType<any>> & {
  preload: () => Promise<any>;
}

// Note(MrFujisawa):
// Idea taken from https://medium.com/hackernoon/lazy-loading-and-preloading-components-in-react-16-6-804de091c82d
const createLazyPreloadable = (dynamicImport: () => Promise<any>): ExoticComponentWithPreload => {
  const ExoticComponent = React.lazy(dynamicImport);
  // @ts-ignore
  ExoticComponent.preload = dynamicImport;
  // @ts-ignore
  return ExoticComponent;
};

const Account = createLazyPreloadable(() => import('components/Pages/Account'));
const TempleGates = createLazyPreloadable(() => import('components/Pages/TempleGates'));
const Foyer = createLazyPreloadable(() => import('components/Pages/Foyer'));
const DashboardDoor = createLazyPreloadable(() => import('components/Pages/DashboardDoor'));
const Dashboard = createLazyPreloadable(() => import('components/Pages/Dashboard'));
const RitualsPosters = createLazyPreloadable(() => import('components/Pages/RitualsMoviePoster'));
const Portals = createLazyPreloadable(() => import('components/Pages/Portals'));
const AltarEnter = createLazyPreloadable(() => import('components/Pages/AltarEnter'));
const AltarExit = createLazyPreloadable(() => import('components/Pages/AltarExit'));
const AltarDevotion = createLazyPreloadable(() => import('components/Pages/AltarDevotion'));
const AmmAltars = createLazyPreloadable(() => import('./AmmAltars'));

const Container = styled.div`
  height: 100vh;
  width: 100vw;
`;

const LoaderWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  justify-self: center;
`;

const Loader = () => (
  <LoaderWrapper>
    <Spinner />
  </LoaderWrapper>
);

const CurrentPage = ({ routingHelper }: CustomRoutingPageProps) => {
  switch (routingHelper.currentPage) {
    case 'TempleGates':
      return (
        <React.Suspense fallback={<Loader />}>
          <TempleGates
            routingHelper={routingHelper}
            preloadPages={() => {
              Foyer.preload().catch((err) => console.error('[Preload Error] ', err));
            }}
          />
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
          <Foyer
            routingHelper={routingHelper}
            preloadPages={() => {
              Promise.all([
                RitualsPosters.preload(),
                Portals.preload(),
                DashboardDoor.preload(),
              ]).catch((err) => console.error('[Preload Error] ', err));
            }}
          />
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
          <DashboardDoor
            preloadPages={() => {
              Promise.all([
                Account.preload(),
                Dashboard.preload(),
              ]).catch((err) => console.error('[Preload Error] ', err));
            }}
            routingHelper={routingHelper}
          />
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
          <Portals
            routingHelper={routingHelper}
            preloadPages={() => {
              Promise.all([
                AltarDevotion.preload(),
                AltarEnter.preload(),
                AltarExit.preload(),
              ]).catch((err) => console.error('[Preload Error] ', err));
            }}
          />
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
          <AltarExit
            routingHelper={routingHelper}
            preloadPages={() => {
              AmmAltars.preload().catch((err) => console.error('[Preload Error] ', err));
            }}
          />
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
