import React from 'react';
import styled from 'styled-components';
import { Outlet } from 'react-router-dom';
import { Footer } from 'components/Footer/Footer';
import { Header } from 'components/Header/Header';

const BaseLayout = () => {
  return (
    <>
      <Header />
      <Main>
        <Outlet />
      </Main>
      <Footer />
    </>
  );
};

const Main = styled.main`
  max-width: ${(props) => props.theme.metrics.desktop.maxWidth};
  margin: 0 auto;
  padding: ${(props) => props.theme.metrics.headerHeight} 16px;
  // 315 approx footer height
  min-height: calc(
    100vh - (${(props) => props.theme.metrics.headerHeight} + 315px)
  );
  overflow-x: hidden;
`;

export default BaseLayout;
