import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import { GlobalStyle } from 'styles/GlobalStyle';
import { AppProvider } from 'providers/AppProvider';
import NotificationManager from 'components/Notification/NotificationManager';
import PageLayout from 'components/Layouts/Page';
import Loader from 'components/Loader/Loader';
import Disclaimer from 'components/Pages/Disclaimer';
import Home from 'components/Pages/Core/NewUI/Home';
import { AnalyticsService } from 'services/AnalyticsService';
import { DashboardPage } from 'components/Pages/Core/DappPages/Dashboard';
import { TradePage } from './components/Pages/Core/DappPages/TradePage';
import { BorrowPage } from 'components/Pages/Core/DappPages/Borrow';
import { LegacyPage } from 'components/Pages/Core/DappPages/LegacyPage';
import V2Layout from 'components/Layouts/V2Layout';
import { SpiceBazaarPage } from 'components/Pages/Core/DappPages/SpiceBazaar/index';
import { SpiceBazaarTopNav } from 'components/Pages/Core/DappPages/SpiceBazaar/TopNav';
import { Overview } from 'components/Pages/Core/DappPages/SpiceBazaar/Overview';
import { StakeTemple } from 'components/Pages/Core/DappPages/SpiceBazaar/Earn/StakeTemple';
import { Stake } from 'components/Pages/Core/DappPages/SpiceBazaar/Earn/StakeTemple/Stake';
import { Unstake } from 'components/Pages/Core/DappPages/SpiceBazaar/Earn/StakeTemple/Unstake';
import { Claim } from 'components/Pages/Core/DappPages/SpiceBazaar/Earn/StakeTemple/Claim';
import { Delegate } from 'components/Pages/Core/DappPages/SpiceBazaar/Earn/StakeTemple/Delegate';
import { Spend } from 'components/Pages/Core/DappPages/SpiceBazaar/Spend';
import { MyActivityTGLD } from 'components/Pages/Core/DappPages/SpiceBazaar/MyActivity/BidsForTGLD';
import { Analytics } from 'components/Pages/Core/DappPages/SpiceBazaar/Analytics';
import { Details } from 'components/Pages/Core/DappPages/SpiceBazaar/Spend/Details/Details';
import { MyActivitySpice } from 'components/Pages/Core/DappPages/SpiceBazaar/MyActivity/BidsForSpice';
import { Bid } from 'components/Pages/Core/DappPages/SpiceBazaar/Bid';
import { Web3OnboardInitProvider } from 'components/Web3OnboardInitProvider';
import { ApiManagerProvider } from 'hooks/use-api-manager';
import { getAppConfig } from 'constants/newenv';

// new env configuration
// add to constants/newenv
const APP_CONFIG = getAppConfig();

// Separate Chunks
const TeamPayments = React.lazy(() => import('components/Pages/TeamPayments'));
const RamosAdmin = React.lazy(() => import('components/Pages/Ramos/admin'));
const SafeAdmin = React.lazy(() => import('components/Pages/Safe/admin'));

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

const root = createRoot(document.getElementById('root')!);

root.render(
  // put ApiManagerProvider outside StrictMode, so that the api only gets
  // created once in dev.
  <Web3OnboardInitProvider>
    <ApiManagerProvider appConfig={APP_CONFIG}>
      <React.StrictMode>
        <BrowserRouter>
          <AppProvider>
            <GlobalStyle />
            <Routes>
              <>
                <Route path="/" element={<Home />} />
                <Route path="/tlc" element={<Home tlc={true} />} />
                <Route path="/" element={<PageLayout />}>
                  {/* Redirect everything else to the home page */}
                  <Route path="*" element={<Navigate replace to="/" />} />
                  <Route path="disclaimer" element={<Disclaimer />} />
                  <Route
                    path="team-payments"
                    element={<LazyPage component={TeamPayments} />}
                  />
                  <Route
                    path="ramos"
                    element={<LazyPage component={RamosAdmin} />}
                  />
                  <Route
                    path="safe"
                    element={<LazyPage component={SafeAdmin} />}
                  />
                </Route>
                <Route
                  path="/dapp"
                  element={<Navigate replace to="/dapp/spice" />}
                />
                <Route path="/dapp/*" element={<V2Layout />}>
                  <Route path="dashboard/*" element={<DashboardPage />} />
                  <Route path="trade" element={<TradePage />} />
                  <Route path="borrow" element={<BorrowPage />} />
                  <Route path="legacy" element={<LegacyPage />} />
                  <Route path="spice" element={<SpiceBazaarPage />} />
                  <Route element={<SpiceBazaarTopNav />}>
                    <Route path="spice/overview" element={<Overview />} />
                    <Route
                      path="spice/earn/staketemple"
                      element={<StakeTemple />}
                    >
                      <Route path="stake" element={<Stake />} />
                      <Route path="unstake" element={<Unstake />} />
                      <Route path="claim" element={<Claim />} />
                      <Route path="delegate" element={<Delegate />} />
                    </Route>
                    <Route path="spice/bid" element={<Bid />} />
                    <Route path="spice/spend" element={<Spend />} />
                    <Route
                      path="spice/spend/details/:address"
                      element={<Details />}
                    />
                    <Route
                      path="spice/myactivity/tgld"
                      element={<MyActivityTGLD />}
                    />
                    <Route
                      path="spice/myactivity/spice"
                      element={<MyActivitySpice />}
                    />
                    <Route path="spice/analytics" element={<Analytics />} />
                  </Route>
                </Route>
              </>
            </Routes>
            <NotificationManager />
          </AppProvider>
        </BrowserRouter>
      </React.StrictMode>
    </ApiManagerProvider>
  </Web3OnboardInitProvider>
);
