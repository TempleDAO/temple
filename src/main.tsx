import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import PageLayout from 'components/Layouts/Page';
import Disclaimer from 'components/Pages/Disclaimer';
import Enter from 'components/Pages/Enter';
import Exit from 'components/Pages/Exit';
import Home from 'components/Pages/Home';
import Rituals from 'components/Pages/Rituals';
import MetamaskError from 'components/Pages/MetamaskError';
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
                      <Route path="/*" element={<Home />} />
                    </>
                  ) : (
                    <>
                      <Route path="/" element={<MetamaskError />} />
                      <Route path="/*" element={<MetamaskError />} />
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
