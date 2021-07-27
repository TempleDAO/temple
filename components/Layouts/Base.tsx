import { PropsWithChildren } from 'react';
import styled from 'styled-components';
import { Footer } from '../Footer/Footer';
import { Header } from '../Header/Header';

interface BaseLayoutProps {
}

const BaseLayout = ({ children }: PropsWithChildren<BaseLayoutProps>) => {
  return (
      <>
        <Header/>
        <Main>
          {children}
        </Main>
        <Footer/>
      </>
  );
};

const Main = styled.main`
  max-width: ${(props) => props.theme.metrics.desktop.maxWidth};
  margin: 0 auto;
  padding: ${(props) => props.theme.metrics.headerHeight} 16px;
  // 315 approx footer height
  min-height: calc(100vh - (${(props) => props.theme.metrics.headerHeight} + 315px));
  overflow-x: hidden;
`;

export default BaseLayout;
