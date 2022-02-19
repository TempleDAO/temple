import React from 'react';
import styled from 'styled-components';

import useCustomRouting, { CustomRoutingPageProps, NexusView } from 'hooks/use-custom-spa-routing';
import MetamaskButton from 'components/Button/MetamaskButton';
import DevotionCTA from 'components/Accessories/DevotionCTA';
import { useHash } from 'hooks/use-query';
import Spinner from 'components/Loader/Loader';
import { AMMView } from './AmmAltars';

type ExoticComponentWithPreload = React.LazyExoticComponent<React.ComponentType<any>> & {
  preload: () => Promise<any>;
};

// Note(MrFujisawa): Struggling to type this stuff correctly.
// Idea taken from https://medium.com/hackernoon/lazy-loading-and-preloading-components-in-react-16-6-804de091c82d
const createLazyPreloadable = (dynamicImport: () => Promise<any>): ExoticComponentWithPreload => {
  const ExoticComponent = React.lazy(dynamicImport);
  // @ts-ignore
  ExoticComponent.preload = dynamicImport;
  // @ts-ignore
  return ExoticComponent;
};

import TempleGates from 'components/Pages/TempleGates';
import Foyer from 'components/Pages/Foyer';

const Account = createLazyPreloadable(() => import('components/Pages/Account'));
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
  height: 100%;
`;

const Loader = () => (
  <LoaderWrapper>
    <Spinner />
  </LoaderWrapper>
);

const CurrentPage = ({ routingHelper }: CustomRoutingPageProps) => {
  switch (routingHelper.currentPage) {
    case NexusView.TempleGates:
      return (
        <TempleGates routingHelper={routingHelper} />
      );
    case NexusView.Account:
      return (
        <React.Suspense fallback={<Loader />}>
          <Account routingHelper={routingHelper} />
        </React.Suspense>
      );
    case NexusView.Foyer:
      return (
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
      );
    case NexusView.Dashboard:
      return (
        <React.Suspense fallback={<Loader />}>
          <Dashboard routingHelper={routingHelper} />
        </React.Suspense>
      );
    case NexusView.DashboardDoor:
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
    case NexusView.RitualPosters:
      return (
        <React.Suspense fallback={<Loader />}>
          <RitualsPosters routingHelper={routingHelper} />
        </React.Suspense>
      );
    case NexusView.Portals:
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
    case NexusView.AltarEnter:
      return (
        <React.Suspense fallback={<Loader />}>
          <AltarEnter routingHelper={routingHelper} />
        </React.Suspense>
      );
    case NexusView.AltarExit:
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
    case NexusView.AltarDevotion:
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

  // Note(MrFujisawa):
  // We should never get here as long as we've enumerated all the possible nexus routes.
  // console.error'ing here for sanity sake -- which should show up in Sentry once that's setup.
  console.error('Programming Error: Attempted to render unknown NexusPage.');

  return null;
}

const AmmSpaRoot = () => {
  const hash = useHash();
  const isDiscordRedirect = hash.get('access_token') && hash.get('token_type');

  const routingHelper = useCustomRouting(
    NexusView.TempleGates,
    isDiscordRedirect ? NexusView.Account : NexusView.TempleGates,
    isDiscordRedirect ? [NexusView.TempleGates, NexusView.Foyer, NexusView.DashboardDoor] : []
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
