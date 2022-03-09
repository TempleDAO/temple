import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import { GlobalStyle } from 'styles/GlobalStyle';

import { AppProvider } from 'providers/AppProvider';

import NotificationManager from 'components/Notification/NotificationManager';

import PageLayout from 'components/Layouts/Page';
import Loader from 'components/Loader/Loader';

import Home from 'components/Pages/Home';
import Disclaimer from 'components/Pages/Disclaimer';
import CoreLayout from 'components/Layouts/CoreLayout';

import { Test } from 'components/Table';

// Separate Chunks
const AmmSpaRoot = React.lazy(() => import('components/Pages/AMM'));
const DAppRoot = React.lazy(() => import('components/Pages/DAppRoot'));
const FireRitualistCashback = React.lazy(
  () => import('components/Pages/FireRitualistCashback')
);
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
  component: React.LazyExoticComponent<(props: unknown) => JSX.Element>;
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

ReactDOM.render(
  <React.StrictMode>
    <AppProvider>
      <GlobalStyle />
      <BrowserRouter>
        <Routes>
          <>
            <Route path="/core/*" element={<CoreLayout />}>
              <Route path="" element={'Home'} />
              <Route path="vaults/*" element={'Vaults'} />
              <Route path="trade" element={'Trade'} />
              <Route path="profile" element={'Profile'} />
              <Route path="analytics" element={'Analytics'} />
              {/* Redirect everything else to the home page */}
              <Route path="*" element={<Navigate replace to="/" />} />
            </Route>
            <Route
              path="/table-test"
              element={<Test />}
            />
            <Route
              path="/the-temple"
              element={<LazyPage component={AmmSpaRoot} />}
            />
            <Route path="/dapp" element={<LazyPage component={DAppRoot} />} />
            <Route path="/" element={<PageLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="disclaimer" element={<Disclaimer />} />
              <Route
                path="faith-airdrop"
                element={<LazyPage component={FaithAirdrop} />}
              />
              <Route
                path="fire-ritualist-apy-topup"
                element={<LazyPage component={FireRitualistCashback} />}
              />
              <Route
                path="temple-claim"
                element={<LazyPage component={Claim} />}
              />
              <Route
                path="team-payments"
                element={<LazyPage component={TeamPayments} />}
              />
              <Route path="/*" element={<Navigate replace to="/" />} />
            </Route>
          </>
        </Routes>
      </BrowserRouter>
      <NotificationManager />
    </AppProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
