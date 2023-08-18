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
import Home from 'components/Pages/Core/NewUI/Home';

import env from 'constants/env';
import { AnalyticsService } from 'services/AnalyticsService';
import { DashboardPage } from 'components/Pages/Core/DappPages/Dashboard';
import { TradePage } from './components/Pages/Core/DappPages/TradePage';
import { BorrowPage } from 'components/Pages/Core/DappPages/Borrow';
import { LegacyPage } from 'components/Pages/Core/DappPages/LegacyPage';
import V2Layout from 'components/Layouts/V2Layout';
import { OhmagePage } from 'components/Pages/Core/DappPages/OhmagePage';
import { Unstake } from 'components/Pages/Core/Trade/views/Unstake';

import NexusPage from 'components/Pages/Nexus/Relic';
import QuestPage from 'components/Pages/Nexus/Quest';
import CoreLayout from 'components/Layouts/CoreLayout';
import ForgePage from 'components/Pages/Nexus/Forge';
import NexusUserManual from 'components/Pages/Nexus/Manual/UserManual';
import NexusPartnerManual from 'components/Pages/Nexus/Manual/PartnerManual';
import { NexusGates } from 'components/Pages/Nexus/NexusGates';
import NexusLibrary from 'components/Pages/Nexus/Quests/FirstQuest/Library';
import Quiz from 'components/Pages/Nexus/Quests/FirstQuest/Quiz';
import PotMint from 'components/Pages/Nexus/Quests/PathOfTemplar';

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
  component: React.LazyExoticComponent<() => JSX.Element>;
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

const nexusOnly = !!env.featureFlags.nexusOnlyMode;

ReactDOM.render(
  <React.StrictMode>
    <AppProvider>
      <GlobalStyle />
      <BrowserRouter>
        <Routes>
          {!nexusOnly && (
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
            <Route path="/dapp/*" element={<V2Layout />}>
              <Route path="dashboard/*" element={<DashboardPage />} />
              <Route path="trade" element={<TradePage />} />
              <Route path="borrow" element={<BorrowPage />} />
              <Route path="ohmage" element={<OhmagePage />} />
              <Route path="legacy" element={<LegacyPage />} />
            </Route>
          </>
          )}
          {nexusOnly && (
            <>
              <Route path="" element={<NexusGates />} />
              <Route path="/nexus/*" element={<CoreLayout mode="nexus" />}>
                <Route path="" element={<Navigate to="relic" />} />
                <Route path="relic/*" element={<NexusPage />} />
                <Route path="quests/*" element={<QuestPage />} />
                <Route path="forge/*" element={<ForgePage />} />
                <Route path="help" element={<NexusUserManual />} />
                <Route path="partner" element={<NexusPartnerManual />} />
              </Route>
              <Route
                path="/nexus/quests/library"
                element={
                  <>
                    <CoreLayout headless mode="nexus" />
                    <NexusLibrary />
                  </>
                }
              />
              <Route
                path="/nexus/quests/quiz"
                element={
                  <>
                    <CoreLayout headless mode="nexus" />
                    <Quiz />
                  </>
                }
              />
              <Route
                path="/nexus/quests/pathoftemplar/:enclave"
                element={
                  <>
                    <CoreLayout headless mode="nexus" />
                    <PotMint />
                  </>
                }
              />
              {/* <Route
                path="/origami"
                element={
                  <>
                    <CoreLayout headless mode="nexus" />
                    <OrigamiPage />
                  </>
                }
              /> */}
            </>
          )}
        </Routes>
      </BrowserRouter>
      <NotificationManager />
    </AppProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
