import React from 'react';
import { Outlet } from 'react-router-dom';
import styled, { createGlobalStyle } from 'styled-components';

import Header from 'components/Layouts/CoreLayout/Header';

const CoreLayout = () => (
  <>
    <GlobalStyleOverride />
    <Header />
    <Main>
      <Outlet />
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
  max-width: ${({ theme }) => theme.metrics.desktop.maxWidth};
  margin: 0 auto;
  padding: 0 1.75rem 1.75rem;
`;
