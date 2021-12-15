import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import PageLayout from 'components/Layouts/Page';
import Disclaimer from 'components/Pages/Disclaimer';
import Enter from 'components/Pages/Enter';
import Exit from 'components/Pages/Exit';
import Home from 'components/Pages/Home';
import Rituals from 'components/Pages/Rituals';
import Claim from 'components/Pages/Claim';
import MetamaskError from 'components/Pages/MetamaskError';
import FireRitualistCashback from 'components/Pages/FireRitualistCashback';
import NotificationManager from 'components/Notification/NotificationManager';
import { NotificationProvider } from 'providers/NotificationProvider';
import { WalletProvider } from 'providers/WalletProvider';
import { GlobalStyle } from 'styles/GlobalStyle';
import { theme } from 'styles/theme';

ReactDOM.render(
  <React.StrictMode>
    <GlobalStyle />
    <NotificationProvider>
      <WalletProvider>
        <ThemeProvider theme={theme}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<PageLayout />}>
                {
                  //@ts-ignore
                  window.ethereum ? (
                    <>
                      <Route path="/" element={<Home />} />
                      <Route path="disclaimer" element={<Disclaimer />} />
                      <Route path="enter" element={<Enter />} />
                      <Route path="exit" element={<Exit />} />
                      <Route path="rituals" element={<Rituals />} />
                      <Route
                        path="fire-ritualist-cashback"
                        element={<FireRitualistCashback />}
                      />
                      <Route path="claim" element={<Claim />} />
                      <Route path="/*" element={<Navigate replace to="/" />} />
                    </>
                  ) : (
                    <>
                      <Route path="/" element={<MetamaskError />} />
                      <Route path="/*" element={<Navigate replace to="/" />} />
                    </>
                  )
                }
                
              </Route>
            </Routes>
          </BrowserRouter>
          <NotificationManager />
        </ThemeProvider>
      </WalletProvider>
    </NotificationProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
