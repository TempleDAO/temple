import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import styled, { createGlobalStyle } from 'styled-components';
import { tabletAndAbove } from 'styles/breakpoints';
import { pixelsToRems } from 'styles/mixins';

import Header, { NAV_MOBILE_HEIGHT_PIXELS } from './Header';

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
    min-width: 320px;
    ${tabletAndAbove(`
      min-height: 100vh;
      min-width: 100vw;
  `)}
  }
`;

const Main = styled.main`
  margin: 0px;
  padding: 0px;
  ${tabletAndAbove(`
      
      max-width: ${
        //@ts-ignore
        (props) => theme.metrics.desktop.maxWidth};
      padding: 0 1.75rem;
    `)}
`;
