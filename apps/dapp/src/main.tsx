import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import styled from 'styled-components';

import { GlobalStyle } from 'styles/GlobalStyle';
import { AppProvider } from 'providers/AppProvider';
import NotificationManager from 'components/Notification/NotificationManager';
import PageLayout from 'components/Layouts/Page';
import Loader from 'components/Loader/Loader';
import Disclaimer from 'components/Pages/Disclaimer';
import CoreLayout from 'components/Layouts/CoreLayout';
import VaultPage from 'components/Pages/Core/Vault';
import ProfilePage from 'components/Pages/Core/Profile/Profile';
import VaultListPage from 'components/Pages/Core/VaultList';
import Home from 'components/Pages/Core/NewUI/Home';
import PoolListPage from 'components/Pages/Ascend/PoolList';
import { Claim as VaultClaim } from 'components/Pages/Core/VaultPages/Claim';
import { Stake } from 'components/Pages/Core/VaultPages/Stake';
import { Summary } from 'components/Pages/Core/VaultPages/Summary';
import { Strategy } from 'components/Pages/Core/VaultPages/Strategy';
import Timing from 'components/Pages/Core/VaultPages/Timing';
import { AscendLayout } from 'components/Layouts/Ascend';
import { CreateLBPPage } from 'components/Pages/Ascend/admin/create';
import { EditLBPPage } from 'components/Pages/Ascend/admin/edit';
import { AscendPage } from 'components/Pages/Ascend';
import { AscendListPage } from 'components/Pages/AscendList';

import env from 'constants/env';
import { AnalyticsService } from 'services/AnalyticsService';
import { Unstake } from 'components/Pages/Core/Trade/views/Unstake';
import { Dashboard } from 'components/Pages/Core/DappPages/Dashboard';
import { Trade } from './components/Pages/Core/DappPages/Trade';
import { Borrow } from 'components/Pages/Core/DappPages/Borrow';
import { ClaimLegacy } from 'components/Pages/Core/DappPages/ClaimLegacy';
import { UnstakeLegacy } from 'components/Pages/Core/DappPages/UnstakeLegacy';

// Separate Chunks
const TeamPayments = React.lazy(() => import('components/Pages/TeamPayments'));
const RamosAdmin = React.lazy(() => import('components/Pages/Ramos/admin'));

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
            <Route path="/tlc" element={<Home tlc={true} />} />
            <Route path="/" element={<PageLayout />}>
              {/* Redirect everything else to the home page */}
              <Route path="*" element={<Navigate replace to="/" />} />
              <Route path="disclaimer" element={<Disclaimer />} />
              <Route path="team-payments" element={<LazyPage component={TeamPayments} />} />
              <Route path="ramos" element={<LazyPage component={RamosAdmin} />} />
            </Route>
            <Route path="/dapp/*" element={<CoreLayout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="trade" element={<Trade />} />
              <Route path="borrow" element={<Borrow />} />
              <Route path="claimlegacy" element={<ClaimLegacy />} />
              <Route path="unstakelegacy" element={<UnstakeLegacy />} />
              <Route path="vaults" element={<VaultListPage />} />
              <Route path="unstake" element={<Unstake />} />
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
