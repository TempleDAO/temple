import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import styled, { ThemeProvider } from 'styled-components';

import NotificationManager from 'components/Notification/NotificationManager';
import { NotificationProvider } from 'providers/NotificationProvider';
import { WalletProvider } from 'providers/WalletProvider';
import { GlobalStyle } from 'styles/GlobalStyle';
import { theme } from 'styles/theme';
import PageLayout from 'components/Layouts/Page';
import Loader from 'components/Loader/Loader';

import Home from 'components/Pages/Home';
import Disclaimer from 'components/Pages/Disclaimer';

// Separate Chunks
const AmmSpaRoot = React.lazy(() => import('components/Pages/AMM'));
const DAppRoot = React.lazy(() => import('components/Pages/DAppRoot'));
const FireRitualistCashback = React.lazy(() => import('components/Pages/FireRitualistCashback'));
const TeamPayments = React.lazy(() => import('components/Pages/TeamPayments'));
const FaithAirdrop = React.lazy(() => import('components/Pages/FaithAirdrop'));
const Claim = React.lazy(() => import('components/Pages/Claim'));
const Exit = React.lazy(() => import('components/Pages/Exit'));
const Enter = React.lazy(() => import('components/Pages/Enter'));

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
  <React.Suspense fallback={(
    <LoaderWrapper>
      <Loader />
    </LoaderWrapper>
  )}>
    <Component />
  </React.Suspense>
);

ReactDOM.render(
  <React.StrictMode>
    <GlobalStyle />
    <NotificationProvider>
      <WalletProvider>
        <ThemeProvider theme={theme}>
          <BrowserRouter>
            <Routes>
              <>
                <Route path="/the-temple" element={<LazyPage component={AmmSpaRoot} />} />
                <Route path="/dapp" element={<LazyPage component={DAppRoot} />} />
                <Route path="/" element={<PageLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="disclaimer" element={<Disclaimer />} />
                  <Route path="enter" element={<LazyPage component={Enter} />} />
                  <Route path="exit" element={<LazyPage component={Exit} />} />
                  <Route path="faith-airdrop" element={<LazyPage component={FaithAirdrop} />} />
                  <Route
                    path="fire-ritualist-apy-topup"
                    element={<LazyPage component={FireRitualistCashback} />}
                  />
                  <Route path="temple-claim" element={<LazyPage component={Claim} />} />
                  <Route path="team-payments" element={<LazyPage component={TeamPayments} />} />
                  <Route path="/*" element={<Navigate replace to="/" />} />
                </Route>
              </>
            </Routes>
          </BrowserRouter>
          <NotificationManager />
        </ThemeProvider>
      </WalletProvider>
    </NotificationProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
