import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import styled, { createGlobalStyle } from 'styled-components';
import { tabletAndAbove } from 'styles/breakpoints';
import { pixelsToRems } from 'styles/mixins';

import Header, { NAV_MOBILE_HEIGHT_PIXELS } from './Header';

const CoreLayout = () => (
  <>
    <GlobalStyleOverride />
    <AppContainer>
      <Header />
      <Main>
        <Outlet />
      </Main>
    </AppContainer>
  </>
);

export default CoreLayout;

const GlobalStyleOverride = createGlobalStyle`
html, body {
   height: 100%;
   height: -webkit-fill-available;
    margin: 0;
    padding: 0;
  }
`;

const AppContainer = styled.div`
  border: 1px dashed white;
  display: flex;
  flex-direction: column;
  // align-items: center;
  height: 100vh;
`;
const Main = styled.main`
  border: 1px solid blue;
  min-width: ${({ theme }) => theme.metrics.desktop.minWidth};
  max-width: ${({ theme }) => theme.metrics.desktop.maxWidth};
  flex-grow: 1;
  align-self: center;

  ${tabletAndAbove(`
    padding: 0 1.75rem;
  `)}
`;
