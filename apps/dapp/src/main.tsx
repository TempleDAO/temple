import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { CaptureConsole } from '@sentry/integrations';

import { GlobalStyle } from 'styles/GlobalStyle';
import { AppProvider } from 'providers/AppProvider';

import NotificationManager from 'components/Notification/NotificationManager';

import PageLayout from 'components/Layouts/Page';
import Loader from 'components/Loader/Loader';

import Disclaimer from 'components/Pages/Disclaimer';

import CoreLayout from 'components/Layouts/CoreLayout';
import AnalyticsPage from 'components/Pages/Core/Analytics';
import VaultPage from 'components/Pages/Core/Vault';
import ProfilePage from 'components/Pages/Core/Profile/Profile';
import VaultListPage from 'components/Pages/Core/VaultList';
import HomePage from 'components/Pages/Core/HomePage';
import { Claim as VaultClaim } from 'components/Pages/Core/VaultPages/Claim';
import { Stake } from 'components/Pages/Core/VaultPages/Stake';
import { Summary } from 'components/Pages/Core/VaultPages/Summary';
import { Strategy } from 'components/Pages/Core/VaultPages/Strategy';
import TradeRoutes from 'components/Pages/Core/Trade';
import Timing from 'components/Pages/Core/VaultPages/Timing';

import env from 'constants/env';
import NexusPage from 'components/Pages/Core/Nexus/Nexus';

// Separate Chunks
const TeamPayments = React.lazy(() => import('components/Pages/TeamPayments'));
const FaithAirdrop = React.lazy(() => import('components/Pages/FaithAirdrop'));
const Claim = React.lazy(() => import('components/Pages/Claim'));

const LoaderWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  justify-self: center;
  min-height: 100vh;
`;

interface LazyPageProps {
  component: React.LazyExoticComponent<(props: {}) => JSX.Element>;
}

const LazyPage = ({ component: Component }: LazyPageProps) => (
  <Suspense
    fallback={
      <LoaderWrapper>
        <Loader />
      </LoaderWrapper>
    }
  >
    <Component />
  </Suspense>
);

if (env.sentry) {
  Sentry.init({
    dsn: env.sentry.dsn,
    integrations: [
      new BrowserTracing(),
      new CaptureConsole({
        levels: ['error'],
      }),
    ],
    tracesSampleRate: 0.2,
    environment: env.sentry.environment,
  });
}

ReactDOM.render(
  <React.StrictMode>
    <AppProvider>
      <GlobalStyle />
      <BrowserRouter>
        <Routes>
          <>
            <Route path="/" element={<PageLayout />}>
              <Route path="" element={<HomePage />} />
              {/* Redirect everything else to the home page */}c
              <Route path="*" element={<Navigate replace to="/" />} />
              <Route path="disclaimer" element={<Disclaimer />} />
              <Route
                path="faith-airdrop"
                element={<LazyPage component={FaithAirdrop} />}
              />
              <Route
                path="temple-claim"
                element={<LazyPage component={Claim} />}
              />
              <Route
                path="team-payments"
                element={<LazyPage component={TeamPayments} />}
              />
            </Route>
            <Route path="/dapp/*" element={<CoreLayout />}>
              <Route path="" element={<VaultListPage />} />

              <Route path="vaults" element={<VaultListPage />} />
              <Route path="vaults/:vaultId/*" element={<VaultPage />}>
                <Route path="claim" element={<VaultClaim />} />
                <Route path="stake" element={<Stake />} />
                <Route path="summary" element={<Summary />} />
                <Route path="strategy" element={<Strategy />} />
                <Route path="timing" element={<Timing />} />
              </Route>
              <Route path="trade/*" element={<TradeRoutes />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="nexus/*" element={<NexusPage />} />
            </Route>
          </>
        </Routes>
      </BrowserRouter>
      <NotificationManager />
    </AppProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
