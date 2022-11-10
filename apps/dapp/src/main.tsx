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
import PoolListPage from 'components/Pages/Ascend/PoolList';
import { Claim as VaultClaim } from 'components/Pages/Core/VaultPages/Claim';
import { Stake } from 'components/Pages/Core/VaultPages/Stake';
import { Summary } from 'components/Pages/Core/VaultPages/Summary';
import { Strategy } from 'components/Pages/Core/VaultPages/Strategy';
import TradeRoutes from 'components/Pages/Core/Trade';
import Timing from 'components/Pages/Core/VaultPages/Timing';
import { AscendLayout } from 'components/Layouts/Ascend';
import { CreateLBPPage } from 'components/Pages/Ascend/admin/create';
import { EditLBPPage } from 'components/Pages/Ascend/admin/edit';
import { AscendPage } from 'components/Pages/Ascend';
import { AscendListPage } from 'components/Pages/AscendList';

import env from 'constants/env';
import { AnalyticsService } from 'services/AnalyticsService';
import NexusPage from 'components/Pages/Nexus/Relic';
import QuestPage from 'components/Pages/Nexus/Quest';
import ForgePage from 'components/Pages/Nexus/Forge';

// Separate Chunks
const TeamPayments = React.lazy(() => import('components/Pages/TeamPayments'));

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

AnalyticsService.init();

const nexusOnly = !!env.featureFlags.nexusOnlyMode;

ReactDOM.render(
  <React.StrictMode>
    <AppProvider>
      <GlobalStyle />
      <BrowserRouter>
        <Routes>
          {!nexusOnly && (
            <>
              <Route path="/" element={<PageLayout />}>
                <Route path="" element={<HomePage />} />
                <Route path="*" element={<Navigate replace to="/" />} />
                <Route path="disclaimer" element={<Disclaimer />} />
                <Route path="team-payments" element={<LazyPage component={TeamPayments} />} />
              </Route>
              <Route path="/dapp/*" element={<CoreLayout mode="dapp" />}>
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

                {env.featureFlags.enableAscend && (
                  <>
                    <Route path="ascend/*" element={<AscendLayout />}>
                      <Route path="" element={<AscendListPage />} />
                      <Route path="admin" element={<PoolListPage />} />
                      <Route path="admin/new" element={<CreateLBPPage />} />
                      <Route path="admin/:poolAddress/*" element={<EditLBPPage />} />
                      <Route path=":poolAddress" element={<AscendPage />} />
                    </Route>
                  </>
                )}
                <Route path="analytics" element={<AnalyticsPage />} />
              </Route>
            </>
          )}
          {nexusOnly && (
            <>
              <Route path="/" element={<PageLayout />}>
                <Route path="" element={<Navigate replace to="/nexus/" />} />
                <Route path="*" element={<Navigate replace to="/nexus/" />} />
              </Route>
              <Route path="/nexus/*" element={<CoreLayout mode="nexus" />}>
                <Route path="" element={<Navigate to="relic" />} />
                <Route path="relic/*" element={<NexusPage />} />
                <Route path="quests/*" element={<QuestPage />} />
                <Route path="forge/*" element={<ForgePage />} />
              </Route>
            </>
          )}
        </Routes>
      </BrowserRouter>
      <NotificationManager />
    </AppProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
