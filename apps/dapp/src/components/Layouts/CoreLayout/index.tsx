import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import styled, { createGlobalStyle } from 'styled-components';

import Header from './Header';

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
  max-width: ${({ theme }) => theme.metrics.devices.laptop};
  margin: 0 auto;
`;
