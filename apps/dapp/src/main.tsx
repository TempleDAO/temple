import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import PageLayout from 'components/Layouts/Page';
import Disclaimer from 'components/Pages/Disclaimer';
import Enter from 'components/Pages/Enter';
import Exit from 'components/Pages/Exit';
import Home from 'components/Pages/Home';
import Claim from 'components/Pages/Claim';
import AmmSpaRoot from 'components/Pages/AMM';
import TeamPayments from 'components/Pages/TeamPayments';
import MetamaskError from 'components/Pages/MetamaskError';
import FireRitualistCashback from 'components/Pages/FireRitualistCashback';
import NotificationManager from 'components/Notification/NotificationManager';
import { NotificationProvider } from 'providers/NotificationProvider';
import { WalletProvider } from 'providers/WalletProvider';
import { GlobalStyle } from 'styles/GlobalStyle';
import { theme } from 'styles/theme';
import DAppRoot from 'components/Pages/DAppRoot';

ReactDOM.render(
  <React.StrictMode>
    <GlobalStyle />
    <NotificationProvider>
      <WalletProvider>
        <ThemeProvider theme={theme}>
          <BrowserRouter>
            <Routes>
              {
                //@ts-ignore
                window.ethereum ? (
                  <>
                    <Route path="/the-temple" element={<AmmSpaRoot />} />
                    <Route path="/dapp" element={<DAppRoot />} />
                    <Route path="/" element={<PageLayout />}>
                      <Route path="/" element={<Home />} />
                      <Route path="disclaimer" element={<Disclaimer />} />
                      <Route path="enter" element={<Enter />} />
                      <Route path="exit" element={<Exit />} />
                      <Route
                        path="fire-ritualist-apy-topup"
                        element={<FireRitualistCashback />}
                      />
                      <Route path="temple-claim" element={<Claim />} />
                      <Route path="team-payments" element={<TeamPayments />} />
                      <Route path="/*" element={<Navigate replace to="/" />} />
                    </Route>
                  </>
                ) : (
                  <>
                    <Route path="/" element={<MetamaskError />} />
                    <Route path="/*" element={<Navigate replace to="/" />} />
                  </>
                )
              }
            </Routes>
          </BrowserRouter>
          <NotificationManager />
        </ThemeProvider>
      </WalletProvider>
    </NotificationProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
