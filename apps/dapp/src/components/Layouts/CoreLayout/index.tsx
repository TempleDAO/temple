import { Outlet } from 'react-router-dom';
import styled from 'styled-components';
import { tabletAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';

import Header from './Header';

const CoreLayout = () => (
  <>
    <Header />
    <Main>
      <Outlet />
    </Main>
  </>
);

export default CoreLayout;

const Main = styled.main`
  margin: 0 auto;
  padding: 0px;
  ${tabletAndAbove(`
    width: ${theme.metrics.desktop.maxWidth};
    padding: 0 1.75rem;
  `)}
`;
