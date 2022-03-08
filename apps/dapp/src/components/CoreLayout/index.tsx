import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import styled, { createGlobalStyle } from 'styled-components';

import Header from './Header';

const CoreLayout = () => (
  <>
    <GlobalStyleOverride />
    <Header />
    <Main>
      <Routes>
        <Route path="/" element={'Home'} />
        <Route path="/vaults/*" element={'Vaults'} />
        <Route path="/trade" element={'Trade'} />
        <Route path="/profile" element={'Profile'} />
        <Route path="/analytics" element={'Analytics'} />
        {/* Redirect everything else to the home page */}
        <Route path="/*" element={<Navigate replace to="/" />} />
      </Routes>
    </Main>
  </>
);

export default CoreLayout;

const GlobalStyleOverride = createGlobalStyle`
  html, body {
    min-height: 100vh;
    min-width: 100vw;
  }
`;

const Main = styled.main`
  max-width: ${({ theme }) => theme.metrics.devices.laptop};
  margin: 0 auto;
`;
