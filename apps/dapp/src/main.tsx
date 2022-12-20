import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import styled from 'styled-components';

import { GlobalStyle } from 'styles/GlobalStyle';
import { AppProvider } from 'providers/AppProvider';
import NotificationManager from 'components/Notification/NotificationManager';
import PageLayout from 'components/Layouts/Page';
import Loader from 'components/Loader/Loader';
import Disclaimer from 'pages/Disclaimer';
import CoreLayout from 'components/Layouts/CoreLayout';
import VaultPage from 'pages/Core/Vault';
import ProfilePage from 'pages/Core/Profile/Profile';
import VaultListPage from 'pages/Core/VaultList';
import Home from 'pages/Core/NewUI/Home';
import PoolListPage from 'pages/Ascend/PoolList';
import { Claim as VaultClaim } from 'pages/Core/VaultPages/Claim';
import { Stake } from 'pages/Core/VaultPages/Stake';
import { Summary } from 'pages/Core/VaultPages/Summary';
import { Strategy } from 'pages/Core/VaultPages/Strategy';
import Timing from 'pages/Core/VaultPages/Timing';
import { AscendLayout } from 'components/Layouts/Ascend';
import { CreateLBPPage } from 'pages/Ascend/admin/create';
import { EditLBPPage } from 'pages/Ascend/admin/edit';
import { AscendPage } from 'pages/Ascend';
import { AscendListPage } from 'pages/AscendList';

import env from 'constants/env';
import { AnalyticsService } from 'services/AnalyticsService';

// Separate Chunks
const TeamPayments = React.lazy(() => import('pages/TeamPayments'));
const RamosAdmin = React.lazy(() => import('pages/Ramos/admin'));

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

AnalyticsService.init();

ReactDOM.render(
  <React.StrictMode>
    <AppProvider>
      <GlobalStyle />
      <BrowserRouter>
        <Routes>
          <>
            <Route path="/" element={<Home />} />
            <Route path="/" element={<PageLayout />}>
              {/* Redirect everything else to the home page */}
              <Route path="*" element={<Navigate replace to="/" />} />
              <Route path="disclaimer" element={<Disclaimer />} />
              <Route path="team-payments" element={<LazyPage component={TeamPayments} />} />
              <Route path="ramos" element={<LazyPage component={RamosAdmin} />} />
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
            </Route>
          </>
        </Routes>
      </BrowserRouter>
      <NotificationManager />
    </AppProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
