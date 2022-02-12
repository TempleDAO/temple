import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import NotificationManager from 'components/Notification/NotificationManager';
import { NotificationProvider } from 'providers/NotificationProvider';
import { WalletProvider } from 'providers/WalletProvider';
import { GlobalStyle } from 'styles/GlobalStyle';
import { theme } from 'styles/theme';
import Loader from 'components/Loader/Loader';

const FireRitualistCashback = React.lazy(() => import('components/Pages/FireRitualistCashback'));
const TeamPayments = React.lazy(() => import('components/Pages/TeamPayments'));
const FaithAirdrop = React.lazy(() => import('components/Pages/FaithAirdrop'));
const Claim = React.lazy(() => import('components/Pages/Claim'));
const Enter = React.lazy(() => import('components/Pages/Enter'));
const Exit = React.lazy(() => import('components/Pages/Exit'));
const Disclaimer = React.lazy(() => import('components/Pages/Disclaimer'));
const AmmSpaRoot = React.lazy(() => import('components/Pages/AMM'));
const DAppRoot = React.lazy(() => import('components/Pages/DAppRoot'));
const PageLayout = React.lazy(() => import('components/Layouts/Page'));
const Home = React.lazy(() => import('components/Pages/Home'));

interface LazyPageProps {
  component: React.LazyExoticComponent<(props: unknown) => JSX.Element>;
}

const LazyPage = (
  { component: Component }: LazyPageProps) => {
  return (
    <React.Suspense fallback={<Loader />}>
      <Component />
    </React.Suspense>
  );
};

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
                <Route path="/" element={<LazyPage component={PageLayout} />}>
                  <Route path="/" element={<LazyPage component={Home} />} />
                  <Route path="disclaimer" element={<LazyPage component={Disclaimer} />} />
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
