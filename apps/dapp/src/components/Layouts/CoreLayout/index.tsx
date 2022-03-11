import React from 'react';
import { Outlet } from 'react-router-dom';
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
    min-width: 100vw;
  }
`;

const Main = styled.main`
  max-width: ${({ theme }) => theme.metrics.desktop.maxWidth};
  margin: 0 auto;
  padding: ${pixelsToRems(NAV_MOBILE_HEIGHT_PIXELS)}rem 1.75rem 1.75rem;

  ${tabletAndAbove(`
    padding: 0 1.75rem 1.75rem;
  `)}
`;
